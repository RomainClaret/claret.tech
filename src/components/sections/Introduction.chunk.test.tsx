import { describe, it, expect, vi } from "vitest";
import { act, render } from "@testing-library/react";
import React from "react";

/**
 * The hero's brains load in a chunk of their own, on every visit. When that
 * cannot be fetched, their box keeps its loading placeholder, so the hero
 * keeps its layout. React.lazy threw while rendering, and the page's error
 * boundary (error.tsx) replaced everything under the navigation.
 */

type Loader = () => Promise<React.ComponentType<Record<string, unknown>>>;
type Options = { loading: () => React.ReactNode };

// next/dynamic's arguments, to run the loaders as it would.
const dynamicCalls = vi.hoisted(
  () => [] as Array<{ load: Loader; options: Options }>,
);
vi.mock("next/dynamic", () => ({
  default: (load: Loader, options: Options) => {
    dynamicCalls.push({ load, options });
    return () => null;
  },
}));

// The brains' chunk cannot be fetched: every import of it fails.
const brainImports = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/components/ui/dual-brain-animation", () => {
  brainImports.count++;
  throw new Error("Loading chunk 9814 failed.");
});

import "./Introduction";

describe("The hero's brains, when their chunk cannot be fetched", () => {
  it("keep their loading placeholder instead of throwing", async () => {
    // Declared first in Introduction.tsx; the PDF reader's comes second.
    const { load, options } = dynamicCalls[0];

    // Resolves: a rejection here is what reached the error boundary.
    const Brains = await load();
    let view: ReturnType<typeof render> | undefined;
    await act(async () => {
      view = render(<Brains isVisible />); // tries again on mount
    });

    const loading = render(<>{options.loading()}</>).container.innerHTML;
    expect(loading).toContain("h-[200px]"); // the brains' placeholder
    expect(view!.container.innerHTML).toBe(loading);
    expect(brainImports.count).toBe(2); // the first load and the try
  });
});
