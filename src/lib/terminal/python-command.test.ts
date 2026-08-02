import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PythonAborted } from "@/lib/python/protocol";
import { PYTHON_VERSION, PYODIDE_VERSION } from "@/lib/python/config";
import type { CommandContext } from "./commands";
import type { LineMode } from "./line-mode";

/**
 * The `python` command, with the interpreter mocked out.
 *
 * What matters here is the routing: which shape of invocation reaches the
 * interpreter, which is answered without booting it, and what the terminal is
 * handed back. Whether the sandbox actually holds is a property of a real
 * browser and is asserted in tests/e2e/python-terminal.spec.ts.
 */

vi.mock("./fileSystem", () => ({
  getFileAtPath: vi.fn(),
  resolvePath: vi.fn(),
}));

const ensureReady = vi.fn();
const run = vi.fn();
const createPythonRepl = vi.fn();

vi.mock("@/lib/python/pyodide-client", () => ({
  pythonClient: {
    get generation() {
      return 0;
    },
    ensureReady: (...args: unknown[]) => ensureReady(...args),
    run: (...args: unknown[]) => run(...args),
    interrupt: vi.fn(),
    clearBlock: vi.fn(),
    shutdown: vi.fn(),
  },
  detectRequiredPackages: (source: string) =>
    source.includes("numpy") ? ["numpy"] : [],
}));

vi.mock("@/lib/python/repl-mode", () => ({
  createPythonRepl: (...args: unknown[]) => createPythonRepl(...args),
  pythonBanner: (python: string, pyodide: string) =>
    `Python ${python} (Pyodide ${pyodide})\n`,
}));

const READY = { python: "3.14.2", pyodide: "314.0.3", missing: [] as string[] };

describe("python command", () => {
  let written: string[];
  let enterLineMode: ReturnType<typeof vi.fn>;
  let exitLineMode: ReturnType<typeof vi.fn>;
  let pythonCommand: typeof import("./python-command").pythonCommand;

  const context = (overrides: Partial<CommandContext> = {}): CommandContext =>
    ({
      currentDirectory: "/",
      currentUser: "guest",
      setCurrentDirectory: vi.fn(),
      setCurrentUser: vi.fn(),
      addToHistory: vi.fn(),
      clearTerminal: vi.fn(),
      closeTerminal: vi.fn(),
      writer: (text: string) => written.push(text),
      enterLineMode,
      exitLineMode,
      ...overrides,
    }) as CommandContext;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Deliberately NOT vi.resetModules(): the command reaches protocol.ts
    // through a dynamic import, and resetting the registry would hand it a
    // second copy of PythonAborted with a different identity from the one
    // imported at the top of this file. resetPythonModuleCache() clears the
    // only state that actually needs clearing.
    written = [];
    enterLineMode = vi.fn();
    exitLineMode = vi.fn();

    ensureReady.mockResolvedValue(READY);
    run.mockResolvedValue({ status: "ok", truncated: false });
    createPythonRepl.mockReturnValue({
      prompt: () => ({ text: ">>> ", length: 4 }),
      onLine: vi.fn(),
      onInterrupt: vi.fn(),
      onEof: vi.fn(),
      history: [],
      historyIndex: { current: 0 },
      busy: { current: false },
    } satisfies LineMode);

    const mod = await import("./python-command");
    mod.resetPythonModuleCache();
    pythonCommand = mod.pythonCommand;
  });

  afterEach(async () => {
    const mod = await import("./python-command");
    mod.resetPythonModuleCache();
  });

  const setFile = async (path: string, content: string) => {
    const fs = await import("./fileSystem");
    vi.mocked(fs.resolvePath).mockImplementation((_cwd, p) => p);
    vi.mocked(fs.getFileAtPath).mockImplementation((p) =>
      p === path ? { type: "file", name: path, content } : null,
    );
  };

  const setMissing = async () => {
    const fs = await import("./fileSystem");
    vi.mocked(fs.resolvePath).mockImplementation((_cwd, p) => p);
    vi.mocked(fs.getFileAtPath).mockReturnValue(null);
  };

  describe("answered without booting the interpreter", () => {
    it.each(["--version", "-V"])("reports the version for %s", async (flag) => {
      const result = await pythonCommand([flag], context({ rawArgs: flag }));

      expect(result.output).toContain(PYTHON_VERSION);
      expect(result.output).toContain(PYODIDE_VERSION);
      expect(result.success).toBe(true);
      // The whole point of pinning the constants: typing `python --version`
      // must not pull down a 12MB runtime.
      expect(ensureReady).not.toHaveBeenCalled();
    });

    it.each(["--help", "-h"])("prints usage for %s", async (flag) => {
      const result = await pythonCommand([flag], context({ rawArgs: flag }));

      expect(result.output).toContain("usage: python");
      expect(ensureReady).not.toHaveBeenCalled();
    });

    it("rejects an unsupported option by name", async () => {
      const result = await pythonCommand(
        ["-m", "http.server"],
        context({ rawArgs: "-m http.server" }),
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain("-m");
      expect(ensureReady).not.toHaveBeenCalled();
    });

    it("reports a mistyped script without booting", async () => {
      await setMissing();

      const result = await pythonCommand(
        ["fibonaci.py"],
        context({ rawArgs: "fibonaci.py" }),
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain("[Errno 2]");
      expect(ensureReady).not.toHaveBeenCalled();
    });

    it("reports a directory the way cat does", async () => {
      const fs = await import("./fileSystem");
      vi.mocked(fs.resolvePath).mockImplementation((_cwd, p) => p);
      vi.mocked(fs.getFileAtPath).mockReturnValue({
        type: "directory",
        name: "examples",
      });

      const result = await pythonCommand(
        ["examples"],
        context({ rawArgs: "examples" }),
      );

      expect(result.output).toContain("[Errno 21]");
      expect(result.success).toBe(false);
    });
  });

  describe("running code", () => {
    it("runs inline source given with -c", async () => {
      await setMissing();

      await pythonCommand(
        ["-c", '"print(1+1)"'],
        context({ rawArgs: '-c "print(1+1)"' }),
      );

      expect(run).toHaveBeenCalledWith(
        "print(1+1)",
        expect.objectContaining({ kind: "exec" }),
      );
    });

    it("falls back to the tokenized args when rawArgs is absent", async () => {
      // Plenty of callers build a context by hand, so the command must not
      // depend on the raw string being present.
      await setMissing();

      await pythonCommand(["print(1)"], context());

      expect(run).toHaveBeenCalledWith(
        "print(1)",
        expect.objectContaining({ kind: "exec" }),
      );
    });

    it("loads a script out of the virtual filesystem and names it in tracebacks", async () => {
      await setFile("examples/hello.py", "print('hi')");

      await pythonCommand(
        ["examples/hello.py"],
        context({ rawArgs: "examples/hello.py" }),
      );

      expect(run).toHaveBeenCalledWith(
        "print('hi')",
        expect.objectContaining({ filename: "examples/hello.py" }),
      );
    });

    it("streams stdout to the terminal", async () => {
      await setMissing();
      run.mockImplementation(async (_code, options) => {
        options.onOutput("2\n", "out");
        return { status: "ok", truncated: false };
      });

      await pythonCommand(["print(1+1)"], context({ rawArgs: "print(1+1)" }));

      expect(written.join("")).toContain("2");
    });

    it("reports failure when the interpreter raised", async () => {
      await setMissing();
      run.mockImplementation(async (_code, options) => {
        options.onOutput("NameError: name 'x' is not defined\n", "err");
        return { status: "error", truncated: false };
      });

      const result = await pythonCommand(["x"], context({ rawArgs: "x" }));

      expect(result.success).toBe(false);
      expect(written.join("")).toContain("NameError");
    });

    it("preloads only the packages the source actually imports", async () => {
      // Wheels are unpacked by machinery the sandbox prelude removes, so a
      // package asked for later forces a respawn. A one-shot run knows its
      // source up front and should pay for exactly what it uses.
      await setMissing();

      await pythonCommand(
        ["-c", '"import json; print(1)"'],
        context({ rawArgs: '-c "import json; print(1)"' }),
      );

      expect(ensureReady).toHaveBeenCalledWith([], expect.any(Function));
    });

    it("preloads numpy when the source imports it", async () => {
      await setMissing();

      await pythonCommand(
        ["-c", '"import numpy"'],
        context({ rawArgs: '-c "import numpy"' }),
      );

      expect(ensureReady).toHaveBeenCalledWith(["numpy"], expect.any(Function));
    });

    it("says so when output was truncated", async () => {
      await setMissing();
      run.mockResolvedValue({ status: "ok", truncated: true });

      await pythonCommand(["print(1)"], context({ rawArgs: "print(1)" }));

      expect(written.join("")).toContain("truncated");
    });

    it("explains a timeout instead of leaking the abort", async () => {
      await setMissing();
      run.mockRejectedValue(new PythonAborted("timeout"));

      const result = await pythonCommand(
        ["while True: pass"],
        context({ rawArgs: "while True: pass" }),
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain("too long");
    });

    it("reports a boot failure rather than hanging", async () => {
      await setMissing();
      ensureReady.mockRejectedValue(new Error("worker blocked by CSP"));

      const result = await pythonCommand(
        ["print(1)"],
        context({ rawArgs: "print(1)" }),
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain("worker blocked by CSP");
    });
  });

  describe("interactive interpreter", () => {
    it("hands a line mode to the terminal and suppresses the usual prompt", async () => {
      const result = await pythonCommand([], context({ rawArgs: "" }));

      expect(enterLineMode).toHaveBeenCalledTimes(1);
      // The terminal draws the REPL prompt on handover; the normal epilogue
      // would add a second one and desynchronize the line editor.
      expect(result.suppressPrompt).toBe(true);
      expect(result.output).toBe("");
    });

    it("preloads every vendored package, since it cannot predict what is typed", async () => {
      await pythonCommand([], context({ rawArgs: "" }));

      expect(ensureReady).toHaveBeenCalledWith(
        expect.arrayContaining(["numpy"]),
        expect.any(Function),
      );
    });

    it("prints the banner with both versions", async () => {
      await pythonCommand([], context({ rawArgs: "" }));

      expect(written.join("")).toContain("3.14.2");
      expect(written.join("")).toContain("314.0.3");
    });

    it("names any package this deployment could not vendor", async () => {
      ensureReady.mockResolvedValue({ ...READY, missing: ["numpy"] });

      await pythonCommand([], context({ rawArgs: "" }));

      expect(written.join("")).toContain("numpy");
      expect(written.join("")).toContain("unavailable");
    });

    it("declines when the terminal cannot host an interactive mode", async () => {
      const result = await pythonCommand(
        [],
        context({ rawArgs: "", enterLineMode: undefined }),
      );

      expect(result.success).toBe(false);
      expect(enterLineMode).not.toHaveBeenCalled();
    });

    it("does not enter the REPL when the interpreter fails to boot", async () => {
      ensureReady.mockRejectedValue(new Error("out of memory"));

      const result = await pythonCommand([], context({ rawArgs: "" }));

      expect(result.success).toBe(false);
      expect(enterLineMode).not.toHaveBeenCalled();
    });
  });

  it("declines when the terminal cannot stream output", async () => {
    await setMissing();

    const result = await pythonCommand(
      ["print(1)"],
      context({ rawArgs: "print(1)", writer: undefined }),
    );

    expect(result.success).toBe(false);
    expect(ensureReady).not.toHaveBeenCalled();
  });
});
