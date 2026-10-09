import { describe, it, expect, afterEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useScrollSection } from "./useScrollSection";

/**
 * `sections` used to return the hardcoded homepage list regardless of what was
 * in the document, so FloatingNav rendered a full section rail on /pdf/<slug>
 * where none of those sections exist and every control was dead.
 */

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useScrollSection", () => {
  it("reports no sections on a page that has none", async () => {
    const { result } = renderHook(() => useScrollSection());

    await waitFor(() => expect(result.current.isInitialized).toBe(true));
    expect(result.current.sections).toEqual([]);
  });

  it("reports only the sections present in the document", async () => {
    for (const id of ["home", "research", "contact"]) {
      const el = document.createElement("section");
      el.id = id;
      document.body.appendChild(el);
    }

    const { result } = renderHook(() => useScrollSection());

    await waitFor(() =>
      expect(result.current.sections.length).toBeGreaterThan(0),
    );
    // In the canonical order, not the order they happened to be found.
    expect(result.current.sections).toEqual(["home", "research", "contact"]);
  });
  it("re-renders only when what it reports changes", async () => {
    // A fresh state object and section list on every scroll event used to
    // re-render the floating navigation on each one.
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    vi.stubGlobal("cancelAnimationFrame", () => {});
    try {
      const home = document.createElement("section");
      home.id = "home";
      document.body.appendChild(home);
      let renders = 0;
      const { result } = renderHook(() => {
        renders++;
        return useScrollSection();
      });
      await waitFor(() => expect(result.current.isInitialized).toBe(true));
      const settled = renders;

      act(() => {
        for (let i = 0; i < 5; i++) window.dispatchEvent(new Event("scroll"));
      });
      // Five events, one detection.
      expect(frames).toHaveLength(1);
      act(() => frames.splice(0).forEach((callback) => callback(0)));

      // Three more frames of scrolling that change nothing it reports.
      for (let frame = 0; frame < 3; frame++) {
        act(() => {
          window.dispatchEvent(new Event("scroll"));
        });
        act(() => frames.splice(0).forEach((callback) => callback(0)));
      }

      // React may call a component once while bailing out of an update that
      // changes nothing; it does not re-render it per frame, as a new state
      // object on every scroll did.
      expect(renders - settled).toBeLessThanOrEqual(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
