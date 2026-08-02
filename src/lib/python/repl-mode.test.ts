import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPythonRepl, pythonBanner } from "./repl-mode";
import { PythonAborted } from "./protocol";
import type { PythonClient, RunOptions, RunResult } from "./pyodide-client";
import { REPL_PROMPT, REPL_CONTINUATION_PROMPT } from "./config";

/**
 * The REPL is deliberately free of xterm and Worker dependencies, so it can be
 * driven directly with a fake writer and a fake client. Everything asserted
 * here is about the state machine: which prompt is showing, what survives an
 * interrupt, and when the session ends.
 */

type RunImpl = (code: string, options: RunOptions) => Promise<RunResult>;

function fakeClient(run: RunImpl) {
  const client = {
    generation: 0,
    run: vi.fn(run),
    interrupt: vi.fn(function (this: void) {
      // Mirrors the real client: an interrupt rebuilds the interpreter.
      client.generation++;
    }),
    clearBlock: vi.fn(),
    reset: vi.fn(),
  };
  return client as unknown as PythonClient & typeof client;
}

const ok = (status: RunResult["status"] = "ok"): RunResult => ({
  status,
  truncated: false,
});

describe("createPythonRepl", () => {
  let written: string[];
  let exit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    written = [];
    exit = vi.fn();
  });

  const build = (run: RunImpl) => {
    const client = fakeClient(run);
    const repl = createPythonRepl({
      client,
      write: (text) => written.push(text),
      exit,
    });
    return { client, repl };
  };

  const output = () => written.join("");

  describe("prompts", () => {
    it("starts at the primary prompt", () => {
      const { repl } = build(async () => ok());

      expect(repl.prompt().text).toContain(REPL_PROMPT);
      expect(repl.prompt().length).toBe(REPL_PROMPT.length);
    });

    it("switches to the continuation prompt while a block is open", async () => {
      const { repl } = build(async () => ok("incomplete"));

      await repl.onLine("for i in range(3):");

      expect(repl.prompt().text).toContain(REPL_CONTINUATION_PROMPT);
    });

    it("returns to the primary prompt once the block completes", async () => {
      let status: RunResult["status"] = "incomplete";
      const { repl } = build(async () => ok(status));

      await repl.onLine("for i in range(3):");
      status = "ok";
      await repl.onLine("");

      expect(repl.prompt().text).toContain(REPL_PROMPT);
    });

    it("reports both prompts as the same visible width", () => {
      // The line-wrap math assumes the prompt width it reads now matches the
      // width used when the line was drawn. Equal widths make that free.
      const { repl } = build(async () => ok());

      expect(REPL_PROMPT.length).toBe(REPL_CONTINUATION_PROMPT.length);
      expect(repl.prompt().length).toBe(REPL_PROMPT.length);
    });
  });

  describe("running lines", () => {
    it("sends the line verbatim, because indentation is significant", async () => {
      const { client, repl } = build(async () => ok());

      await repl.onLine("    print('indented')");

      expect(client.run).toHaveBeenCalledWith(
        "    print('indented')",
        expect.objectContaining({ kind: "repl" }),
      );
    });

    it("writes stdout through", async () => {
      const { repl } = build(async (_code, options) => {
        options.onOutput?.("42\n", "out");
        return ok();
      });

      await repl.onLine("21 * 2");

      expect(output()).toContain("42");
    });

    it("writes stderr through, so tracebacks are visible", async () => {
      const { repl } = build(async (_code, options) => {
        options.onOutput?.("NameError: name 'x' is not defined\n", "err");
        return ok("error");
      });

      await repl.onLine("x");

      expect(output()).toContain("NameError");
    });

    it("does not run a blank line at the primary prompt", async () => {
      const { client, repl } = build(async () => ok());

      await repl.onLine("   ");

      expect(client.run).not.toHaveBeenCalled();
    });

    it("does run a blank line inside a block, which is how a block ends", async () => {
      let status: RunResult["status"] = "incomplete";
      const { client, repl } = build(async () => ok(status));

      await repl.onLine("if True:");
      status = "ok";
      await repl.onLine("");

      expect(client.run).toHaveBeenCalledTimes(2);
    });

    it("flags truncated output", async () => {
      const { repl } = build(async () => ({ status: "ok", truncated: true }));

      await repl.onLine("print('x' * 10**9)");

      expect(output()).toContain("truncated");
    });
  });

  describe("history", () => {
    it("records submitted lines", async () => {
      const { repl } = build(async () => ok());

      await repl.onLine("a = 1");
      await repl.onLine("b = 2");

      expect(repl.history).toEqual(["a = 1", "b = 2"]);
    });

    it("does not record consecutive duplicates", async () => {
      const { repl } = build(async () => ok());

      await repl.onLine("a = 1");
      await repl.onLine("a = 1");

      expect(repl.history).toEqual(["a = 1"]);
    });

    it("rewinds the history index when a blank line is submitted", async () => {
      // The blank-line branch used to return early, leaving the index wherever
      // the last Up-arrow had put it. Pressing Up after that resumed from the
      // middle of history instead of from the most recent line.
      const { repl } = build(async () => ok());

      await repl.onLine("a = 1");
      await repl.onLine("b = 2");
      // Two Up-arrows: the line editor walks the index back through history.
      repl.historyIndex.current = 0;

      await repl.onLine("");

      expect(repl.historyIndex.current).toBe(repl.history.length);
      expect(repl.history).toEqual(["a = 1", "b = 2"]);
    });

    it("keeps its history separate from anything the shell owns", async () => {
      // Sharing one ring is how a later shell Up-arrow ends up replaying
      // "for i in range(3):" into the command dispatcher.
      const { repl } = build(async () => ok());

      await repl.onLine("for i in range(3):");

      expect(repl.history).toEqual(["for i in range(3):"]);
      expect(repl.historyIndex.current).toBe(1);
    });
  });

  describe("interrupt", () => {
    it("abandons a half-typed block without touching the interpreter", async () => {
      const { client, repl } = build(async () => ok("incomplete"));

      await repl.onLine("for i in range(3):");
      repl.onInterrupt();

      // The common case must be free: the worker is idle at a prompt, so
      // nothing is terminated and no variables are lost.
      expect(client.clearBlock).toHaveBeenCalled();
      expect(client.interrupt).not.toHaveBeenCalled();
      expect(output()).toContain("KeyboardInterrupt");
      expect(output()).not.toContain("variables were lost");
      expect(repl.prompt().text).toContain(REPL_PROMPT);
    });

    it("does nothing to the interpreter at an idle prompt", () => {
      const { client, repl } = build(async () => ok());

      repl.onInterrupt();

      expect(client.interrupt).not.toHaveBeenCalled();
      expect(client.clearBlock).not.toHaveBeenCalled();
      expect(output()).toContain("KeyboardInterrupt");
    });

    it("restarts the interpreter when a statement is running, and says so", () => {
      const { client, repl } = build(async () => ok());
      repl.busy.current = true;

      repl.onInterrupt();

      // This is the only path that costs the session, and it must be honest
      // about it rather than silently dropping the user's variables.
      expect(client.interrupt).toHaveBeenCalledWith("interrupt");
      expect(output()).toContain("KeyboardInterrupt");
      expect(output()).toContain("variables were lost");
      expect(repl.busy.current).toBe(false);
    });
  });

  describe("leaving", () => {
    it.each(["exit()", "quit()", "exit", "quit"])(
      "leaves on %s",
      async (command) => {
        // Bare exit/quit are accepted too: on mobile there is no Ctrl+D, and
        // CPython's "use exit()" nag would be a dead end.
        const { client, repl } = build(async () => ok());

        await repl.onLine(command);

        expect(exit).toHaveBeenCalled();
        expect(client.run).not.toHaveBeenCalled();
      },
    );

    it("treats exit() inside a block as ordinary source", async () => {
      const { client, repl } = build(async () => ok("incomplete"));

      await repl.onLine("if True:");
      await repl.onLine("    exit()");

      // It belongs to the body being typed, not to the session.
      expect(exit).not.toHaveBeenCalled();
      expect(client.run).toHaveBeenCalledTimes(2);
    });

    it("leaves on Ctrl+D", () => {
      const { repl } = build(async () => ok());

      repl.onEof();

      expect(exit).toHaveBeenCalled();
    });

    it("leaves when the interpreter raises SystemExit", async () => {
      const { repl } = build(async () => ok("exit"));

      await repl.onLine("raise SystemExit");

      expect(exit).toHaveBeenCalled();
    });
  });

  describe("failures", () => {
    it("explains a timeout rather than leaking the raw error", async () => {
      const { repl } = build(async () => {
        throw new PythonAborted("timeout");
      });

      await repl.onLine("while True: pass");

      expect(output()).toContain("too long");
      expect(repl.busy.current).toBe(false);
      expect(repl.prompt().text).toContain(REPL_PROMPT);
    });

    it("reports a crash and returns to a usable prompt", async () => {
      const { repl } = build(async () => {
        throw new PythonAborted("crash");
      });

      await repl.onLine("import ctypes");

      expect(output()).toContain("crashed");
      expect(repl.busy.current).toBe(false);
    });

    it("explains an interpreter that was reclaimed out from under a statement", async () => {
      // The idle timer and a package respawn both abort in-flight runs with
      // reason "shutdown". That reason had no branch here, so the user got a
      // blank line and a fresh prompt with no hint that anything had happened.
      const { repl } = build(async () => {
        throw new PythonAborted("shutdown");
      });

      await repl.onLine("total");

      expect(output()).toContain("restarted to free memory");
      expect(repl.busy.current).toBe(false);
      expect(repl.prompt().text).toContain(REPL_PROMPT);
    });

    it("reports an idle restart on the success path, not only when a run fails", async () => {
      // The idle reclaim does not reject anything: the statement after it runs
      // fine against a fresh namespace, and the loss only shows up later as a
      // bare NameError. Sampling the generation around the run is what makes
      // that visible at the moment it happens.
      const { client, repl } = build(async () => {
        (client as unknown as { generation: number }).generation++;
        return ok();
      });

      await repl.onLine("a = 1");

      expect(output()).toContain("variables were lost");
      expect(repl.prompt().text).toContain(REPL_PROMPT);
    });

    it("reports the lost session once, not on every statement after it", async () => {
      let restart = true;
      const { client, repl } = build(async () => {
        if (restart) {
          (client as unknown as { generation: number }).generation++;
          restart = false;
        }
        return ok();
      });

      await repl.onLine("a = 1");
      await repl.onLine("b = 2");

      const notices = output().match(/variables were lost/g) ?? [];

      expect(notices).toHaveLength(1);
    });

    it("clears busy even when the run rejects, so input is not wedged", async () => {
      const { repl } = build(async () => {
        throw new Error("worker went away");
      });

      await repl.onLine("1");

      expect(repl.busy.current).toBe(false);
      expect(output()).toContain("worker went away");
    });
  });
});

describe("pythonBanner", () => {
  it("names both versions and how to leave", () => {
    const banner = pythonBanner("3.14.2", "314.0.3");

    expect(banner).toContain("3.14.2");
    expect(banner).toContain("314.0.3");
    expect(banner).toContain("exit()");
  });
});
