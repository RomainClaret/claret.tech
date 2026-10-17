import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * GitHub CI runs the unit tests through the npm scripts ci.yml names, and the
 * component jobs pass vitest explicit file lists, not folders. A test file
 * missing from every list never runs on GitHub, while the local test:ci,
 * which passes folders, runs it and stays green. Seven files were in that
 * state: the five research-map ones and SocialLinks (rounds 12 and 13), and
 * status-colors (2026-10-11). One list also named a file deleted in round 12,
 * which vitest skips without a word.
 *
 * Vitest reads a positional argument as a filter that matches any test file
 * whose path contains it, and --exclude as a glob from the project root.
 */

const root = process.cwd();
const scripts: Record<string, string> = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
).scripts;
const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");

/** The globs the scripts use: `**` spans folders, `*` stays inside one. */
const glob = (pattern: string) =>
  new RegExp(
    "^" +
      pattern
        .split(/(\*\*\/|\*\*|\*)/)
        .map((part) =>
          part === "**/"
            ? "(?:.*/)?"
            : part === "**"
              ? ".*"
              : part === "*"
                ? "[^/]*"
                : part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"),
        )
        .join("") +
      "$",
  );

interface Run {
  script: string;
  filters: string[];
  excludes: RegExp[];
}

const unquote = (arg: string) => arg.replace(/^(['"])(.*)\1$/, "$2");

/** The vitest runs behind a script, through any `npm run` it chains. */
function runsOf(script: string): Run[] {
  const command = scripts[script];
  if (!command) throw new Error(`ci.yml runs a missing script: ${script}`);
  const chained = [...command.matchAll(/npm run ([\w:-]+)/g)];
  if (chained.length > 0) return chained.flatMap((match) => runsOf(match[1]));

  const start = command.indexOf("vitest run");
  if (start === -1) return [];
  const args =
    command.slice(start + "vitest run".length).match(/'[^']*'|"[^"]*"|\S+/g) ??
    [];
  const run: Run = { script, filters: [], excludes: [] };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--exclude") run.excludes.push(glob(unquote(args[++i])));
    else if (!args[i].startsWith("-")) run.filters.push(unquote(args[i]));
  }
  return [run];
}

const runs = [...ci.matchAll(/npm run (test:[\w:-]+)/g)].flatMap((match) =>
  runsOf(match[1]),
);

function testFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules") return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return testFiles(path);
    return /\.test\.tsx?$/.test(entry.name) ? [relative(root, path)] : [];
  });
}

const runsFile = (run: Run, file: string) =>
  run.filters.some((filter) => file.includes(filter)) &&
  !run.excludes.some((exclude) => exclude.test(file));

describe("the unit tests GitHub CI runs", () => {
  it("reads the test scripts ci.yml names", () => {
    expect(runs.length).toBeGreaterThan(5);
  });

  it("runs every unit test file in src", () => {
    const files = testFiles(join(root, "src"));
    expect(files.length).toBeGreaterThan(100);

    expect(
      files.filter((file) => !runs.some((run) => runsFile(run, file))),
    ).toEqual([]);
  });

  it("lists only test files that exist", () => {
    const listed = runs.flatMap((run) =>
      run.filters.filter((filter) => /\.test\.tsx?$/.test(filter)),
    );

    expect(listed.filter((file) => !existsSync(join(root, file)))).toEqual([]);
  });
});
