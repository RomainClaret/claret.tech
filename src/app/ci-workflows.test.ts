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

/** A job's lines, from its key to the next key at its level. */
function jobBlock(text: string, job: string): string {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line === `  ${job}:`);
  const end = lines.findIndex(
    (line, index) => index > start && /^ {2}\S/.test(line),
  );
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

/** Every step: the line it starts on, and its lines up to the next step. */
function stepsOf(text: string): { line: number; step: string }[] {
  const lines = text.split("\n");
  return lines.flatMap((line, index) => {
    const indent = line.match(/^(\s+)- (?:name|uses|run|id|if):/)?.[1].length;
    if (indent === undefined) return [];
    const end = lines.findIndex(
      (next, at) =>
        at > index && next.trim() !== "" && next.search(/\S/) <= indent,
    );
    const step = lines.slice(index, end === -1 ? undefined : end).join("\n");
    return [{ line: index + 1, step }];
  });
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
    // the build job saved a .next that nothing restored. Two browser-test
    // jobs cached test-results/ and playwright-report/, which each run
    // clears or rewrites, and .playwright-cache/, which nothing reads: "to
    // avoid re-running unchanged tests", they skipped none.
    for (const { name, text } of workflows) {
      expect(text, name).not.toMatch(
        /rm -rf \/usr\/(?:local\/lib\/android|share\/dotnet)/,
      );
      expect(text, name).not.toMatch(
        /\.vitest-cache|node_modules\/\.cache\/vitest/,
      );
      for (const { line, step } of stepsOf(text)) {
        if (!/uses: actions\/cache@/.test(step)) continue;
        expect(step, `${name}:${line}`).not.toMatch(
          /\b(?:test-results|playwright-report)\/|\.playwright-cache/,
        );
      }
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

  it("run every browser suite on main, which the deploy takes as tested", () => {
    // Change detection skipped the suites whose files a push left alone, so
    // a green run on main could leave one out (37212624117 passed without
    // the phone tests). The deploy waits for a green run on main with
    // nothing skipped (.github/scripts/browser-tests-passed.sh).
    const text = workflow("playwright.yml");
    const lines = text.split("\n");
    const jobs = lines
      .slice(lines.indexOf("jobs:") + 1)
      .flatMap((line) => line.match(/^ {2}([\w-]+):\s*$/)?.[1] ?? [])
      .filter((job) => !["detect-changes", "playwright-summary"].includes(job));

    expect(jobs.length).toBeGreaterThan(5);
    for (const job of jobs) {
      const condition = jobCondition(text, job)
        .replace(/^\s*if: \|\s*/, "")
        .replace(/^always\(\) && !cancelled\(\) &&\s*\(/, "");
      expect(condition, job).toMatch(
        /^github\.ref == 'refs\/heads\/main' \|\|/,
      );
    }
  });

  it("count with sh's words, not bash's brace ranges", () => {
    // A job in a container runs its steps under `sh -e`, which leaves
    // {1..30} as it is: the wait for the server ran once, one 2 s sleep,
    // where it was to wait up to 60 s (GitHub's log of run 37233882557
    // printed "attempt {1..30}/30"). seq counts in both shells.
    const ranges = workflows.flatMap(({ name, text }) =>
      [...text.matchAll(/\{\d+\.\.\d+\}/g)].map(
        (match) => `${name}: ${match[0]}`,
      ),
    );

    expect(ranges).toEqual([]);
  });

  it("keep the server's output out of its start step", () => {
    // Under act, a server started with `npm start &` stopped serving once it
    // wrote to its start step's output after that step had ended: the
    // squashed history's snapshots, which logged a failed Medium fetch on
    // every test, failed 14 or 15 of their 17 browser jobs, and one of those
    // jobs passed 21 of 21 with the output in a file (2026-10-25). A file
    // also keeps the log, which the job prints at its end.
    const text = workflow("playwright.yml");
    const jobs = [...text.matchAll(/^ {2}([a-z-]+):$/gm)].map(
      (match) => match[1],
    );
    const serving = jobs.filter((job) =>
      /^\s*npm start\b/m.test(jobBlock(text, job)),
    );

    expect(serving.length).toBeGreaterThan(0);
    for (const job of serving) {
      const block = jobBlock(text, job);
      expect(block.match(/^\s*npm start\b.*$/m)?.[0].trim(), job).toBe(
        "npm start > server.log 2>&1 &",
      );
      const printed = stepsOf(block).some(
        ({ step }) =>
          /if: always\(\)/.test(step) && /cat server\.log/.test(step),
      );
      expect(printed, job).toBe(true);
    }
  });

  it("give act no host Docker socket and no host GitHub token", () => {
    // act binds the host's Docker socket into every job container unless
    // told "-", and code there could then mount any folder Docker Desktop
    // shares, the home directory included. Without a GITHUB_TOKEN key, act
    // fills secrets.GITHUB_TOKEN from `gh auth token`, a repo-scoped login
    // (security audit run 1, leads 4 and 5).
    const flags = read(".actrc")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("--"));
    expect(flags).toContain("--container-daemon-socket -");
    expect(flags).toContain("--secret GITHUB_TOKEN=");
    // No default reach for the real tokens: a run that needs them says so.
    expect(flags.filter((flag) => flag.startsWith("--secret-file"))).toEqual(
      [],
    );
    expect(flags).not.toContain("--reuse");

    // The one job step that needs Docker skips under act.
    const ci = read(".github/workflows/ci.yml");
    expect(ci).toMatch(
      /- if: matrix\.check == 'actionlint' && env\.ACT\n\s+run: echo/,
    );
  });

  it("write nothing to Vercel or GitHub under act", () => {
    // .env.act.local holds the real Vercel token, and a run handed it:
    // given --input environment=production, an act run reached the
    // production deploy (act -n, 2026-10-21), and given a GitHub token it
    // would open a pull request. act sets ACT; GitHub leaves it unset.
    const writes = workflows.flatMap(({ name, text }) => {
      const lines = text.split("\n");
      return lines.flatMap((line, index) => {
        if (line.trim().startsWith("#")) return [];
        if (!/vercel deploy|peter-evans\/create-pull-request/.test(line)) {
          return [];
        }
        // Back to the line that starts the step.
        let start = index;
        while (start > 0 && !/^\s*- /.test(lines[start])) start -= 1;
        const step = lines.slice(start, index + 1).join("\n");
        return [`${name}:${index + 1} ${/if:.*!env\.ACT\b/.test(step)}`];
      });
    });

    expect(writes.length).toBeGreaterThanOrEqual(3);
    expect(writes.filter((write) => write.endsWith(" false"))).toEqual([]);
  });

  it("deploy only a commit whose browser tests passed", () => {
    // The deploy waited for ci.yml alone, so a commit whose browser tests
    // had failed, or not finished, could reach production. Previews wait
    // too (Romain, 2026-10-21).
    const text = workflow("deploy.yml");
    const needs = (job: string) =>
      jobBlock(text, job).match(/^ {4}needs: (.+)$/m)?.[1];

    expect(needs("browser-tests")).toBe("ci");
    expect(jobBlock(text, "browser-tests")).toContain(
      "run: bash .github/scripts/browser-tests-passed.sh",
    );
    for (const job of ["deploy-preview", "deploy-production"]) {
      expect(needs(job), job).toBe("[ci, browser-tests]");
    }
  });

  it("let no report upload fail its job", () => {
    // Three of the six upload-artifact steps could fail their job: an
    // artifact outage would fail the run, and the deploy refuses a failed
    // run. Under act 0.2.89, whose artifact server upload-artifact@v7
    // cannot use, three jobs ended red after their tests passed
    // (2026-10-21), and the summary job with them.
    const uploads = workflows.flatMap(({ name, text }) =>
      stepsOf(text)
        .filter(({ step }) => /uses: actions\/upload-artifact@/.test(step))
        .map(
          ({ line, step }) =>
            `${name}:${line} ${/^\s+continue-on-error: true\b/m.test(step)}`,
        ),
    );

    expect(uploads.length).toBeGreaterThanOrEqual(6);
    expect(uploads.filter((upload) => upload.endsWith(" false"))).toEqual([]);
  });

  it("let the deploy's check skip only what the browser tests skip", () => {
    // browser-tests-passed.sh takes an older commit's run when nothing
    // after it is a file playwright.yml skips: a file in its list that the
    // workflow tests would let untested code through.
    const lines = workflow("playwright.yml").split("\n");
    const push = lines.indexOf("  push:");
    const list = lines.findIndex(
      (line, index) => index > push && line.trim() === "paths-ignore:",
    );
    const ignored: string[] = [];
    for (const line of lines.slice(list + 1)) {
      // The trailing comments stay out ('**.md'  # Skip documentation...).
      const path = line.match(/^\s+- '([^']+)'/)?.[1];
      if (!path) break;
      ignored.push(path);
    }
    // A bash case pattern's * crosses "/", as a ** filter does; no other
    // glob translates.
    const patterns = ignored.map((path) => path.replace(/\*\*/g, "*"));
    for (const pattern of patterns) {
      expect(pattern).not.toMatch(/[?[\]{}!]|\*\*/);
    }
    const script = read(".github/scripts/browser-tests-passed.sh");
    const skipped = script.match(/^\s+(.+)\) return 0 ;;$/m)?.[1].split(" | ");

    expect(ignored.length).toBeGreaterThan(2);
    expect(skipped?.sort()).toEqual(patterns.sort());
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

  it("give Firefox's and WebKit's terminal shards tests to run", () => {
    // Sorted first, python-terminal.spec.ts's 22 "Terminal: python" tests
    // made the whole of shard 1 of 3, and they skip outside Chromium:
    // Firefox's and WebKit's shard 1 ran nothing (2 to 3 s in run
    // 37233882557) while shards 2 and 3 took the 44 others. Filtered out
    // there, the three shards hold 15, 15 and 14.
    const command = jobBlock(
      workflow("playwright.yml"),
      "terminal-tests",
    ).match(/npx playwright test .*/)?.[0];

    expect(command).toContain("tests/e2e/python-terminal.spec.ts");
    expect(command).toContain(
      `\${{ matrix.browser != 'chromium' && '--grep-invert "Terminal: python"' || '' }}`,
    );
    // The title the filter names, on the tests that skip outside Chromium:
    // renamed, the filter would match nothing and shard 1 would empty again.
    expect(read("tests/e2e/python-terminal.spec.ts")).toMatch(
      /test\.describe\("Terminal: python", \(\) => \{\n\s+test\.skip\(\(\{ browserName \}\) => browserName !== "chromium"/,
    );
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
      // act's image: .github/act/Dockerfile builds it on a Node image, and
      // .actrc names its tag. Its pattern once read `=node:24-` in .actrc,
      // and a new image name would have matched nothing, in silence.
      ...[
        ...read(".github/act/Dockerfile").matchAll(/^FROM node:(\d+)-/gm),
      ].map((match) => `.github/act/Dockerfile: ${match[1]}`),
      ...[...read(".actrc").matchAll(/=claret-act:(\d+)\b/g)].map(
        (match) => `.actrc: ${match[1]}`,
      ),
      // nvm's pick on the Mac: Node 25's npm 11.6.2 once wrote a lockfile
      // that CI's npm refused (round 15).
      `.nvmrc: ${existsSync(join(root, ".nvmrc")) ? read(".nvmrc").trim() : "missing"}`,
    ];

    expect(Number(major)).toBeGreaterThanOrEqual(24);
    expect(used.length).toBeGreaterThan(5);
    for (const file of [".github/act/Dockerfile", ".actrc"]) {
      expect(
        used.some((entry) => entry.startsWith(`${file}:`)),
        file,
      ).toBe(true);
    }
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

  it("keep the packages taken out of the browser out", () => {
    // styled-jsx went in round 26; nothing else would notice it coming back
    // with a component that uses it.
    const build = workflow("ci.yml").match(
      /\n {2}build:\n[\s\S]*?\n {2}# Phase 5/,
    )?.[0];

    expect(build).toMatch(
      /run: node \.github\/scripts\/check-client-bundle\.mjs\s*\n/,
    );
  });

  it("deploy with the token in the environment, never on a command line", () => {
    // A `--token=${{ secrets.VERCEL_TOKEN }}` in run: text is an argument,
    // which any process on the runner can read from /proc/<pid>/cmdline
    // (security audit run 1, hardening). The CLI reads VERCEL_TOKEN itself.
    const deploy = workflow("deploy.yml");
    expect(deploy).not.toMatch(/--token/);
    expect(deploy).toMatch(/VERCEL_TOKEN: \$\{\{ secrets\.VERCEL_TOKEN \}\}/);
  });

  it("deploy one environment at a time, production from main only", () => {
    // Two dispatches could finish out of order and leave the older build in
    // production; a dispatch from another branch reached the production job
    // (security audit run 1, hardening).
    const deploy = workflow("deploy.yml");
    expect(deploy).toMatch(
      /concurrency:\n\s+group: deploy-\$\{\{ inputs\.environment \}\}\n\s+cancel-in-progress: false/,
    );
    expect(deploy).toMatch(
      /if: github\.event\.inputs\.environment == 'production' && github\.ref == 'refs\/heads\/main'/,
    );
  });

  it("install the Vercel CLI from its lockfile, with no install script", () => {
    // Both jobs ran `npm install -g vercel@latest`, then vercel@64.7.0, with
    // the deploy token in their environment. The pin fixed vercel's own
    // files only: the registry still picked part of its tree (luxon ^3.4.0,
    // readdirp ^4.0.1) at each deploy, and their install scripts ran before
    // the token steps (security audit run 1, lead 10). tools/vercel pins the
    // whole tree; a new version is a reviewed change to its lockfile.
    const deploy = workflow("deploy.yml");
    expect(deploy).not.toMatch(/npm install -g vercel/);
    const installs = [
      ...deploy.matchAll(
        /npm ci --prefix tools\/vercel --ignore-scripts --no-audit --no-fund/g,
      ),
    ];
    expect(installs).toHaveLength(2);

    const tool = JSON.parse(read("tools/vercel/package.json"));
    expect(tool.dependencies.vercel).toMatch(/^\d+\.\d+\.\d+$/);
    const lock = JSON.parse(read("tools/vercel/package-lock.json"));
    expect(lock.packages["node_modules/vercel"].version).toBe(
      tool.dependencies.vercel,
    );
  });

  it("tell the owner of new error reports, and only of theirs", () => {
    // Reports are filed with the owner's token, and GitHub tells nobody of
    // their own activity: client-error-notify.yml, as github-actions,
    // assigns new reports and mentions the owner on a reopen.
    const notify = workflow("client-error-notify.yml");

    expect(notify).toMatch(/issues:\n\s+types: \[opened, reopened\]/);
    expect(notify).toMatch(
      /github\.event\.issue\.user\.login == github\.repository_owner/,
    );
    expect(notify).toMatch(
      /contains\(github\.event\.issue\.labels\.\*\.name, 'client-error'\)/,
    );
    expect(notify).toMatch(/permissions:\n\s+issues: write\n\n/);
    expect(notify).toMatch(/--add-assignee "\$OWNER"/);
    // Nothing from the issue's text reaches the shell.
    expect(notify).not.toMatch(/github\.event\.issue\.(title|body)/);
  });

  it("set only environment variables something reads", () => {
    // deploy.yml handed the Medium secret to the production build under a
    // name no code read, and six CI steps set a mock of it that changed
    // nothing; round 14 had removed four more such variables. A variable
    // counts as read by the repository's code, tests or configs, by a step
    // of its own workflow, or by a tool a step runs.
    const tools = new Set([
      "GH_TOKEN",
      "HOME",
      "NODE_OPTIONS",
      "VERCEL_ORG_ID",
      "VERCEL_PROJECT_ID",
      // The Vercel CLI's token, from the environment, off its command line.
      "VERCEL_TOKEN",
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
