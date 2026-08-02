/**
 * The interactive `python` prompt, as a LineMode the terminal can hand control to.
 *
 * Kept out of Terminal.tsx so the REPL can be unit-tested against a fake writer
 * and a fake client, with no xterm and no Worker in sight.
 */

import { createRef, makePrompt, type LineMode } from "@/lib/terminal/line-mode";
import { REPL_PROMPT, REPL_CONTINUATION_PROMPT } from "./config";
import { isPythonAborted } from "./protocol";
import type { PythonClient, OutputStream } from "./pyodide-client";

const GREEN = `${String.fromCharCode(27)}[32m`;
const DIM = `${String.fromCharCode(27)}[90m`;
const RED = `${String.fromCharCode(27)}[31m`;
const RESET = `${String.fromCharCode(27)}[0m`;

export interface ReplDeps {
  client: PythonClient;
  /** Writes straight to the terminal. Text already carries bare newlines. */
  write: (text: string) => void;
  /** Hands the line back to the shell. */
  exit: () => void;
}

/** Ways out of the interpreter, including the two that need no key combination. */
const EXIT_COMMANDS = new Set(["exit()", "quit()", "exit", "quit"]);

export function pythonBanner(python: string, pyodide: string): string {
  return (
    `Python ${python} (Pyodide ${pyodide}) in a sandboxed WebAssembly worker\n` +
    `${DIM}Type "exit()" or press Ctrl+D to leave. Tab indents.${RESET}\n`
  );
}

export function createPythonRepl(deps: ReplDeps): LineMode {
  const { client, write, exit } = deps;

  const history: string[] = [];
  const historyIndex = createRef(0);
  const busy = createRef(false);

  /** True while codeop is waiting for more lines of a block. */
  let blockOpen = false;
  /** Tracks client restarts so the "variables were lost" notice prints once. */
  let lastGeneration = client.generation;

  const primary = makePrompt(REPL_PROMPT, GREEN);
  const continuation = makePrompt(REPL_CONTINUATION_PROMPT, DIM);

  const resetToPrimary = () => {
    blockOpen = false;
  };

  const emit = (text: string, stream: OutputStream) => {
    write(stream === "err" ? `${RED}${text}${RESET}` : text);
  };

  const noteRestartIfNeeded = () => {
    if (client.generation !== lastGeneration) {
      lastGeneration = client.generation;
      write(`${DIM}[interpreter restarted, variables were lost]${RESET}\n`);
    }
  };

  return {
    history,
    historyIndex,
    busy,

    prompt: () => {
      const mode = blockOpen ? continuation : primary;
      return { text: mode.text, length: mode.length };
    },

    async onLine(line: string): Promise<void> {
      const trimmed = line.trim();

      // Leaving is only allowed at a clean prompt: inside a block, `exit()` is
      // ordinary source that belongs to the body being typed.
      if (!blockOpen && EXIT_COMMANDS.has(trimmed)) {
        exit();
        return;
      }

      // A blank line at the primary prompt is a no-op, exactly as in CPython.
      // Inside a block it is meaningful: it closes the block. The index is
      // reset first: returning early left it wherever the last Up-arrow put
      // it, so the next Up resumed from the middle of history.
      if (!blockOpen && trimmed === "") {
        historyIndex.current = history.length;
        return;
      }

      if (trimmed !== "" && history[history.length - 1] !== line) {
        history.push(line);
      }
      historyIndex.current = history.length;

      busy.current = true;
      // Sampled before the run so a restart that happened while the prompt sat
      // idle is still reported. The idle timer reclaims the interpreter after
      // five minutes, and that path does not reject: the next statement simply
      // runs against a fresh namespace and fails with a bare NameError.
      const generationBefore = client.generation;
      try {
        const result = await client.run(line, {
          kind: "repl",
          filename: "<console>",
          onOutput: emit,
          onSlow: () => {
            write(`${DIM}[running... press Ctrl+C to interrupt]${RESET}\n`);
          },
        });

        if (result.truncated) {
          write(`${DIM}[output truncated]${RESET}\n`);
        }

        // A successful run can still mean the session was rebuilt underneath
        // it, so this is checked on the happy path too, not only in catch.
        if (client.generation !== generationBefore) noteRestartIfNeeded();

        switch (result.status) {
          case "incomplete":
            blockOpen = true;
            break;
          case "exit":
            exit();
            return;
          default:
            resetToPrimary();
        }
      } catch (err) {
        // A traceback is a normal result, not a rejection: only an interrupt,
        // a timeout, or a dead worker lands here.
        if (isPythonAborted(err)) {
          if (err.reason === "timeout") {
            write(
              `\n${RED}TimeoutError: the interpreter was stopped after running too long.${RESET}\n`,
            );
          } else if (err.reason === "crash") {
            write(
              `\n${RED}The interpreter crashed and was restarted.${RESET}\n`,
            );
          } else if (err.reason === "shutdown") {
            // Reached when the interpreter was reclaimed out from under a
            // statement, by the idle timer or by a package respawn. Without a
            // branch here the user gets a blank line and a fresh prompt.
            write(
              `\n${DIM}The interpreter was restarted to free memory.${RESET}\n`,
            );
          }
          noteRestartIfNeeded();
        } else {
          write(`${RED}${(err as Error).message}${RESET}\n`);
        }
        resetToPrimary();
      } finally {
        busy.current = false;
      }
    },

    onInterrupt(): void {
      if (busy.current) {
        // Only this path costs the session. Without SharedArrayBuffer there is
        // no cooperative interrupt, so stopping a running statement means
        // terminating the worker and losing every variable.
        write("^C\n");
        client.interrupt("interrupt");
        write(`${RED}KeyboardInterrupt${RESET}\n`);
        write(`${DIM}[interpreter restarted, variables were lost]${RESET}\n`);
        lastGeneration = client.generation;
        busy.current = false;
        resetToPrimary();
        return;
      }

      // The common case: a half-typed line or block is abandoned. The worker is
      // idle at a prompt, so nothing is terminated and nothing is lost.
      if (blockOpen) client.clearBlock();
      write(`${RED}KeyboardInterrupt${RESET}\n`);
      resetToPrimary();
    },

    onEof(): void {
      exit();
    },
  };
}
