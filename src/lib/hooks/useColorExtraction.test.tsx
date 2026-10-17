import { describe, it, expect, vi } from "vitest";
import { render, renderHook } from "@testing-library/react";

/**
 * Conference logos that changed under the same name carry a ?v= version in
 * their URL (conference-logos.ts), so returning visitors fetch the new file.
 * Their colors are precomputed by path; looked up with the version, they
 * missed, and the hook loaded ColorThief to extract them at runtime.
 */

const colorThief = vi.hoisted(() => ({ loaded: false }));
vi.mock("colorthief", () => {
  colorThief.loaded = true;
  return { default: class {} };
});

import { useColorExtraction } from "./useColorExtraction";

describe("useColorExtraction", () => {
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
});
