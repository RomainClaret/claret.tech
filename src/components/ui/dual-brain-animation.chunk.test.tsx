import { describe, it, expect, vi } from "vitest";
import { act, render } from "@testing-library/react";
import React from "react";

/**
 * Each of the hero's brains draws on a canvas whose code loads in a chunk of
 * its own, on every visit. When that cannot be fetched, each brain's box
 * keeps its loading placeholder. React.lazy threw while rendering, and the
 * page's error boundary (error.tsx) replaced everything under the
 * navigation.
 */

type Loader = () => Promise<React.ComponentType<Record<string, unknown>>>;
type Options = { loading: () => React.ReactNode };

// next/dynamic's arguments, to run the loader as it would.
const dynamicCalls = vi.hoisted(
  () => [] as Array<{ load: Loader; options: Options }>,
);
vi.mock("next/dynamic", () => ({
  default: (load: Loader, options: Options) => {
    dynamicCalls.push({ load, options });
    return () => null;
  },
}));

// The canvas's chunk cannot be fetched: every import of it fails.
const canvasImports = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/components/ui/brain-network-visualization", () => {
  canvasImports.count++;
  throw new Error("Loading chunk 1937 failed.");
});

import "./dual-brain-animation";

describe("The brains' canvas, when its chunk cannot be fetched", () => {
  it("keeps its loading placeholder instead of throwing", async () => {
    const [{ load, options }] = dynamicCalls;

    // Resolves: a rejection here is what reached the error boundary.
    const Canvas = await load();
    let view: ReturnType<typeof render> | undefined;
    await act(async () => {
      view = render(<Canvas width={300} height={300} />); // tries again
    });

    const loading = render(<>{options.loading()}</>).container.innerHTML;
    expect(view!.container.innerHTML).toBe(loading);
    expect(canvasImports.count).toBe(2); // the first load and the try
  });
});
