/**
 * Background Context Tests
 *
 * The provider and hook, plus generation itself, which runs with a seeded
 * Math.random that gives up after a fixed number of draws (see countDraws).
 */
import { createHash } from "node:crypto";
import { act, render, screen, renderHook } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { BackgroundProvider, useBackground } from "./background-context";
import {
  renderHookWithErrorBoundary,
  expectHookError,
} from "../test/error-test-utils";

// Minimal test component that doesn't trigger generation
function TestBackgroundComponent() {
  const context = useBackground();

  return (
    <div>
      <div data-testid="has-background-data">
        {context.backgroundData !== null ? "true" : "false"}
      </div>
      <div data-testid="has-generate-function">
        {typeof context.generateBackgroundData === "function"
          ? "true"
          : "false"}
      </div>
    </div>
  );
}

// Note: Component that would test hook error removed as it's tested via renderHook

describe("BackgroundContext - Essential Tests", () => {
  describe("BackgroundProvider", () => {
    it("renders children without crashing", () => {
      render(
        <BackgroundProvider>
          <div data-testid="child">Test Child</div>
        </BackgroundProvider>,
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByTestId("child")).toHaveTextContent("Test Child");
    });

    it("provides context value to children", () => {
      render(
        <BackgroundProvider>
          <TestBackgroundComponent />
        </BackgroundProvider>,
      );

      expect(screen.getByTestId("has-background-data")).toHaveTextContent(
        "false",
      );
      expect(screen.getByTestId("has-generate-function")).toHaveTextContent(
        "true",
      );
    });
  });

  describe("useBackground Hook", () => {
    it("throws error when used outside provider", () => {
      // ⚠️ INTENTIONAL ERROR TEST - The following stderr error is expected and proves
      // our error handling infrastructure works correctly. This is a success indicator.
      console.info(
        "⚠️ Expected error test: useBackground hook error validation",
      );

      // Using our custom error testing utilities that properly handle
      // React hook errors with error boundaries and custom environment
      const { getError } = renderHookWithErrorBoundary(() => useBackground(), {
        expectError: true,
      });

      expectHookError(getError(), {
        message: "useBackground must be used within a BackgroundProvider",
        type: Error as new (...args: unknown[]) => Error,
      });
    });

    it("returns context interface when used inside provider", () => {
      const { result } = renderHook(() => useBackground(), {
        wrapper: BackgroundProvider,
      });

      expect(result.current).toHaveProperty("backgroundData");
      expect(result.current).toHaveProperty("generateBackgroundData");
      expect(typeof result.current.generateBackgroundData).toBe("function");
      expect(result.current.backgroundData).toBeNull();
    });

    it("provides stable function reference", () => {
      const { result, rerender } = renderHook(() => useBackground(), {
        wrapper: BackgroundProvider,
      });

      const firstFunction = result.current.generateBackgroundData;

      rerender();

      const secondFunction = result.current.generateBackgroundData;

      expect(firstFunction).toBe(secondFunction);
    });
  });

  describe("Context Interface", () => {
    it("provides correct TypeScript interface", () => {
      const { result } = renderHook(() => useBackground(), {
        wrapper: BackgroundProvider,
      });

      // Verify properties exist and have correct types
      expect(result.current.backgroundData).toBeNull();
      expect(typeof result.current.generateBackgroundData).toBe("function");
      expect(result.current.generateBackgroundData.length).toBe(3);
    });

    it("maintains context consistency", () => {
      const { result, rerender } = renderHook(() => useBackground(), {
        wrapper: BackgroundProvider,
      });

      const initialData = result.current.backgroundData;
      const initialFunction = result.current.generateBackgroundData;

      rerender();

      expect(result.current.backgroundData).toBe(initialData);
      expect(result.current.generateBackgroundData).toBe(initialFunction);
    });
  });

  describe("Provider Stability", () => {
    it("handles provider unmounting cleanly", () => {
      const { unmount } = render(
        <BackgroundProvider>
          <TestBackgroundComponent />
        </BackgroundProvider>,
      );

      expect(() => unmount()).not.toThrow();
    });

    it("supports multiple provider instances", () => {
      render(
        <div>
          <BackgroundProvider>
            <div data-testid="provider-1">
              <TestBackgroundComponent />
            </div>
          </BackgroundProvider>
          <BackgroundProvider>
            <div data-testid="provider-2">
              <TestBackgroundComponent />
            </div>
          </BackgroundProvider>
        </div>,
      );

      expect(screen.getByTestId("provider-1")).toBeInTheDocument();
      expect(screen.getByTestId("provider-2")).toBeInTheDocument();
    });
  });

  describe("Error Boundaries", () => {
    it("hook error doesn't crash provider", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Provider should work fine even after hook errors elsewhere
      render(
        <BackgroundProvider>
          <TestBackgroundComponent />
        </BackgroundProvider>,
      );

      expect(screen.getByTestId("has-background-data")).toHaveTextContent(
        "false",
      );

      consoleSpy.mockRestore();
    });
  });
});

describe("ensureBackgroundData", () => {
  // At a real viewport size: one generation there takes about a millisecond.
  it("generates a background where none exists", () => {
    const { result } = renderHook(() => useBackground(), {
      wrapper: BackgroundProvider,
    });

    act(() => result.current.ensureBackgroundData(1440, 900, 64));

    expect(result.current.backgroundData?.nodes.length).toBeGreaterThan(0);
  });

  it("leaves a background the hero already generated alone", () => {
    // On / the hero generates first; a second one drew a different random
    // background over it while the splash still covered the page.
    const { result } = renderHook(() => useBackground(), {
      wrapper: BackgroundProvider,
    });
    act(() => result.current.generateBackgroundData(1440, 900, 64));
    const first = result.current.backgroundData;

    act(() => result.current.ensureBackgroundData(1440, 900, 64));

    expect(result.current.backgroundData).toBe(first);
  });
});

// Generation draws from Math.random. The tests below replay a seeded
// sequence (mulberry32) in its place, so the same draws can be repeated.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A generation takes a few hundred draws. It is synchronous, so a placement
// loop that never ends would block vitest's own timeout and hang the run;
// past this many draws the stand-in throws instead, and the test fails.
const DRAW_BUDGET = 100_000;

/**
 * Runs `draw` with Math.random returning `leading` first, then the seeded
 * sequence. Returns how many values it drew.
 */
function countDraws(
  seed: number,
  draw: () => void,
  leading: number[] = [],
): number {
  const next = mulberry32(seed);
  const queue = [...leading];
  let draws = 0;
  const random = vi.spyOn(Math, "random").mockImplementation(() => {
    draws += 1;
    if (draws > DRAW_BUDGET) {
      throw new Error(`Math.random drawn ${DRAW_BUDGET} times: no end`);
    }
    return queue.shift() ?? next();
  });
  try {
    act(draw);
  } finally {
    random.mockRestore();
  }
  return draws;
}

function renderBackground() {
  return renderHook(() => useBackground(), { wrapper: BackgroundProvider })
    .result;
}

describe("generateBackgroundData", () => {
  // 15 to 25 nodes, each in a 64 px cell of its own. Some viewports have
  // fewer cells than that: 400% zoom on a 1366x768 laptop leaves about
  // 342x159, 18 cells. The search for a free cell then ran out of them and
  // never returned, which froze the tab.
  it.each([
    [100, 100, 4],
    [256, 192, 12],
    [342, 159, 18],
  ])("puts a node in each of a %ix%i viewport's %i cells", (w, h, cells) => {
    const background = renderBackground();
    const generate = () => background.current.generateBackgroundData(w, h, 64);

    // 0.99 first asks for the most nodes: 15 + floor(0.99 * 11) = 25.
    countDraws(1, generate, [0.99]);

    const cols = Math.ceil(w / 64);
    const everyCell = Array.from(
      { length: cells },
      (_, i) => `${i % cols},${Math.floor(i / cols)}`,
    );
    const nodes = background.current.backgroundData?.nodes ?? [];
    expect(nodes).toHaveLength(cells);
    expect(new Set(nodes.map(({ x, y }) => `${x},${y}`))).toEqual(
      new Set(everyCell),
    );
  });

  it("draws nothing for a viewport with no area, and draws once it has one", () => {
    // At 0x0 every draw landed in cell 0,0, so the second node never found
    // a free one.
    const background = renderBackground();

    countDraws(1, () => background.current.ensureBackgroundData(0, 0, 64));
    expect(background.current.backgroundData).toBeNull();

    // Nothing was drawn, so a later call still draws.
    countDraws(1, () => background.current.ensureBackgroundData(1440, 900, 64));
    expect(background.current.backgroundData?.nodes.length).toBeGreaterThan(0);
  });

  // Recorded before the node count was capped by the cells (4f0f120): where
  // generation finished then, the same draws still give the same backgrounds,
  // field for field. The hash covers fifty seeds per size: every background
  // and how many draws it took.
  it.each([
    ["1440x900", 1440, 900, "3bd5049204b3b3e6"],
    ["1920x1080", 1920, 1080, "1b8f38fb76cae5c0"],
    ["390x844", 390, 844, "d5e13f65c5fd7ff8"],
    ["320x568", 320, 568, "478b2630f83d7806"],
    // As many cells as the most nodes: every seed finished.
    ["320x320", 320, 320, "bbdee73a53d74770"],
    // 18 cells: only the seeds that asked for 18 nodes or fewer finished.
    ["342x159", 342, 159, "30ba01aeed8d7477"],
  ])("draws the same backgrounds as before at %s", (_, w, h, recorded) => {
    const cells = Math.ceil(w / 64) * Math.ceil(h / 64);
    const seeds = Array.from({ length: 50 }, (_, i) => i + 1).filter(
      (seed) => 15 + Math.floor(mulberry32(seed)() * 11) <= cells,
    );
    const background = renderBackground();

    const runs = seeds.map((seed) => ({
      seed,
      draws: countDraws(seed, () =>
        background.current.generateBackgroundData(w, h, 64),
      ),
      data: background.current.backgroundData,
    }));

    const hash = createHash("sha256").update(JSON.stringify(runs));
    expect(hash.digest("hex").slice(0, 16)).toBe(recorded);
  });
});
