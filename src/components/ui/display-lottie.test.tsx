import { describe, it, expect, vi } from "vitest";
import { act, render } from "@testing-library/react";
import React from "react";

/**
 * The splash's animation player loads in a chunk of its own. When that
 * cannot be fetched, the animation's box keeps its loading placeholder and
 * the splash plays on. React.lazy threw while rendering, and the error
 * boundary around the whole site, the splash's nearest, replaced the page.
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

// The player's chunk cannot be fetched: every import of it fails.
const playerImports = vi.hoisted(() => ({ count: 0 }));
vi.mock("lottie-react", () => {
  playerImports.count++;
  throw new Error("Loading chunk 1800 failed.");
});

import "./display-lottie";

describe("DisplayLottie's player, when its chunk cannot be fetched", () => {
  it("keeps the loading placeholder instead of throwing", async () => {
    const [{ load, options }] = dynamicCalls;

    // Resolves: a rejection here is what reached the error boundary.
    const Player = await load();
    let view: ReturnType<typeof render> | undefined;
    await act(async () => {
      view = render(<Player animationData={{}} />); // tries again on mount
    });

    const loading = render(<>{options.loading()}</>).container.innerHTML;
    expect(view!.container.innerHTML).toBe(loading);
    expect(playerImports.count).toBe(2); // the first load and the try
  });
});
