import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, act, renderHook } from "@testing-library/react";
import {
  useAnimationGate,
  useMotionGate,
  useOverlayLock,
} from "./useMotionGate";
import {
  acquireOverlay,
  resetMotionGateForTests,
  setMotionTier,
} from "@/lib/utils/motion-gate";

/**
 * The per-element half of the gate: a decorative loop runs only while its
 * element is near the viewport and nothing page-wide (hidden tab, overlay,
 * battery tier) says stop.
 */

const animationState = vi.hoisted(() => ({ playing: true }));
vi.mock("@/contexts/animation-state-context", () => ({
  useAnimationStateOptional: () => ({
    areAnimationsPlaying: animationState.playing,
  }),
}));

const reducedMotion = vi.hoisted(() => ({ value: false }));
vi.mock("@/lib/hooks/useReducedMotion", () => ({
  useReducedMotion: () => reducedMotion.value,
}));

// A controllable IntersectionObserver: tests decide what is in view.
// `deliver` hands over several entries in one callback, oldest first, as the
// browser does for every crossing queued since the callback last ran.
let deliver: (states: boolean[]) => void = () => {};
const intersect = (isIntersecting: boolean) => deliver([isIntersecting]);
const OriginalIntersectionObserver = globalThis.IntersectionObserver;

beforeEach(() => {
  animationState.playing = true;
  reducedMotion.value = false;
  globalThis.IntersectionObserver = class {
    constructor(callback: IntersectionObserverCallback) {
      deliver = (states) =>
        act(() =>
          callback(
            states.map(
              (isIntersecting) =>
                ({ isIntersecting }) as IntersectionObserverEntry,
            ),
            this as unknown as IntersectionObserver,
          ),
        );
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  globalThis.IntersectionObserver = OriginalIntersectionObserver;
  resetMotionGateForTests();
});

function Gated({ onState }: { onState: (active: boolean) => void }) {
  const { ref, active } = useAnimationGate();
  onState(active);
  return <div ref={ref} />;
}

function renderGated() {
  const states: boolean[] = [];
  render(<Gated onState={(active) => states.push(active)} />);
  return () => states[states.length - 1];
}

describe("useAnimationGate", () => {
  it("runs only while its element is in view", () => {
    const active = renderGated();
    expect(active()).toBe(false);

    intersect(true);
    expect(active()).toBe(true);

    intersect(false);
    expect(active()).toBe(false);
  });

  it("follows the newest entry when several arrive at once", () => {
    // After a long task during a fast scroll, one callback can carry a
    // crossing and its reversal. The first entry is the stale one.
    const active = renderGated();

    deliver([true, false]); // came into view and left again
    expect(active()).toBe(false);

    deliver([false, true]); // left and came back
    expect(active()).toBe(true);
  });

  it("stops while an overlay covers the page", () => {
    const active = renderGated();
    intersect(true);

    let release = () => {};
    act(() => {
      release = acquireOverlay();
    });
    expect(active()).toBe(false);

    act(() => release());
    expect(active()).toBe(true);
  });

  it("stops at the battery tier", () => {
    const active = renderGated();
    intersect(true);

    act(() => setMotionTier("battery"));
    expect(active()).toBe(false);

    act(() => setMotionTier("low"));
    expect(active()).toBe(true);
  });

  it("stops when animations are switched off or reduced motion is asked for", () => {
    animationState.playing = false;
    const switchedOff = renderGated();
    intersect(true);
    expect(switchedOff()).toBe(false);

    animationState.playing = true;
    reducedMotion.value = true;
    const reduced = renderGated();
    intersect(true);
    expect(reduced()).toBe(false);
  });

  it("counts the element as in view where IntersectionObserver is missing", () => {
    // @ts-expect-error - simulating an environment without the API
    globalThis.IntersectionObserver = undefined;
    const active = renderGated();
    expect(active()).toBe(true);
  });
});

describe("useOverlayLock", () => {
  it("suspends the page while open and releases on close and unmount", () => {
    const gate = renderHook(() => useMotionGate());
    const lock = renderHook(({ open }) => useOverlayLock(open), {
      initialProps: { open: true },
    });
    expect(gate.result.current.suspended).toBe(true);

    lock.rerender({ open: false });
    expect(gate.result.current.suspended).toBe(false);

    lock.rerender({ open: true });
    expect(gate.result.current.suspended).toBe(true);
    lock.unmount();
    expect(gate.result.current.suspended).toBe(false);
  });
});
