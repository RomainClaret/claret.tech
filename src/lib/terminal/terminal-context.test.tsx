import { describe, it, expect, vi } from "vitest";
import { act, render } from "@testing-library/react";
import React from "react";
import {
  TerminalProvider,
  useTerminal,
  useTerminalToggle,
} from "./terminal-context";

/**
 * The navigation and AppWrapper only need to know whether the terminal is
 * open. They read a context of their own, so a drag, which moves the window
 * 60-120 times a second, re-renders the terminal alone.
 */

type Move = (position: { x: number; y: number }) => void;

describe("TerminalProvider", () => {
  it("leaves open-state readers alone while the window moves", () => {
    let toggleRenders = 0;
    let move: Move = () => {};
    const ToggleReader = () => {
      toggleRenders++;
      useTerminalToggle();
      return null;
    };
    const WindowReader = () => {
      move = useTerminal().setPosition;
      return null;
    };
    render(
      <TerminalProvider>
        <ToggleReader />
        <WindowReader />
      </TerminalProvider>,
    );
    const settled = toggleRenders;

    act(() => move({ x: 120, y: 140 }));
    act(() => move({ x: 130, y: 150 }));

    expect(toggleRenders).toBe(settled);
  });

  it("tells open-state readers when the terminal opens and closes", () => {
    let isOpen = false;
    let toggle = () => {};
    const ToggleReader = () => {
      ({ isOpen, toggleTerminal: toggle } = useTerminalToggle());
      return null;
    };
    render(
      <TerminalProvider>
        <ToggleReader />
      </TerminalProvider>,
    );

    act(() => toggle());
    expect(isOpen).toBe(true);
    act(() => toggle());
    expect(isOpen).toBe(false);
  });

  it("reads the stored window state once, not on every render", () => {
    const getItem = vi.spyOn(window.localStorage, "getItem");
    let move: Move = () => {};
    const WindowReader = () => {
      move = useTerminal().setPosition;
      return null;
    };
    render(
      <TerminalProvider>
        <WindowReader />
      </TerminalProvider>,
    );

    act(() => move({ x: 120, y: 140 }));
    act(() => move({ x: 130, y: 150 }));

    const reads = getItem.mock.calls.filter(
      ([key]) => key === "terminal-state",
    );
    expect(reads).toHaveLength(1);
  });
});
