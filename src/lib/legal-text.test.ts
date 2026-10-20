import { describe, it, expect } from "vitest";
import { legalText, type LegalFile } from "./legal-text";

describe("legalText", () => {
  it("fails without its file, so the build does, rather than serve a copy", () => {
    expect(() => legalText("MISSING-POLICY.md" as LegalFile)).toThrow(/ENOENT/);
  });

  it("renders the markdown it reads", () => {
    const { content, html } = legalText("TERMS-OF-SERVICE.md");

    expect(content).toMatch(/^# /);
    expect(html).toMatch(/^<h1[^>]*>/);
  });
});
