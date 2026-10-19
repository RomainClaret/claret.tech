import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * postinstall copies node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs
 * into public/ (scripts/setup-assets.js), and pdf.js refuses a worker of another
 * version than its API ("The API version ... does not match the Worker
 * version"). pdfjs-dist arrived only as react-pdf's dependency, so the copy
 * read whichever pdfjs-dist npm hoisted. It is listed at react-pdf's exact
 * version now, which keeps that path on the version react-pdf runs.
 */

const read = (path: string) =>
  JSON.parse(readFileSync(join(process.cwd(), path), "utf8"));

describe("the pdf.js worker postinstall copies", () => {
  it("comes from the pdfjs-dist react-pdf runs", () => {
    const listed = read("package.json").dependencies["pdfjs-dist"];
    const wanted = read("node_modules/react-pdf/package.json").dependencies[
      "pdfjs-dist"
    ];
    const installed = read("node_modules/pdfjs-dist/package.json").version;

    expect(listed).toBe(wanted);
    expect(installed).toBe(wanted);
  });

  // The reader runs pdf.js's legacy build (next.config.mjs aliases
  // pdfjs-dist to it), for the oldest browsers in the browserslist, and so
  // must its worker: the default build's calls URL.parse and
  // Promise.withResolvers without a polyfill too.
  it("is the legacy build's, as the reader's pdf.js is", () => {
    const file = (path: string) => readFileSync(join(process.cwd(), path));
    const copied = file("public/pdf.worker.min.mjs");
    const legacy = file(
      "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    );

    expect(copied.equals(legacy)).toBe(true);
  });
});
