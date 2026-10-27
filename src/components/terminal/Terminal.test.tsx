import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import React from "react";

/**
 * The terminal downloads xterm when it opens. A user who closes it and opens
 * it again before that download lands has two loads in play: the first one,
 * for an open that no longer exists, must not finish the second open's job
 * for it, or the terminal shows up initialized around an xterm the first
 * load has already thrown away.
 */

// A stand-in xterm whose download a test holds until it releases it.
const xterm = vi.hoisted(() => {
  type KeyHandler = (event: KeyboardEvent) => boolean;
  type DataHandler = (data: string) => void;
  const instances: {
    parent: HTMLElement | null;
    disposed: boolean;
    keyHandler: KeyHandler | null;
    dataHandler: DataHandler | null;
    writes: string[];
    scrolled: number[];
  }[] = [];
  class FakeTerminal {
    cols = 80;
    rows = 24;
    parent: HTMLElement | null = null;
    disposed = false;
    keyHandler: KeyHandler | null = null;
    dataHandler: DataHandler | null = null;
    writes: string[] = [];
    scrolled: number[] = [];
    buffer = { active: { viewportY: 0, baseY: 0 } };
    constructor() {
      instances.push(this);
    }
    open(parent: HTMLElement) {
      this.parent = parent;
    }
    attachCustomKeyEventHandler(handler: KeyHandler) {
      this.keyHandler = handler;
    }
    loadAddon() {}
    write(text: string) {
      this.writes.push(text);
    }
    writeln(text = "") {
      this.writes.push(`${text}\n`);
    }
    clear() {}
    focus() {}
    scrollLines(amount: number) {
      this.scrolled.push(amount);
    }
    onData(handler: DataHandler) {
      this.dataHandler = handler;
      return { dispose() {} };
    }
    dispose() {
      this.disposed = true;
    }
  }
  let release = () => {};
  const downloaded = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { FakeTerminal, instances, downloaded, release: () => release() };
});
vi.mock("@xterm/xterm", async () => {
  await xterm.downloaded;
  return { Terminal: xterm.FakeTerminal };
});
vi.mock("@xterm/addon-fit", () => ({
  FitAddon: class {
    fit() {}
  },
}));
vi.mock("@xterm/addon-web-links", () => ({ WebLinksAddon: class {} }));
vi.mock("@xterm/xterm/css/xterm.css", () => ({}));

// A test can minimize the window; every other test sees it normal.
const terminalWindow = vi.hoisted(() => ({
  state: "normal" as "normal" | "minimized" | "maximized",
}));
vi.mock("@/lib/terminal/terminal-context", () => ({
  MIN_SIZE: { width: 400, height: 300 },
  useTerminal: () => ({
    windowState: terminalWindow.state,
    position: { x: 0, y: 0 },
    size: { width: 800, height: 500 },
    currentUser: "guest",
    setPosition: () => {},
    setSize: () => {},
    setCurrentUser: () => {},
    minimize: () => {},
    maximize: () => {},
    restore: () => {},
    isDragging: false,
    setIsDragging: () => {},
  }),
}));
// A test that types a command can take its context and hold its result.
const commands = vi.hoisted(() => ({
  run: null as null | ((command: string, context: unknown) => Promise<unknown>),
}));
vi.mock("@/lib/terminal/commands", () => ({
  executeCommand: (command: string, context: unknown) =>
    commands.run
      ? commands.run(command, context)
      : Promise.resolve({ output: "" }),
  getCompletions: () => [],
}));
vi.mock("@/lib/hooks/useResizableWithHandles", () => ({
  useResizableWithHandles: () => ({ startResize: () => {} }),
}));
vi.mock("./ResizeHandles", () => ({ ResizeHandles: () => null }));
vi.mock("@/data/portfolio", () => ({
  terminalConfig: { welcomeMessages: [] },
}));
vi.mock("@/lib/hooks/useSafari", () => ({
  useShouldReduceAnimations: () => false,
}));
const python = vi.hoisted(() => ({ shutdowns: 0 }));
vi.mock("@/lib/python/pyodide-client", () => ({
  pythonClient: {
    shutdown: async () => {
      python.shutdowns++;
    },
  },
}));

import { Terminal } from "./Terminal";

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

/** Let the imports in flight land, and the code awaiting them run. */
const settle = () =>
  act(async () => {
    await vi.dynamicImportSettled();
  });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Terminal load", () => {
  it("opens a live terminal when it was closed and reopened mid-download", async () => {
    const view = render(<Terminal isOpen onClose={() => {}} />);
    advance(200); // the load starts; xterm is still downloading

    view.rerender(<Terminal isOpen={false} onClose={() => {}} />);
    view.rerender(<Terminal isOpen onClose={() => {}} />);
    xterm.release(); // lands before the reopened terminal's own try
    await settle();

    advance(200); // the reopened terminal's try
    await settle();

    const live = xterm.instances.filter((term) => !term.disposed);
    expect(live).toHaveLength(1);
    expect(live[0].parent?.isConnected).toBe(true);
    expect(screen.queryByText("Loading terminal...")).not.toBeInTheDocument();
  });

  it("leaves the Python client alone when it mounts closed", async () => {
    // withLoadFallback can hand over the terminal after the visitor closed
    // the error box. Nothing ran, so nothing needs shutting down.
    python.shutdowns = 0;
    render(<Terminal isOpen={false} onClose={() => {}} />);
    await settle();

    expect(python.shutdowns).toBe(0);
  });

  it("still shuts Python down when a terminal that was open closes", async () => {
    python.shutdowns = 0;
    const view = render(<Terminal isOpen onClose={() => {}} />);
    view.rerender(<Terminal isOpen={false} onClose={() => {}} />);
    await settle();

    expect(python.shutdowns).toBe(1);
  });
});

describe("Terminal keys", () => {
  it("lets Escape through to the page", async () => {
    // xterm cancels Escape at its textarea, so the performance panels the
    // terminal opens, which close on Escape through document and window
    // listeners ("Press ESC to close"), never heard it.
    xterm.release();
    render(<Terminal isOpen onClose={() => {}} />);
    advance(200);
    await settle();

    const handler = xterm.instances.at(-1)?.keyHandler;
    expect(handler).toBeTypeOf("function");
    const press = (init: KeyboardEventInit, type = "keydown") =>
      handler!(new KeyboardEvent(type, init));
    // false: xterm skips the key and leaves the event alone.
    expect(press({ key: "Escape" })).toBe(false);
    expect(press({ key: "Escape", altKey: true })).toBe(false);
    // Everything else stays the terminal's.
    expect(press({ key: "Escape" }, "keyup")).toBe(true);
    expect(press({ key: "Escape", isComposing: true })).toBe(true);
    for (const init of [
      { key: "Tab" },
      { key: "Enter" },
      { key: "a" },
      { key: "ArrowUp" },
      { key: "c", ctrlKey: true },
    ]) {
      expect(press(init)).toBe(true);
    }
  });
});

describe("Terminal wheel", () => {
  afterEach(() => {
    terminalWindow.state = "normal";
  });

  /** Whether the window cancelled a wheel at `target`, as the page sees it. */
  const wheel = (target: Element, init: WheelEventInit = {}) => {
    const event = new WheelEvent("wheel", {
      deltaY: 100,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it("keeps a wheel over the window from the page, all but a zoom", () => {
    // The page behind scrolled on any wheel xterm had no lines for: before
    // any scrollback, past either end of it, and over the title bar.
    render(<Terminal isOpen onClose={() => {}} />);

    expect(wheel(screen.getByLabelText("Terminal output"))).toBe(true);
    expect(wheel(screen.getByTestId("terminal-header"))).toBe(true);
    // Ctrl and a wheel, or a trackpad pinch, zooms the page.
    expect(wheel(screen.getByTestId("terminal"), { ctrlKey: true })).toBe(
      false,
    );
  });

  it("leaves the wheel to the page while minimized to its title bar", () => {
    terminalWindow.state = "minimized";
    render(<Terminal isOpen onClose={() => {}} />);

    expect(wheel(screen.getByTestId("terminal-header"))).toBe(false);
  });

  it("scrolls the lines from a wheel on the title bar, as a finger does", async () => {
    xterm.release();
    render(<Terminal isOpen onClose={() => {}} />);
    advance(200);
    await settle();
    const term = xterm.instances.at(-1)!;
    const header = screen.getByTestId("terminal-header");

    // 100 px at a row of 17 (jsdom draws nothing to measure): 5 lines, and
    // the 15 px left over wait for the next wheel.
    expect(wheel(header)).toBe(true);
    expect(term.scrolled).toEqual([5]);
    // On xterm's own lines xterm scrolls them; the window holds the page.
    expect(wheel(screen.getByLabelText("Terminal output"))).toBe(true);
    expect(term.scrolled).toEqual([5]);
    // A wheel counted in lines (deltaMode 1): three lines, the 15 px kept.
    wheel(header, { deltaY: 3, deltaMode: 1 });
    expect(term.scrolled).toEqual([5, 3]);
    // Ctrl and a wheel zooms, and scrolls nothing.
    wheel(header, { ctrlKey: true });
    expect(term.scrolled).toEqual([5, 3]);
  });
});

describe("Terminal commands", () => {
  afterEach(() => {
    commands.run = null;
  });

  it("takes no more output from a command that Ctrl+C cancelled", async () => {
    // The terminal draws "Command canceled by user" and a new prompt, but
    // the command could still write: python went on booting and printed
    // "Downloading CPython..." after that prompt.
    let writer: ((text: string) => void) | undefined;
    commands.run = (_command, context) => {
      writer = (context as { writer?: (text: string) => void }).writer;
      return new Promise(() => {});
    };
    xterm.release();
    render(<Terminal isOpen onClose={() => {}} />);
    advance(200);
    await settle();
    const term = xterm.instances.at(-1)!;
    const type = (data: string) =>
      act(() => {
        for (const char of data) term.dataHandler!(char);
      });

    type("python\r");
    expect(writer).toBeTypeOf("function");
    act(() => writer!("while running"));
    expect(term.writes.join("")).toContain("while running");

    type("\u0003");
    expect(term.writes.join("")).toContain("Command canceled by user");
    act(() => writer!("after the cancel"));

    expect(term.writes.join("")).not.toContain("after the cancel");
  });

  it("echoes a paste without its control sequences", async () => {
    // A paste arrives as one chunk and was echoed raw: its escape sequences
    // cleared the screen or hid a link (security audit run 1, hardening).
    xterm.release();
    render(<Terminal isOpen onClose={() => {}} />);
    advance(200);
    await settle();
    const term = xterm.instances.at(-1)!;
    const before = term.writes.length;

    act(() => {
      term.dataHandler!(
        "ls\u001b[2J\u001b]8;;https://evil.example\u0007here\u001b]8;;\u0007\u009b2J",
      );
    });

    const echoed = term.writes.slice(before).join("");
    expect(echoed).toContain("ls");
    expect(echoed).not.toContain("\u001b[2J");
    expect(echoed).not.toContain("\u001b]8");
    expect(echoed).not.toContain("\u009b");
  });
});
