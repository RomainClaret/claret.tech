import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * scripts/setup-assets.js vendors the Pyodide runtime into public/pyodide in
 * the postinstall. The runtime is served as immutable for a year, so each
 * version sits in a folder of its own, which the worker's URL names (round
 * 24): from one unversioned folder, a returning visitor kept the cached
 * runtime after an update. These run the script on a root of its own, with
 * a stand-in package whose lock vendors nothing, so nothing is downloaded.
 */

const root = process.cwd();
// What the worker loads, and so what the script copies.
const RUNTIME = [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
];
// The package also ships its UMD build, which nothing loads.
const PACKAGE = [...RUNTIME, "pyodide.js"];
const roots: string[] = [];

function write(path: string, content: string) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
}

/** A root with the script and a stand-in pyodide package of `version`. */
function rootWith(version: string): string {
  const dir = mkdtempSync(join(tmpdir(), "setup-assets-"));
  roots.push(dir);
  mkdirSync(join(dir, "scripts"));
  copyFileSync(
    join(root, "scripts/setup-assets.js"),
    join(dir, "scripts/setup-assets.js"),
  );
  const pkg = join(dir, "node_modules/pyodide");
  write(join(pkg, "package.json"), JSON.stringify({ version }));
  for (const name of PACKAGE) {
    write(
      join(pkg, name),
      name === "pyodide-lock.json"
        ? JSON.stringify({ packages: {} })
        : `${name} ${version}`,
    );
  }
  return dir;
}

const run = (dir: string) =>
  spawnSync(process.execPath, [join(dir, "scripts/setup-assets.js")], {
    encoding: "utf8",
  });

afterEach(() => {
  for (const dir of roots.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("setup-assets.js", () => {
  it("copies the runtime into a folder named for its version", () => {
    const dir = rootWith("314.0.7");

    const result = run(dir);

    expect(result.status).toBe(0);
    const folder = join(dir, "public/pyodide/314.0.7");
    expect(readdirSync(folder).sort()).toEqual([...RUNTIME].sort());
    expect(readFileSync(join(folder, "pyodide.mjs"), "utf8")).toBe(
      "pyodide.mjs 314.0.7",
    );
  });

  it("removes a UMD copy an earlier setup left in the folder", () => {
    const dir = rootWith("314.0.7");
    write(join(dir, "public/pyodide/314.0.7/pyodide.js"), "old");

    expect(run(dir).status).toBe(0);

    expect(readdirSync(join(dir, "public/pyodide/314.0.7")).sort()).toEqual(
      [...RUNTIME].sort(),
    );
  });

  it("removes what other versions left, and nothing else", () => {
    const dir = rootWith("314.0.7");
    const pyodide = join(dir, "public/pyodide");
    // The unversioned layout, up to 314.0.3, and an older version's folder.
    for (const name of ["pyodide.mjs", "pyodide.asm.wasm", "version.json"]) {
      write(join(pyodide, name), "old");
    }
    write(
      join(pyodide, "numpy-2.2.5-cp313-cp313-pyodide_2025_0_wasm32.whl"),
      "old",
    );
    write(join(pyodide, "314.0.3/pyodide.mjs"), "old");
    // Not the script's: left alone.
    write(join(pyodide, "notes.txt"), "mine");
    write(join(pyodide, "drafts/pyodide.mjs"), "mine");

    expect(run(dir).status).toBe(0);

    expect(readdirSync(pyodide).sort()).toEqual([
      "314.0.7",
      "drafts",
      "notes.txt",
    ]);
    expect(existsSync(join(pyodide, "drafts/pyodide.mjs"))).toBe(true);
  });
});
