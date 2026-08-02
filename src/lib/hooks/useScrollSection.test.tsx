import { describe, it, expect, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
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
});
