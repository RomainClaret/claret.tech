import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/**
 * scripts/apply-patches.mjs applies patches/ to node_modules in the
 * postinstall: motion-dom's feature registry in a module of its own, which
 * keeps framer-motion's animation engine out of the homepage's eager JS.
 * It replaced patch-package; these run it on a copy of the patched files.
 */

const root = process.cwd();
const script = join(root, "scripts/apply-patches.mjs");
const [entry] = JSON.parse(
  readFileSync(join(root, "patches/patches.json"), "utf8"),
) as {
  package: string;
  version: string;
  patch: string;
  files: Record<string, { before: string | null; after: string | null }>;
}[];
const paths = Object.keys(entry.files);
const copies: string[] = [];

/** A root with the patch and the installed (patched) package's files. */
function copy(): string {
  const dir = mkdtempSync(join(tmpdir(), "apply-patches-"));
  copies.push(dir);
  mkdirSync(join(dir, "patches"));
  for (const name of ["patches.json", entry.patch]) {
    copyFileSync(join(root, "patches", name), join(dir, "patches", name));
  }
  const manifest = `node_modules/${entry.package}/package.json`;
  for (const path of [manifest, ...paths]) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    copyFileSync(join(root, path), join(dir, path));
  }
  return dir;
}

const run = (dir: string, ...args: string[]) =>
  spawnSync(process.execPath, [script, ...args, dir], { encoding: "utf8" });

/** Each listed file's SHA-256, null when it is absent. */
const hashes = (dir: string) =>
  paths.map((path) =>
    existsSync(join(dir, path))
      ? createHash("sha256")
          .update(readFileSync(join(dir, path)))
          .digest("hex")
      : null,
  );

const before = paths.map((path) => entry.files[path].before);
const after = paths.map((path) => entry.files[path].after);

afterEach(() => {
  for (const dir of copies.splice(0)) rmSync(dir, { recursive: true });
});

describe("the patches the postinstall applies", () => {
  it("are applied to the installed motion-dom", () => {
    const read = (path: string) =>
      readFileSync(join(root, "node_modules/motion-dom/dist/es", path), "utf8");

    expect(read("render/VisualElement.mjs")).not.toMatch(
      /^let featureDefinitions/m,
    );
    expect(read("render/VisualElement.mjs")).toContain(
      "from './feature-definitions.mjs'",
    );
    expect(read("index.mjs")).toContain(
      "export { getFeatureDefinitions, setFeatureDefinitions } from './render/feature-definitions.mjs';",
    );
    // The patch's version is the one installed and the one framer-motion
    // pins: a framer-motion that moved would fail the install first.
    const version = (path: string) =>
      JSON.parse(readFileSync(join(root, path), "utf8"));
    expect(version("node_modules/motion-dom/package.json").version).toBe(
      entry.version,
    );
    expect(
      version("node_modules/framer-motion/package.json").dependencies[
        "motion-dom"
      ],
    ).toBe(entry.version);
  });

  it("undo and redo exactly, and leave a patched tree as it is", () => {
    const dir = copy();
    expect(hashes(dir)).toEqual(after);

    expect(run(dir, "--reverse").status).toBe(0);
    expect(hashes(dir)).toEqual(before);

    const applied = run(dir);
    expect(applied.status).toBe(0);
    expect(applied.stdout).toContain(
      `${entry.package}@${entry.version} patched`,
    );
    expect(hashes(dir)).toEqual(after);

    const again = run(dir);
    expect(again.status).toBe(0);
    expect(again.stdout).toContain("already patched");
    expect(hashes(dir)).toEqual(after);
  });

  it("fail the install on a file that is not the one patched, writing nothing", () => {
    const dir = copy();
    expect(run(dir, "--reverse").status).toBe(0);
    const changed = join(dir, paths[1]);
    writeFileSync(changed, readFileSync(changed, "utf8").replace(";", ",;"));
    const touched = hashes(dir);

    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${paths[1]}: sha256`);
    expect(hashes(dir)).toEqual(touched);
  });

  it("fail the install on another version of the package", () => {
    const dir = copy();
    const manifest = join(dir, `node_modules/${entry.package}/package.json`);
    const json = JSON.parse(readFileSync(manifest, "utf8"));
    writeFileSync(manifest, JSON.stringify({ ...json, version: "14.4.0" }));

    const result = run(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `${entry.package} 14.4.0 is installed, and patches/${entry.patch} is for ${entry.version}`,
    );
    expect(hashes(dir)).toEqual(after);
  });
});
