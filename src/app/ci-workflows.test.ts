import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * What the GitHub workflows run, read from the YAML. Each case here is a
 * check that passed while it checked nothing.
 */

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const scripts: Record<string, string> = JSON.parse(
  read("package.json"),
).scripts;
const workflows = readdirSync(join(root, ".github/workflows"))
  .filter((name) => name.endsWith(".yml"))
  .map((name) => ({ name, text: read(`.github/workflows/${name}`) }));
const workflow = (name: string) =>
  workflows.find((file) => file.name === name)?.text ?? "";

/** A file, or a folder with a file somewhere in it. */
const hasFiles = (path: string): boolean =>
  existsSync(path) &&
  (!statSync(path).isDirectory() ||
    readdirSync(path).some((entry) => hasFiles(join(path, entry))));

/** The paths a dorny/paths-filter filter lists, comments left out. */
function filterPaths(text: string, filter: string): string[] {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === `${filter}:`);
  if (start === -1) return [];
  const indent = lines[start].search(/\S/);
  const paths: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    if (line.search(/\S/) <= indent) break;
    paths.push(
      line
        .trim()
        .replace(/^- /, "")
        .replace(/^'(.*)'$/, "$1"),
    );
  }
  return paths;
}

/** The keys of every `env:` block, an anchored one (`env: &name`) too. */
function envKeys(text: string): string[] {
  const lines = text.split("\n");
  return lines.flatMap((line, index) => {
    if (!/^\s*env:(?:\s+&[\w-]+)?\s*$/.test(line)) return [];
    const indent = line.search(/\S/);
    const keys: string[] = [];
    for (const next of lines.slice(index + 1)) {
      if (next.trim() === "" || next.trim().startsWith("#")) continue;
      if (next.search(/\S/) <= indent) break;
      const key = next.match(/^\s*([A-Z_][A-Z0-9_]*):/)?.[1];
      if (key) keys.push(key);
    }
    return keys;
  });
}

/** Every script file under a folder: JavaScript, TypeScript and shell. */
function scriptsUnder(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return scriptsUnder(path);
      return /\.(?:[cm]?js|tsx?|sh)$/.test(entry.name) ? [path] : [];
    },
  );
}

/** A job's `if:` block. */
function jobCondition(text: string, job: string): string {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line === `  ${job}:`);
  const at = lines.findIndex(
    (line, index) => index > start && line.trim().startsWith("if:"),
  );
  const indent = lines[at].search(/\S/);
  const block = [lines[at]];
  for (const line of lines.slice(at + 1)) {
    if (line.trim() !== "" && line.search(/\S/) <= indent) break;
    block.push(line);
  }
  return block.join("\n");
}

describe("the GitHub workflows", () => {
  it("check the format without rewriting the files", () => {
    // `npm run format -- --check` ran `prettier --write ... --check`, and
    // Prettier sets no failing exit code when --write is on: the check
    // rewrote CI's copy, printed "Code style issues fixed" and passed.
    const prettierRuns = workflows.flatMap(({ name, text }) =>
      [...text.matchAll(/npm run ([\w:-]+)(.*)/g)]
        .filter(([, script]) => /\bprettier\b/.test(scripts[script] ?? ""))
        .map(([, script, extra]) => ({
          where: `${name}: npm run ${script}${extra}`,
          command: `${scripts[script]}${extra}`,
        })),
    );

    expect(prettierRuns.length).toBeGreaterThan(0);
    expect(
      prettierRuns
        .filter(({ command }) => /--write/.test(command))
        .map(({ where }) => where),
    ).toEqual([]);
    expect(
      prettierRuns
        .filter(({ command }) => !/--check/.test(command))
        .map(({ where }) => where),
    ).toEqual([]);
  });

  it("build and test a change under scripts/", () => {
    // postinstall and prebuild run scripts/ and next.config imports one, so
    // a change there alone can break every job, and no filter named it.
    const ci = workflow("ci.yml");
    const e2e = workflow("playwright.yml");

    expect(filterPaths(ci, "source")).toContain("scripts/**");
    expect(filterPaths(ci, "has-code-changes")).toContain("scripts/**");
    expect(filterPaths(e2e, "src")).toContain("scripts/**");
  });

  it("build and test a change under patches/", () => {
    // npm ci applies patches/ to node_modules (scripts/apply-patches.mjs,
    // in the postinstall): a patch changes what every job builds and tests.
    const ci = workflow("ci.yml");
    const e2e = workflow("playwright.yml");

    expect(filterPaths(ci, "source")).toContain("patches/**");
    expect(filterPaths(ci, "has-code-changes")).toContain("patches/**");
    expect(filterPaths(e2e, "dependencies")).toContain("patches/**");
  });

  it("spend no time on steps that buy nothing", () => {
    // Every ci.yml job deleted the runner's Android and .NET SDKs before
    // npm ci: 53 to 193 s a job in run 37233882629 (2026-10-04), more than
    // npm ci and the tests took, with 103 GB still free after it and
    // node_modules at 0.9 GB. Ten jobs cached two folders Vitest 5 never
    // writes (it keeps node_modules/.vite/vitest/<hash>/results.json), and
    // the build job saved a .next that nothing restored.
    for (const { name, text } of workflows) {
      expect(text, name).not.toMatch(
        /rm -rf \/usr\/(?:local\/lib\/android|share\/dotnet)/,
      );
      expect(text, name).not.toMatch(
        /\.vitest-cache|node_modules\/\.cache\/vitest/,
      );
    }
    expect(workflow("ci.yml")).not.toMatch(/^\s*path: \.next\s*$/m);
  });

  it("run the phone suite on any change to the site", () => {
    // Its own filter matched only files named *mobile* (one, never
    // rendered), so the whole-page 320 px reflow test skipped most changes.
    expect(jobCondition(workflow("playwright.yml"), "mobile-tests")).toMatch(
      /outputs\.src == 'true'/,
    );
  });

  it("run every end-to-end spec in a job", () => {
    // Each Playwright job names its spec files, so a new spec runs in no job
    // until one names it, as with the unit batches (ci-test-lists.test.ts).
    const commands = [
      ...workflow("playwright.yml").matchAll(
        /npx playwright test ((?:[^\n\\]|\\\n)*)/g,
      ),
    ].map((match) => match[1]);
    const run = new Set(
      commands.flatMap((command) =>
        [...command.matchAll(/tests\/e2e\/[\w.-]+\.spec\.ts/g)].map(
          (spec) => spec[0],
        ),
      ),
    );
    const specs = readdirSync(join(root, "tests/e2e"))
      .filter((name) => name.endsWith(".spec.ts"))
      .map((name) => `tests/e2e/${name}`);

    expect(specs.length).toBeGreaterThan(10);
    expect(specs.filter((spec) => !run.has(spec))).toEqual([]);
  });

  it("leave the act copy of CI to act", () => {
    // ci-act.yml exists for running CI locally with act, and it also ran
    // on every GitHub push and pull request, beside ci.yml: each push ran
    // the unit suites twice.
    const triggers = workflow("ci-act.yml").match(/^on:\n((?:[ #].*\n|\n)*)/m);

    expect(triggers?.[1]).toMatch(/^\s+workflow_dispatch:/m);
    expect(triggers?.[1]).not.toMatch(/^\s+(push|pull_request):/m);
  });

  it("name only paths that exist", () => {
    // A filter or cache key that names a missing path changes nothing and
    // reads as coverage: src/hooks (the hooks are in src/lib/hooks) and
    // src/components/layout had never existed. A folder counts only with a
    // file in it: git keeps no empty folder, so CI's checkout has none.
    const named = workflows.flatMap(({ name, text }) => [
      ...[...text.matchAll(/^\s+- '([^']+)'/gm)].map((match) => ({
        name,
        path: match[1],
      })),
      ...[...text.matchAll(/hashFiles\(([^)]*)\)/g)].flatMap((match) =>
        [...match[1].matchAll(/'([^']+)'/g)].map((path) => ({
          name,
          path: path[1],
        })),
      ),
    ]);
    const missing = named.filter(({ path }) => {
      const wildcard = path.search(/[*{]/);
      const literal = wildcard === -1 ? path : path.slice(0, wildcard);
      const checked =
        wildcard === -1
          ? literal
          : literal.slice(0, literal.lastIndexOf("/") + 1);
      return checked !== "" && !hasFiles(join(root, checked));
    });

    expect(named.length).toBeGreaterThan(30);
    expect(missing.map(({ name, path }) => `${name}: ${path}`)).toEqual([]);
  });

  it("run the Node major package.json names, and a supported one", () => {
    // Every workflow ran Node 20, end of life since 2026-04-30, including
    // the production build in deploy.yml, while engines allowed any Node
    // from 20 up.
    const engines: string = JSON.parse(read("package.json")).engines.node;
    const major = engines.match(/^(\d+)\.x$/)?.[1];
    const used = [
      ...workflows.flatMap(({ name, text }) =>
        [...text.matchAll(/(?:NODE_VERSION|node-version): ['"]?(\d+)/g)].map(
          (match) => `${name}: ${match[1]}`,
        ),
      ),
      ...[...read(".actrc").matchAll(/=node:(\d+)-/g)].map(
        (match) => `.actrc: ${match[1]}`,
      ),
      // nvm's pick on the Mac: Node 25's npm 11.6.2 once wrote a lockfile
      // that CI's npm refused (round 15).
      `.nvmrc: ${existsSync(join(root, ".nvmrc")) ? read(".nvmrc").trim() : "missing"}`,
    ];

    expect(Number(major)).toBeGreaterThanOrEqual(24);
    expect(used.length).toBeGreaterThan(5);
    expect(used.filter((entry) => !entry.endsWith(`: ${major}`))).toEqual([]);
  });

  it("check for code nothing imports", () => {
    // Lint sees neither an export no file imports nor a file no import
    // reaches: rounds 14 to 16 found over 2,000 such lines by hand.
    const quickChecks = workflow("ci.yml").match(
      /\n {2}quick-checks:\n[\s\S]*?\n {2}# Phase 3/,
    )?.[0];

    expect(scripts.knip).toBe("knip");
    expect(quickChecks).toMatch(/check: \[[^\]]*\bknip\b[^\]]*\]/);
    expect(quickChecks).toMatch(/knip\)\s*\n\s*npm run knip/);
  });

  it("lint the workflows themselves", () => {
    // A workflow's mistakes showed only when a run failed, and twelve
    // unquoted variables sat in three workflows unnoticed. actionlint
    // checks syntax, expressions and the shell of every run step, from an
    // image pinned by digest.
    const quickChecks = workflow("ci.yml").match(
      /\n {2}quick-checks:\n[\s\S]*?\n {2}# Phase 3/,
    )?.[0];

    expect(scripts["lint:workflows"]).toMatch(
      /^docker run .*rhysd\/actionlint:\d+\.\d+\.\d+@sha256:[0-9a-f]{64}\b/,
    );
    expect(quickChecks).toMatch(/check: \[[^\]]*\bactionlint\b[^\]]*\]/);
    expect(quickChecks).toMatch(/actionlint\)\s*\n\s*npm run lint:workflows/);
  });

  it("build previews with production's env", () => {
    // The preview job's build got none of production's env (no GitHub
    // token, no USE_GITHUB_DATA, no Medium account), so a preview could
    // differ from what production would build. Both build steps now share
    // one block: an anchor in the preview job, an alias in production's.
    const lines = workflow("deploy.yml").split("\n");
    const jobOf = (index: number) =>
      lines
        .slice(0, index)
        .reverse()
        .find((line) => /^ {2}[a-z-]+:\s*$/.test(line))
        ?.trim();
    const buildEnvs = lines.flatMap((line, index) => {
      const value = line.match(/^\s+env:\s*(\S*)\s*$/)?.[1];
      const step = lines
        .slice(0, index)
        .reverse()
        .find((before) => /^\s+- name:/.test(before));
      return value !== undefined && /Build Project Artifacts/.test(step ?? "")
        ? [`${jobOf(index)} ${value}`]
        : [];
    });

    expect(buildEnvs).toEqual([
      "deploy-preview: &build-env",
      "deploy-production: *build-env",
    ]);
  });

  it("give the build what the /profile.json snapshot needs", () => {
    // src/app/profile.json/route.ts saves the pinned repositories at build
    // time, for Projects to read when the API fails. It needs the token, the
    // switch and an account. The workflow never passed an account (round 16
    // deleted the unused GH_USERNAME secret); the build could only find
    // Vercel's copy through `vercel pull`, and only if Vercel stores it as
    // Config (a Secret's value is write-only after saving, Vercel's docs
    // say). The build env names it now.
    const lines = workflow("deploy.yml").split("\n");
    const start = lines.findIndex((line) =>
      /^\s+env: &build-env\s*$/.test(line),
    );
    const indent = lines[start].search(/\S/);
    const env: Record<string, string> = {};
    for (const line of lines.slice(start + 1)) {
      if (line.trim() === "" || line.trim().startsWith("#")) continue;
      if (line.search(/\S/) <= indent) break;
      const [, key, value] =
        line.match(/^\s*([A-Z_][A-Z0-9_]*):\s*(.*)$/) ?? [];
      if (key) env[key] = value;
    }

    expect(env.GITHUB_TOKEN).toMatch(/\$\{\{ secrets\.\w+ \}\}/);
    expect(env.USE_GITHUB_DATA).toBe("true");
    expect(env.GH_USERNAME).toBeTruthy();
  });

  it("set only environment variables something reads", () => {
    // deploy.yml handed the Medium secret to the production build under a
    // name no code read, and six CI steps set a mock of it that changed
    // nothing; round 14 had removed four more such variables. A variable
    // counts as read by the repository's code, tests or configs, by a step
    // of its own workflow, or by a tool a step runs.
    const tools = new Set([
      "HOME",
      "NODE_OPTIONS",
      "VERCEL_ORG_ID",
      "VERCEL_PROJECT_ID",
    ]);
    const files = [
      ...["src", "scripts", ".github/scripts", "tests"].flatMap(scriptsUnder),
      "next.config.mjs",
      "playwright.config.ts",
      "vitest.config.mts",
    ].filter((path) => path !== "src/app/ci-workflows.test.ts");
    const code = files
      .filter((path) => !path.endsWith(".sh"))
      .map(read)
      .join("\n");
    const shell = files
      .filter((path) => path.endsWith(".sh"))
      .map(read)
      .join("\n");
    const set = workflows.flatMap(({ name, text }) =>
      envKeys(text).map((key) => ({ name, text, key })),
    );
    const unread = set.filter(
      ({ text, key }) =>
        !tools.has(key) &&
        !new RegExp(`process\\.env(?:\\.${key}\\b|\\[["']${key}["']\\])`).test(
          code,
        ) &&
        !new RegExp(`\\$\\{?${key}\\b`).test(shell) &&
        !new RegExp(`\\$\\{?${key}\\b|\\benv\\.${key}\\b`).test(text),
    );

    expect(set.length).toBeGreaterThan(20);
    expect(unread.map(({ name, key }) => `${name}: ${key}`)).toEqual([]);
  });
});
