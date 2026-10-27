import { describe, expect, it } from "vitest";
import * as page from "./page";

describe("/pdf/[slug]", () => {
  // With Next's default (true), any /pdf/<x> was rendered on request and its
  // 404 kept in the cache under that path, with no bound on the paths a
  // caller can name (security audit run 1, lead 13). The registry is static
  // data, so no document appears without a rebuild.
  it("renders only the documents the registry lists", () => {
    expect(page.dynamicParams).toBe(false);
  });
});
