import { describe, it, expect, afterEach, vi } from "vitest";
import {
  acquireOverlay,
  getSnapshot,
  resetMotionGateForTests,
  setMotionTier,
  subscribe,
} from "./motion-gate";

/**
 * The page-wide half of the motion gate: hidden tab and open overlays suspend
 * decorative motion, and the state is mirrored onto <html data-motion> so CSS
 * animations can pause without React.
 */

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => {
  resetMotionGateForTests();
  // Drop the own property so the prototype getter shows through again.
  delete (document as { visibilityState?: string }).visibilityState;
});

describe("motion gate", () => {
  it("starts running and marks <html> once something subscribes", () => {
    subscribe(() => {});

    expect(getSnapshot().suspended).toBe(false);
    expect(document.documentElement.dataset.motion).toBe("running");
  });

  it("suspends while an overlay is open, and counts nested overlays", () => {
    subscribe(() => {});
    const releaseSplash = acquireOverlay();
    const releaseModal = acquireOverlay();
    expect(getSnapshot().suspended).toBe(true);
    expect(document.documentElement.dataset.motion).toBe("suspended");

    releaseSplash();
    expect(getSnapshot().suspended).toBe(true);

    releaseModal();
    expect(getSnapshot().suspended).toBe(false);
    expect(document.documentElement.dataset.motion).toBe("running");
  });

  it("ignores a second release of the same overlay", () => {
    const releaseA = acquireOverlay();
    const releaseB = acquireOverlay();
    releaseA();
    releaseA();

    expect(getSnapshot().overlays).toBe(1);
    releaseB();
    expect(getSnapshot().overlays).toBe(0);
  });

  it("suspends while the tab is hidden", () => {
    subscribe(() => {});

    setVisibility("hidden");
    expect(getSnapshot().suspended).toBe(true);

    setVisibility("visible");
    expect(getSnapshot().suspended).toBe(false);
  });

  it("notifies subscribers only when something changes", () => {
    const listener = vi.fn();
    subscribe(listener);

    setMotionTier("low");
    setMotionTier("low");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getSnapshot().tier).toBe("low");
  });

  it("stops notifying after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    unsubscribe();

    acquireOverlay();
    expect(listener).not.toHaveBeenCalled();
  });
});
