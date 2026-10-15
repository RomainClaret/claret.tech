import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ResearchMapRenderer } from "./research-map-renderer";

// The terminal's window, as the renderer sees it.
const terminal = vi.hoisted(() => ({
  isOpen: true,
  setAside: (() => {}) as (aside: boolean) => void,
  minimize: () => {},
}));
vi.mock("@/lib/terminal/terminal-context", () => ({
  useTerminal: () => terminal,
}));

// The lazily loaded dialog stands in as a plain one with its two exits.
vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function Map({ onClose }: { onClose: (reason: string) => void }) {
      return (
        <div role="dialog" aria-label="Research map">
          <button type="button" onClick={() => onClose("dismiss")}>
            Close
          </button>
          <button type="button" onClick={() => onClose("navigate")}>
            Show on page
          </button>
        </div>
      );
    },
}));

const send = (type: string, detail?: object) =>
  act(() => {
    window.dispatchEvent(new CustomEvent(type, { detail }));
  });
const open = () =>
  send("terminal-research-map", { token: "abc", timestamp: Date.now() });

beforeEach(() => {
  terminal.isOpen = true;
  terminal.setAside = vi.fn();
  terminal.minimize = vi.fn();
});

describe("ResearchMapRenderer", () => {
  it("opens the map on the terminal's research command, with a fresh token", () => {
    render(<ResearchMapRenderer />);
    expect(screen.queryByRole("dialog")).toBeNull();

    open();

    expect(screen.getByRole("dialog", { name: "Research map" })).toBeTruthy();
  });

  it("ignores an open without a token, or with a stale one", () => {
    render(<ResearchMapRenderer />);

    send("terminal-research-map");
    send("terminal-research-map", { timestamp: Date.now() });
    send("terminal-research-map", {
      token: "abc",
      timestamp: Date.now() - 11000,
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(terminal.setAside).not.toHaveBeenCalled();
  });

  it("closes on research close, and from the dialog itself", () => {
    render(<ResearchMapRenderer />);
    open();

    send("terminal-research-close");
    expect(screen.queryByRole("dialog")).toBeNull();

    open();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("puts the terminal aside while the map is open, and gives it back with the focus", async () => {
    // Above every dialog, the terminal covered the map and took its clicks.
    const input = document.createElement("textarea");
    input.className = "xterm-helper-textarea";
    document.body.appendChild(input);
    render(<ResearchMapRenderer />);

    open();
    expect(vi.mocked(terminal.setAside).mock.calls).toEqual([[true]]);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(vi.mocked(terminal.setAside).mock.calls).toEqual([[true], [false]]);
    expect(terminal.minimize).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(input));
    input.remove();
  });

  it("gives the terminal back minimized when the map leaves for a card", () => {
    render(<ResearchMapRenderer />);
    open();

    fireEvent.click(screen.getByRole("button", { name: "Show on page" }));

    expect(vi.mocked(terminal.setAside).mock.calls).toEqual([[true], [false]]);
    expect(terminal.minimize).toHaveBeenCalledTimes(1);
  });

  it("leaves a closed terminal alone", () => {
    terminal.isOpen = false;
    render(<ResearchMapRenderer />);

    open();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(terminal.setAside).not.toHaveBeenCalled();
    expect(terminal.minimize).not.toHaveBeenCalled();
  });

  it("stops listening once it is gone", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<ResearchMapRenderer />);

    unmount();

    const types = (calls: unknown[][]) =>
      calls
        .map(([type]) => type)
        .filter((type) => String(type).includes("research"));
    expect(types(remove.mock.calls).sort()).toEqual(
      types(add.mock.calls).sort(),
    );
    expect(types(add.mock.calls)).toHaveLength(2);
  });
});
