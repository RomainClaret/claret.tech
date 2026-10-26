import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachTouchScroll, type TouchScrollTarget } from "./touch-scroll";

const ROW = 20;

/** An xterm stand-in: 100 lines of scrollback, its view at the bottom. */
function fakeTerminal() {
  const active = { viewportY: 100, baseY: 100 };
  const scrolled: number[] = [];
  const term: TouchScrollTarget = {
    rows: 24,
    scrollLines(amount: number) {
      scrolled.push(amount);
      active.viewportY = Math.min(
        active.baseY,
        Math.max(0, active.viewportY + amount),
      );
    },
    buffer: { active },
  };
  return { term, active, scrolled };
}

/** A touch event as the page sees it; jsdom has no Touch to build one with. */
function touch(type: string, ys: number[], at: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: ys.map((clientY) => ({ clientY })),
  });
  Object.defineProperty(event, "timeStamp", { value: at });
  return event;
}

describe("attachTouchScroll", () => {
  let element: HTMLElement;
  let terminal: ReturnType<typeof fakeTerminal>;
  let detach: () => void;
  const lines = () => terminal.scrolled.reduce((sum, n) => sum + n, 0);
  const fire = (type: string, ys: number[], at: number) => {
    const event = touch(type, ys, at);
    element.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
    });
    element = document.createElement("div");
    terminal = fakeTerminal();
    detach = attachTouchScroll(element, terminal.term, () => ROW);
  });

  afterEach(() => {
    detach();
    vi.useRealTimers();
  });

  it("moves the lines under a finger, a line a row, and keeps the page still", () => {
    terminal.active.viewportY = 50;
    fire("touchstart", [300], 0);

    // Down by three rows and a half: back three lines.
    const down = fire("touchmove", [370], 400);
    expect(lines()).toBe(-3);
    expect(down.defaultPrevented).toBe(true);
    // Up by two rows and a half from there, half a row still pending the
    // other way: forward two.
    fire("touchmove", [320], 800);
    expect(lines()).toBe(-1);
    // Slow: lifted, the lines stay where the finger left them.
    fire("touchend", [], 1200);
    vi.advanceTimersByTime(1000);
    expect(lines()).toBe(-1);
  });

  it("leaves two fingers to the browser's zoom, and a tap alone", () => {
    fire("touchstart", [300, 400], 0);
    const pinch = fire("touchmove", [250, 450], 50);
    expect(pinch.defaultPrevented).toBe(false);

    fire("touchstart", [300], 100);
    fire("touchend", [], 150);
    vi.advanceTimersByTime(1000);
    expect(terminal.scrolled).toEqual([]);
  });

  it("glides on after a flick, slower and slower, until the end", () => {
    // This flick (5 px a ms) glides about 80 lines: 40 end it early.
    terminal.active.baseY = 40;
    terminal.active.viewportY = 0;
    fire("touchstart", [600], 0);
    fire("touchmove", [500], 20);
    fire("touchmove", [400], 40);
    fire("touchend", [], 40);
    const atLift = lines();
    expect(atLift).toBe(10);

    vi.advanceTimersByTime(100);
    const early = lines() - atLift;
    vi.advanceTimersByTime(100);
    const later = lines() - atLift - early;
    expect(early).toBeGreaterThan(later);
    expect(later).toBeGreaterThan(0);

    vi.advanceTimersByTime(5000);
    expect(terminal.active.viewportY).toBe(terminal.active.baseY);
    const atEnd = terminal.scrolled.length;
    vi.advanceTimersByTime(1000);
    expect(terminal.scrolled.length).toBe(atEnd);
  });

  it("stops a glide at the next touch, and after a cancelled one", () => {
    terminal.active.viewportY = 0;
    fire("touchstart", [600], 0);
    fire("touchmove", [400], 40);
    fire("touchend", [], 40);
    vi.advanceTimersByTime(50);

    fire("touchstart", [300], 100);
    const held = lines();
    vi.advanceTimersByTime(1000);
    expect(lines()).toBe(held);

    fire("touchmove", [100], 140);
    fire("touchcancel", [], 140);
    const cancelled = lines();
    vi.advanceTimersByTime(1000);
    expect(lines()).toBe(cancelled);
  });

  it("lets go of the element when detached", () => {
    detach();
    fire("touchstart", [300], 0);
    const move = fire("touchmove", [200], 20);
    expect(move.defaultPrevented).toBe(false);
    expect(terminal.scrolled).toEqual([]);
  });
});
