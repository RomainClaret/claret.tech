import { describe, it, expect, vi } from "vitest";

vi.mock("next/og", () => ({ ImageResponse: class {} }));

import * as route from "./route";

/**
 * The social preview image has no input: it is the same picture for every
 * request. On the Edge runtime, which Next 16 deprecates, it was drawn again
 * on each request, since Edge turns static generation off. On the Node.js
 * runtime a route handler is still dynamic unless it says otherwise, so it
 * asks to be built once, at build time.
 */
describe("the og-image route", () => {
  it("runs on the Node.js runtime", () => {
    expect("runtime" in route).toBe(false);
  });

  it("is built once, at build time", () => {
    expect(route.dynamic).toBe("force-static");
  });
});
