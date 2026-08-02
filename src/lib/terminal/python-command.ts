/**
 * The `python` terminal command.
 *
 * Three shapes, all routed through the same sandboxed worker:
 *   python                 interactive interpreter
 *   python <code>          run a snippet (also `python -c "<code>"`)
 *   python <path>          run a file out of the virtual filesystem
 *
 * The heavy client is imported lazily so an 18MB runtime never lands in the
 * terminal chunk, following the loadWebLLM pattern in ai-commands.ts.
 */

import { getFileAtPath, resolvePath } from "./fileSystem";
import { parsePythonArgs, type PathLookup } from "@/lib/python/arg-parser";
import {
  PYODIDE_VERSION,
  PYTHON_VERSION,
  VENDORED_PACKAGES,
} from "@/lib/python/config";
import type { CommandContext, CommandResult } from "./commands";
import type { BootPhase } from "@/lib/python/protocol";

const DIM = `${String.fromCharCode(27)}[90m`;
const RED = `${String.fromCharCode(27)}[31m`;
const RESET = `${String.fromCharCode(27)}[0m`;

/**
 * Loaded on first use and cached, so the Pyodide client and the REPL machinery
 * stay out of every bundle until someone actually types `python`.
 */
let modulesPromise: Promise<{
  client: typeof import("@/lib/python/pyodide-client").pythonClient;
  detectRequiredPackages: typeof import("@/lib/python/pyodide-client").detectRequiredPackages;
  createPythonRepl: typeof import("@/lib/python/repl-mode").createPythonRepl;
  pythonBanner: typeof import("@/lib/python/repl-mode").pythonBanner;
  isPythonAborted: typeof import("@/lib/python/protocol").isPythonAborted;
}> | null = null;

function loadPython() {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      import("@/lib/python/pyodide-client"),
      import("@/lib/python/repl-mode"),
      import("@/lib/python/protocol"),
    ]).then(([clientMod, replMod, protocolMod]) => ({
      client: clientMod.pythonClient,
      detectRequiredPackages: clientMod.detectRequiredPackages,
      createPythonRepl: replMod.createPythonRepl,
      pythonBanner: replMod.pythonBanner,
      isPythonAborted: protocolMod.isPythonAborted,
    }));
  }
  return modulesPromise;
}

/** Reset between tests, which would otherwise share one cached import. */
export function resetPythonModuleCache(): void {
  modulesPromise = null;
}

const USAGE = [
  "usage: python [option] ... [file | code]",
  "",
  "Options:",
  "  -c <code>      run the given code and exit",
  "  -V, --version  print the interpreter version and exit",
  "  -h, --help     print this message and exit",
  "",
  "With no arguments, starts the interactive interpreter.",
  "A bare argument is treated as a file when one exists at that path,",
  "and as code otherwise.",
].join("\n");

/** Bridges the virtual filesystem to the parser, mirroring how `cat` reads. */
function makeLookup(currentDirectory: string) {
  return (path: string): PathLookup => {
    const resolved = resolvePath(currentDirectory, path);
    const node = getFileAtPath(resolved);
    if (!node) return { kind: "missing" };
    if (node.type === "directory") return { kind: "directory" };
    return { kind: "file", content: node.content || "" };
  };
}

const BOOT_MESSAGES: Record<BootPhase, string> = {
  downloading: "Downloading CPython (about 12 MB, cached after the first run)",
  booting: "Starting the interpreter",
  hardening: "Sealing the sandbox",
};

/**
 * Report boot progress in place.
 *
 * Phases, not a percentage: loadPyodide exposes no byte-level progress hook, so
 * a bar would be invented. Redrawing uses the save/restore cursor pair, which
 * is safe because only one command runs at a time.
 */
function makeBootReporter(write: (text: string) => void) {
  const ESC = String.fromCharCode(27);
  let started = false;

  return {
    report(phase: BootPhase) {
      if (started) write(`${ESC}[u${ESC}[J`);
      else {
        write(`${ESC}[s`);
        started = true;
      }
      write(`${DIM}${BOOT_MESSAGES[phase]}...${RESET}`);
    },
    clear() {
      // One-shot: the saved cursor position is only meaningful until the
      // progress line is erased. Calling this twice would restore to a
      // now-stale position and erase every line of output written since.
      if (!started) return;
      started = false;
      write(`${ESC}[u${ESC}[J`);
    },
  };
}

export const pythonCommand = async (
  args: string[],
  context: CommandContext,
): Promise<CommandResult> => {
  const raw = context.rawArgs ?? args.join(" ");
  const invocation = parsePythonArgs(raw, makeLookup(context.currentDirectory));

  // Answered from pinned constants. Booting an 18MB runtime to print a version
  // string would be absurd, and `python --version` is a reflex.
  if (invocation.mode === "version") {
    return {
      output: `Python ${PYTHON_VERSION} (Pyodide ${PYODIDE_VERSION}) on WebAssembly`,
      success: true,
    };
  }

  if (invocation.mode === "help") {
    return { output: USAGE, success: true };
  }

  if (invocation.mode === "error") {
    return { output: invocation.message, success: false };
  }

  const write = context.writer;
  if (!write) {
    return {
      output: "python: this terminal cannot stream output",
      success: false,
    };
  }

  const {
    client,
    detectRequiredPackages,
    createPythonRepl,
    pythonBanner,
    isPythonAborted,
  } = await loadPython();

  const boot = makeBootReporter(write);

  if (invocation.mode === "repl") {
    if (!context.enterLineMode || !context.exitLineMode) {
      return {
        output:
          "python: the interactive interpreter is not available in this terminal",
        success: false,
      };
    }

    try {
      // The REPL cannot predict what will be typed, and packages must be
      // resident before the sandbox hardens, so everything vendored loads now.
      const info = await client.ensureReady(VENDORED_PACKAGES, boot.report);
      boot.clear();
      write(pythonBanner(info.python, info.pyodide));
      if (info.missing.length > 0) {
        write(
          `${DIM}unavailable in this deployment: ${info.missing.join(", ")}${RESET}\n`,
        );
      }
    } catch (err) {
      boot.clear();
      return {
        output: `python: ${(err as Error).message}`,
        success: false,
      };
    }

    const exitLineMode = context.exitLineMode;
    const repl = createPythonRepl({
      client,
      write,
      exit: () => {
        write("\n");
        exitLineMode();
      },
    });

    context.enterLineMode(repl);
    // The terminal draws the REPL prompt on handover; the usual epilogue would
    // add a second one and desynchronize the line editor.
    return { output: "", success: true, suppressPrompt: true };
  }

  // One-shot: `python -c ...` or `python file.py`.
  let sawError = false;

  // Ctrl+C has to reach the interpreter. The terminal aborts this controller
  // and redraws the prompt, but without this the worker kept running for the
  // full timeout and went on painting output over the shell.
  const abortSignal = context.abortController?.signal;
  const onAbort = () => client.interrupt("interrupt");
  abortSignal?.addEventListener("abort", onAbort, { once: true });

  try {
    // A one-shot run knows its source up front, so it boots with exactly the
    // packages that source imports. Getting this right here matters: asking for
    // a package later forces a respawn, because wheels are unpacked by
    // machinery the sandbox prelude removes.
    await client.ensureReady(
      detectRequiredPackages(invocation.code),
      boot.report,
    );
    boot.clear();

    const result = await client.run(invocation.code, {
      kind: "exec",
      filename: invocation.filename,
      onOutput: (text, stream) => {
        if (stream === "err") sawError = true;
        write(stream === "err" ? `${RED}${text}${RESET}` : text);
      },
      onSlow: () => {
        write(`${DIM}[running... press Ctrl+C to interrupt]${RESET}\n`);
      },
    });

    if (result.truncated) write(`${DIM}[output truncated]${RESET}\n`);

    return { output: "", success: result.status !== "error" && !sawError };
  } catch (err) {
    boot.clear();
    if (isPythonAborted(err)) {
      const message =
        err.reason === "timeout"
          ? "python: stopped after running too long"
          : err.reason === "crash"
            ? "python: the interpreter crashed"
            : // The terminal has already drawn its own prompt for a Ctrl+C, so
              // adding a line here would push it out of place.
              "";
      return { output: message, success: false };
    }
    return { output: `python: ${(err as Error).message}`, success: false };
  } finally {
    abortSignal?.removeEventListener("abort", onAbort);
  }
};
