import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as route from "./route";

/**
 * The legal text's route, read once when the site is built: it serves the
 * file at the repository's root, with its HTML, and nothing written into
 * its code. A fallback copy there had drifted from the file and was never
 * shown (round 25).
 */
describe("/api/terms-of-service", () => {
  it("is built once, with the site", () => {
    expect(route.dynamic).toBe("force-static");
  });

  it("serves TERMS-OF-SERVICE.md and the HTML its modal shows", async () => {
    const body = (await route.GET().json()) as {
      content: string;
      html: string;
    };

    expect(body.content).toBe(
      readFileSync(join(process.cwd(), "TERMS-OF-SERVICE.md"), "utf8"),
    );
    expect(body.html).toMatch(/^<h1[^>]*>/);
    expect(Object.keys(body).sort()).toEqual(["content", "html"]);
  });
});
