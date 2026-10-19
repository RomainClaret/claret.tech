import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";

/**
 * .gitignore listed seven files the repository tracks: lighthouse.config.js,
 * .actrc, the act secrets example, three docs and the Medium color map. Git
 * keeps a tracked file whatever the rules say, but the tools that read the
 * rules do not: ripgrep left those files out of every search, and act and a
 * fresh `git init` of an archive dropped them (round 19's Tailwind trial lost
 * its .actrc that way). A rule must not match a file the repository keeps.
 */
const git = (...args: string[]) =>
  spawnSync("git", args, { cwd: process.cwd(), encoding: "utf8" });

// A `git archive` copy, such as the Linux container's, has no repository.
const inCheckout =
  git("rev-parse", "--is-inside-work-tree").stdout?.trim() === "true";

describe(".gitignore", () => {
  it.skipIf(!inCheckout)("matches no file the repository tracks", () => {
    const listed = git(
      "ls-files",
      "--cached",
      "--ignored",
      "--exclude-standard",
    );

    expect(listed.status).toBe(0);
    expect(listed.stdout.split("\n").filter(Boolean)).toEqual([]);
  });
});
