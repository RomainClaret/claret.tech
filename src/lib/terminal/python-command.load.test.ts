import { describe, it, expect, vi } from "vitest";
import type { CommandContext } from "./commands";

/**
 * The Python terminal's code loads on first use. A failed load (a chunk a
 * deploy removed, a dropped connection) was cached, so every later
 * `python` in that tab failed until a reload. Its own file: the import has
 * to fail once and then work, which the main file's mocks cannot do.
 */

const load = vi.hoisted(() => ({ failures: 1 }));

vi.mock("@/lib/python/repl-mode", () => {
  if (load.failures > 0) {
    load.failures--;
    throw new Error("Failed to fetch dynamically imported module");
  }
  return {
    createPythonRepl: vi.fn(),
    pythonBanner: () => "",
  };
});

vi.mock("@/lib/python/pyodide-client", () => ({
  pythonClient: {
    get generation() {
      return 0;
    },
    ensureReady: vi.fn(async () => ({
      python: "3.14.2",
      pyodide: "314.0.7",
      missing: [],
    })),
    run: vi.fn(async () => ({ status: "ok", truncated: false })),
    interrupt: vi.fn(),
    clearBlock: vi.fn(),
    shutdown: vi.fn(),
  },
  detectRequiredPackages: () => [],
}));

const context = () =>
  ({
    currentDirectory: "/",
    currentUser: "guest",
    setCurrentDirectory: vi.fn(),
    setCurrentUser: vi.fn(),
    addToHistory: vi.fn(),
    clearTerminal: vi.fn(),
    closeTerminal: vi.fn(),
    writer: () => {},
    rawArgs: "print(1)",
  }) as unknown as CommandContext;

describe("python command, when its code fails to load", () => {
  it("says to reload, and loads again on the next try", async () => {
    const { pythonCommand } = await import("./python-command");

    const first = await pythonCommand(["print(1)"], context());
    const second = await pythonCommand(["print(1)"], context());

    // Vitest wraps the factory's error in its own words; the shape is what
    // matters: the failure, then the advice.
    expect(first.success).toBe(false);
    expect(first.output).toMatch(
      /^python: .+\. Reload the page to try again\.$/,
    );
    expect(second.success).toBe(true);
  });
});
