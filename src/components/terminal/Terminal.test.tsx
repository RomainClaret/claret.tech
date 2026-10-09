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
  const instances: { parent: HTMLElement | null; disposed: boolean }[] = [];
  class FakeTerminal {
    cols = 80;
    rows = 24;
    parent: HTMLElement | null = null;
    disposed = false;
    constructor() {
      instances.push(this);
    }
    open(parent: HTMLElement) {
      this.parent = parent;
    }
    loadAddon() {}
    write() {}
    writeln() {}
    clear() {}
    focus() {}
    onData() {
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

vi.mock("@/lib/terminal/terminal-context", () => ({
  MIN_SIZE: { width: 400, height: 300 },
  useTerminal: () => ({
    windowState: "normal",
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
vi.mock("@/lib/terminal/commands", () => ({
  executeCommand: async () => ({ output: "" }),
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
