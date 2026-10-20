import { describe, it, expect, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "acorn";
import { PYODIDE_VERSION } from "@/lib/python/config";

/**
 * The Python terminal's runtime against the browser floor (package.json's
 * browserslist: Chrome and Edge 111, Firefox 128, Safari and iOS 16.4).
 *
 * Pyodide 314.0.7 fits it: every function body of its wasm uses legacy
 * exception handling, reference types and bulk memory, and its glue is
 * ES2022 (round 25). A later build need not. Emscripten is moving to the
 * newer exception format (exnref: Chrome 137, Firefox 131, Safari 18.4),
 * and glue in newer syntax would not parse on Safari 16.4. These fail the
 * version bump that brings either, before a visitor meets it. pdf.js did
 * exactly that to the PDF reader (round 23).
 */

const dir = join(process.cwd(), "public/pyodide", PYODIDE_VERSION);
const JS_FILES = [
  join(dir, "pyodide.mjs"),
  join(dir, "pyodide.asm.mjs"),
  join(process.cwd(), "public/python-worker.js"),
];

// One function holding one try_table, the exnref form: 28 bytes.
const TRY_TABLE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 8, 1, 6, 0,
  31, 64, 0, 11, 11,
]);

const scratch = mkdtempSync(join(tmpdir(), "pyodide-floor-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** Compiles a wasm file in a Node with exnref turned off. */
function compileWithoutExnref(path: string) {
  return spawnSync(
    process.execPath,
    [
      "--no-experimental-wasm-exnref",
      "-e",
      "new WebAssembly.Module(require('fs').readFileSync(process.argv[1]))",
      path,
    ],
    { encoding: "utf8" },
  );
}

describe(`Pyodide ${PYODIDE_VERSION} and the browser floor`, () => {
  it("is installed (npm run postinstall copies it)", () => {
    for (const file of [...JS_FILES, join(dir, "pyodide.asm.wasm")]) {
      expect(existsSync(file), file).toBe(true);
    }
  });

  it("checks with a Node that can still turn exnref off", () => {
    // Without this control, a Node that dropped the flag, or ignored it,
    // would let the next test pass whatever the runtime holds.
    const control = join(scratch, "try-table.wasm");
    writeFileSync(control, TRY_TABLE);
    expect(() => new WebAssembly.Module(TRY_TABLE)).not.toThrow();

    const result = compileWithoutExnref(control);

    expect(result.stderr).not.toMatch(/bad option/);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Invalid opcode 0x1f/);
  });

  it("needs no exception handling newer than the floor", () => {
    const result = compileWithoutExnref(join(dir, "pyodide.asm.wasm"));

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("parses as ES2022, which Safari 16.4 reads", () => {
    // The check itself: ES2024's v flag is out of reach for ES2022.
    expect(() =>
      parse("const r = /[a]/v;", { ecmaVersion: 2022, sourceType: "module" }),
    ).toThrow();

    for (const file of JS_FILES) {
      expect(
        () =>
          parse(readFileSync(file, "utf8"), {
            ecmaVersion: 2022,
            sourceType: "module",
          }),
        file,
      ).not.toThrow();
    }
  });

  it("calls none of the APIs newer than the floor", () => {
    // Absent from 314.0.7. One appearing in a later version may be guarded
    // by a feature check: read it before adding it here as allowed.
    const newer = [
      "Promise.withResolvers",
      "Promise.try",
      "URL.parse",
      "URL.canParse",
      "Array.fromAsync",
      "Object.groupBy",
      "Map.groupBy",
      "Iterator.from",
      "Atomics.waitAsync",
      "Error.captureStackTrace",
      "Error.isError",
      "RegExp.escape",
      "Math.sumPrecise",
      "Float16Array",
      ".symmetricDifference(",
      ".isDisjointFrom(",
      ".isSubsetOf(",
      ".isSupersetOf(",
      ".union(",
      ".intersection(",
    ];
    for (const file of JS_FILES) {
      const source = readFileSync(file, "utf8");
      expect(
        newer.filter((name) => source.includes(name)),
        file,
      ).toEqual([]);
    }
  });
});
