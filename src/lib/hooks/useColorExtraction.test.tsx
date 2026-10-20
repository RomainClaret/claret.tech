import { afterEach, describe, it, expect, vi } from "vitest";
import { render, renderHook, waitFor } from "@testing-library/react";

/**
 * Conference logos that changed under the same name carry a ?v= version in
 * their URL (conference-logos.ts), so returning visitors fetch the new file.
 * Their colors are precomputed by path; looked up with the version, they
 * missed, and the hook loaded ColorThief to extract them at runtime.
 */

const colorThief = vi.hoisted(() => ({ loaded: false, getColorSync: vi.fn() }));
vi.mock("colorthief", () => {
  colorThief.loaded = true;
  return { getColorSync: colorThief.getColorSync };
});

import { useColorExtraction } from "./useColorExtraction";

describe("useColorExtraction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("finds a versioned logo's precomputed color, without ColorThief", () => {
    const { result } = renderHook(() =>
      useColorExtraction("/images/wcci_2026_logo.webp?v=2", "rgb(0, 0, 0)"),
    );

    expect(result.current).toEqual({
      color: "rgb(8, 40, 88)",
      isLoading: false,
    });
    expect(colorThief.loaded).toBe(false);
  });

  it("has the table's colour from the first render", () => {
    // The table's colour arrived in an effect, after a first render in the
    // fallback colour: the prerendered HTML, and a page without scripts,
    // showed every Experience and Education card in the fallback.
    const seen: string[] = [];
    function Card() {
      seen.push(
        useColorExtraction("/images/unine_logo.webp", "rgb(1, 2, 3)").color,
      );
      return null;
    }
    render(<Card />);

    expect(seen[0]).toBe("rgb(0, 102, 255)");
    expect(seen).not.toContain("rgb(1, 2, 3)");
  });

  it("loads no remote image: the color stays the fallback", async () => {
    // Medium's and the Kudos card's Unsplash images were loaded from the
    // visitor's browser for their color: an undisclosed third party.
    const made: unknown[] = [];
    vi.stubGlobal(
      "Image",
      class {
        constructor() {
          made.push(this);
        }
      },
    );

    const { result } = renderHook(() =>
      useColorExtraction(
        "https://images.unsplash.com/photo.jpg",
        "rgb(1, 2, 3)",
      ),
    );

    await waitFor(() =>
      expect(result.current).toEqual({
        color: "rgb(1, 2, 3)",
        isLoading: false,
      }),
    );
    expect(made).toEqual([]);
    expect(colorThief.loaded).toBe(false);
  });

  // Last: it loads colorthief, which the first test says a precomputed image
  // never does.
  it("extracts an unknown image's color as colorthief 2 did", async () => {
    // jsdom loads no images; this one loads as soon as it gets a source.
    class LoadingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = "";
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("Image", LoadingImage);
    colorThief.getColorSync.mockReturnValue({ array: () => [100, 150, 200] });

    const { result } = renderHook(() =>
      useColorExtraction("/images/not-precomputed.jpg", "rgb(0, 0, 0)"),
    );

    await waitFor(() =>
      expect(result.current).toEqual({
        color: "rgb(100, 150, 200)",
        isLoading: false,
      }),
    );
    // RGB, not version 3's default OKLCH, which changes the colors.
    expect(colorThief.getColorSync).toHaveBeenCalledWith(
      expect.any(LoadingImage),
      { colorCount: 5, quality: 10, colorSpace: "rgb" },
    );
  });
});
