import { describe, it, expect } from "vitest";
import { generateStructuredData } from "./structured-data";
import { socialMediaLinks } from "@/data/portfolio";

/**
 * The Person schema's sameAs is what search engines use to tie the site to
 * one person across profiles. It used to be a hand-kept copy that pointed at
 * an ORCID record that does not exist, so it now comes from the same social
 * links the site renders.
 */
describe("Person schema sameAs", () => {
  const graph = generateStructuredData()["@graph"] as Array<{
    "@type": string;
    sameAs?: string[];
  }>;
  const person = graph.find((node) => node["@type"] === "Person") as {
    sameAs: string[];
  };

  it("uses the social links the site shows", () => {
    expect(person.sameAs).toEqual([
      socialMediaLinks.github,
      socialMediaLinks.linkedin,
      socialMediaLinks.medium,
      socialMediaLinks.orcid,
      socialMediaLinks.stackoverflow,
      socialMediaLinks.gitlab,
    ]);
  });

  it("points at the ORCID record that exists, not the dead one", () => {
    expect(person.sameAs).toContain("https://orcid.org/0000-0002-5612-8471");
    expect(person.sameAs.join(" ")).not.toContain("6872-7815");
  });
});
