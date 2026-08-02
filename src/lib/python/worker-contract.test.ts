import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  STRIPPED_GLOBALS,
  BLOCKED_MODULES,
  NAVIGATOR_KEPT,
  NAVIGATOR_MUST_BE_GONE,
} from "./config";

/**
 * public/python-worker.js is plain untranspiled JS. Webpack never type-checks
 * it, nothing imports it, and no other test loads it, so it can drift away from
 * config.ts without a single tool complaining. These tests read the file as text
 * and assert the properties that drift would break.
 *
 * Text matching is crude, and that is the point: it holds even though the file
 * cannot be imported into a jsdom test (it does a top-level import of an 11MB
 * wasm loader from an absolute URL).
 */
// Anchored to this file rather than to the working directory, so the test does
// not care where vitest was invoked from. jsdom replaces the global URL, which
// rules out the import.meta.url route.
const WORKER_PATH = resolve(__dirname, "../../../public/python-worker.js");
const source = readFileSync(WORKER_PATH, "utf8");

/** Pull the double-quoted strings out of one bracketed literal in the file. */
function namesInBlock(pattern: RegExp, label: string): string[] {
  const match = pattern.exec(source);
  if (!match)
    throw new Error(`could not find the ${label} literal in the worker`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const workerStrippedGlobals = namesInBlock(
  /const STRIPPED_GLOBALS = \[([\s\S]*?)\];/,
  "STRIPPED_GLOBALS",
);

const workerBlockedModules = namesInBlock(
  /_BLOCKED = frozenset\(\{([\s\S]*?)\}\)/,
  "_BLOCKED",
);

const workerNavigatorKept = namesInBlock(
  /const NAVIGATOR_KEPT = \[([\s\S]*?)\];/,
  "NAVIGATOR_KEPT",
);

const workerNavigatorMustBeGone = namesInBlock(
  /const NAVIGATOR_MUST_BE_GONE = \[([\s\S]*?)\];/,
  "NAVIGATOR_MUST_BE_GONE",
);

/** Index of a bare statement, so a mention in a comment cannot match. */
function statementIndex(pattern: RegExp, label: string): number {
  const match = pattern.exec(source);
  if (!match) throw new Error(`the worker no longer contains ${label}`);
  return match.index;
}

describe("worker constants mirror config.ts", () => {
  it("strips exactly the globals config.ts declares", () => {
    // Sorted, so reordering either list is not a failure. Membership is the
    // contract; a name present in one copy and not the other is a hole.
    expect([...workerStrippedGlobals].sort()).toEqual(
      [...STRIPPED_GLOBALS].sort(),
    );
  });

  it("blocks exactly the modules config.ts declares", () => {
    expect([...workerBlockedModules].sort()).toEqual(
      [...BLOCKED_MODULES].sort(),
    );
  });

  it("keeps exactly the navigator fields config.ts allows", () => {
    // An allowlist, so drift is asymmetric and both directions hurt: a name in
    // the worker copy only is a capability nobody reviewed, and a name in
    // config.ts only is a field the worker silently drops.
    expect([...workerNavigatorKept].sort()).toEqual([...NAVIGATOR_KEPT].sort());
  });

  it("spot-checks exactly the navigator names config.ts declares gone", () => {
    expect([...workerNavigatorMustBeGone].sort()).toEqual(
      [...NAVIGATOR_MUST_BE_GONE].sort(),
    );
  });

  it("keeps the two navigator lists disjoint", () => {
    // Naming one field in both would make the post-lockdown assertion
    // unsatisfiable: the allowlist preserves it, then the check demands it be
    // gone, and the worker refuses to boot at all.
    const kept = new Set<string>(NAVIGATOR_KEPT);
    const overlap = NAVIGATOR_MUST_BE_GONE.filter((name) => kept.has(name));

    expect(overlap).toEqual([]);
  });

  it("leaves WebAssembly alone", () => {
    // Emscripten holds live Table and addFunction trampolines for C callbacks
    // and finalizers through it, so deleting it breaks the interpreter outright.
    // It also grants no I/O by itself, which is why omitting it costs nothing.
    expect(workerStrippedGlobals).not.toContain("WebAssembly");
    expect(STRIPPED_GLOBALS as readonly string[]).not.toContain("WebAssembly");
  });
});

describe("worker boot order", () => {
  it("pins postMessage before defining anything else", () => {
    // Python that reaches a JS handle can reassign self.postMessage. It cannot
    // reach a binding captured before it ever ran.
    const pin = statementIndex(
      /const post = self\.postMessage\.bind\(self\);/,
      "the pinned postMessage binding",
    );

    expect(pin).toBeLessThan(source.indexOf("const STRIPPED_GLOBALS"));
    expect(pin).toBeLessThan(source.indexOf("async function boot"));
  });

  it("closes stdin at the JS level", () => {
    // The Python-side input() stub is not enough: sys.stdin.readline() goes
    // straight past it and hangs the worker until the client's timeout kills it.
    expect(source).toContain("pyodide.setStdin(");
  });

  it("closes stdin before any user code can run", () => {
    const setStdin = statementIndex(/pyodide\.setStdin\(/, "the setStdin call");
    const prelude = statementIndex(/runPython\(PRELUDE\)/, "the prelude run");

    expect(setStdin).toBeLessThan(prelude);
  });

  it("loads vendored packages before the prelude runs", () => {
    // Load bearing and found empirically: the wheel unpacker lives in _pyodide,
    // which the prelude purges. Swap these two and numpy stops loading at all.
    const loadPackage = statementIndex(
      /await pyodide\.loadPackage\(/,
      "the loadPackage call",
    );
    const prelude = statementIndex(/runPython\(PRELUDE\)/, "the prelude run");

    expect(loadPackage).toBeGreaterThan(-1);
    expect(loadPackage).toBeLessThan(prelude);
  });

  it("locks down the JS globals only after the prelude has run", () => {
    // The prelude is executed with runPython, which the lockdown makes unsafe to
    // call. Reversing these leaves the sandbox unhardened or the prelude unrun.
    const prelude = statementIndex(/runPython\(PRELUDE\)/, "the prelude run");
    const lockdown = statementIndex(
      /^[ \t]*lockdown\(\);/m,
      "the lockdown call",
    );

    expect(lockdown).toBeGreaterThan(prelude);
  });

  it("verifies the lockdown after running it and before announcing readiness", () => {
    // The order is the whole point. Checking before lockdown() would assert
    // nothing, and checking after the ready post would let the client hand user
    // code to an interpreter whose lockdown had already failed.
    const lockdown = statementIndex(
      /^[ \t]*lockdown\(\);/m,
      "the lockdown call",
    );
    const verify = statementIndex(
      /lockdownFailures\(\);/,
      "the lockdownFailures call",
    );
    const ready = statementIndex(/t: "ready"/, "the ready message");

    expect(verify).toBeGreaterThan(lockdown);
    expect(verify).toBeLessThan(ready);
  });

  it("fails closed when anything survived the lockdown", () => {
    // The lockdown IS the security boundary, so a partial strip is worse than
    // no interpreter: it would run untrusted code while the design still claims
    // the room is empty. Clearing the runner is what makes the refusal stick,
    // because the message handler checks it before every run.
    const guard = statementIndex(
      /if \(survivors\.length > 0\) \{/,
      "the lockdown failure guard",
    );
    const ready = statementIndex(/t: "ready"/, "the ready message");
    const branch = source.slice(guard, ready);

    expect(branch).toContain("runner = null;");
    expect(branch).toContain("throw new Error(");
  });
});

describe("worker hardening details", () => {
  it("walks the prototype chain, because deleting from self is a no-op", () => {
    // On a DedicatedWorkerGlobalScope these properties live on
    // WorkerGlobalScope.prototype, so `delete self.fetch` returns true and
    // removes nothing.
    expect(source).toContain("Object.getPrototypeOf(self)");
  });

  it("shadows each stripped name non-configurably so it cannot be assigned back", () => {
    expect(source).toContain("Object.defineProperty(target, name,");
    expect(source).toMatch(/writable:\s*false/);
    expect(source).toMatch(/configurable:\s*false/);
  });

  it("purges sys.modules as well as installing an import hook", () => {
    // import consults sys.modules before sys.meta_path, so the finder alone
    // would leave every already-imported blocked module reachable.
    expect(source).toContain("del sys.modules[_n]");
  });

  it("unregisters the js module bridge", () => {
    expect(source).toContain("unregisterJsModule");
  });

  it("never deletes a navigator property directly, which removes nothing", () => {
    // This pins the exact bug that shipped. `delete self.navigator.sendBeacon`
    // targets an own property of the WorkerNavigator that was never there: the
    // method lives on WorkerNavigator.prototype, so the delete returns true,
    // removes nothing, and sendBeacon stays callable. Any reappearance of this
    // shape means the navigator pass has been quietly reverted.
    expect(source).not.toMatch(/delete\s+self\.navigator\./);
    expect(source).not.toMatch(/delete\s+navigator\./);
  });

  it("locks down navigator as part of the lockdown, not as an optional extra", () => {
    // navigator is not a plain global: it is a getter on the prototype chain
    // returning an object whose methods live on another prototype, so
    // hardRemove alone does not cover it.
    const body = /function lockdown\(\) \{([\s\S]*?)\n\}/.exec(source);
    if (!body) throw new Error("the worker no longer defines lockdown()");

    expect(body[1]).toContain("lockdownNavigator();");
  });

  it("replaces navigator with a frozen snapshot rather than trusting the scrub", () => {
    // Scrubbing the live WorkerNavigator leaves it as the value of
    // self.navigator, and shadowing self.navigator alone leaves the real object
    // recoverable through the prototype's getter. Both halves are required, and
    // the snapshot's plain-object prototype is what lets lockdownFailures()
    // detect a swap that did not take.
    expect(source).toContain("Object.freeze(snapshot)");
    expect(source).toMatch(
      /Object\.defineProperty\(self, "navigator", \{[\s\S]*?value: snapshot/,
    );
  });
});
