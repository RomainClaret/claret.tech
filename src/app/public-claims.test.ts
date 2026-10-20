import { describe, it, expect } from "vitest";
import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { footerNote } from "@/data/sections/metadata";
import { WEBLLM_CONFIG } from "@/lib/webllm/config";

/**
 * Small claims the site makes to visitors, held to what it does (round 25
 * found several wrong). The bigger ones have their own tests: the CSP's
 * hosts (src/lib/security-headers.test.ts), no cookies and no other hosts
 * (tests/e2e/privacy.spec.ts).
 */

const policy = readFileSync(join(process.cwd(), "PRIVACY-POLICY.md"), "utf8");

describe("what the site tells visitors", () => {
  it("links 'Hosted on Vercel' to Vercel", () => {
    // It linked to the site's GitHub repository.
    expect(new URL(footerNote.hosturl).hostname).toBe("vercel.com");
  });

  it("names the services the server fetches from, and no other", () => {
    // It named Kudos, which the server stopped scraping in round 26, and
    // not Crossref or rss2json.com (Medium's feed), which it contacts. A
    // host in the server's code stands for a request to it.
    const services: Record<string, string> = {
      "api.github.com": "GitHub",
      "api.semanticscholar.org": "Semantic Scholar",
      "pub.orcid.org": "ORCID",
      "api.crossref.org": "Crossref",
      "medium.com": "Medium",
      "api.rss2json.com": "rss2json",
      "growkudos.com": "Kudos",
    };
    const server = globSync("src/{lib,app}/**/*.ts")
      .filter((file) => !/\.test\.ts$/.test(file))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    const start = policy.indexOf("This site's server makes");
    const sentence = policy.slice(start, policy.indexOf(";", start));

    for (const [host, name] of Object.entries(services)) {
      expect(sentence.includes(name), name).toBe(server.includes(host));
    }
  });

  it("gives a model size range that holds every model the AI chat offers", () => {
    // The default model is 0.70 GB on Hugging Face; the site said 0.5.
    const range = /Models range from about ([\d.]+) to ([\d.]+) GB/.exec(
      policy,
    );
    if (!range) throw new Error("the policy no longer gives the range");
    const [low, high] = [Number(range[1]), Number(range[2])];
    const sizes = WEBLLM_CONFIG.models.map((model) => parseFloat(model.size));

    expect(Math.min(...sizes)).toBe(low);
    expect(Math.max(...sizes)).toBe(high);
  });
});
