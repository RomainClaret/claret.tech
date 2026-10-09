import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadBackoff, saveBackoff } from "./backoff";
import { isBlocked, initialQualityState } from "./decide";
import { QualityMode } from "./mode";
import { memoryStorage } from "@/test/memory-storage";

/**
 * The loop's backoff, kept for the session next to its tier, so a reload
 * does not wipe what failed and retry it at once.
 */

beforeEach(() => {
  vi.stubGlobal("sessionStorage", memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("quality backoff storage", () => {
  it("brings back what was saved, a tier closed for good included", () => {
    saveBackoff({
      demotions: {
        [QualityMode.MAXIMUM]: { count: 2, blockedUntil: 360_000 },
        [QualityMode.BALANCED]: { count: Infinity, blockedUntil: Infinity },
      },
      recoverTo: QualityMode.BALANCED,
      lastToastAt: 120_000,
    });

    const loaded = loadBackoff();
    const state = { ...initialQualityState(QualityMode.LOW), ...loaded };

    expect(loaded.demotions[QualityMode.MAXIMUM]).toEqual({
      count: 2,
      blockedUntil: 360_000,
    });
    expect(loaded.recoverTo).toBe(QualityMode.BALANCED);
    expect(loaded.lastToastAt).toBe(120_000);
    // JSON has no Infinity; what stands in for it still blocks forever.
    expect(isBlocked(state, QualityMode.BALANCED, 10 ** 15)).toBe(true);
  });

  it("starts clean with nothing saved, or nothing usable", () => {
    expect(loadBackoff()).toEqual({
      demotions: {},
      recoverTo: null,
      lastToastAt: 0,
    });

    sessionStorage.setItem("quality-backoff", "{not json");
    expect(loadBackoff()).toEqual({
      demotions: {},
      recoverTo: null,
      lastToastAt: 0,
    });

    sessionStorage.setItem(
      "quality-backoff",
      JSON.stringify({
        demotions: {
          maximum: { count: "1", blockedUntil: 5 }, // count not a number
          ultra: { count: 1, blockedUntil: 5 }, // not a tier
          balanced: { count: 1, blockedUntil: 9 },
        },
        recoverTo: "ultra",
        lastToastAt: "yesterday",
      }),
    );
    expect(loadBackoff()).toEqual({
      demotions: { balanced: { count: 1, blockedUntil: 9 } },
      recoverTo: null,
      lastToastAt: 0,
    });
  });
});
