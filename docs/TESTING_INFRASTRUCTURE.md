# Testing Infrastructure

How the tests run, and what to know before writing one.

## What runs where

- **Unit tests:** Vitest in jsdom, `src/**/*.test.ts(x)`.
- **End to end:** Playwright against a built site, `tests/e2e/*.spec.ts`, in
  Chromium, Firefox and WebKit, desktop and phone.

CI runs the unit tests in ten jobs, one npm script each: `test:api`,
`test:utils`, the four component batches (`test:components:batch1` to
`batch4`, hand-kept lists of files), `test:contexts`, `test:hooks`,
`test:lib-dom` and `test:unit`; each test runs in one job (2,502 on
2026-10-19). Two tests keep the lists honest:

- `src/app/ci-test-lists.test.ts` reads the workflow and fails on a test file
  that no CI script runs or that two run, and on a listed file that no
  longer exists. A new component test goes in one of the four batches in
  `package.json`.
- `src/app/ci-workflows.test.ts` fails on an e2e spec that no Playwright job in
  `playwright.yml` names, and on an env var a workflow sets that nothing
  reads.

`src/app/lint-rules.test.ts` lints a violation planted for each ESLint
plugin. Three of them run on ESLint 10 outside their peer range, through
eslint-config-next's compatibility layer: a rule that stopped reporting would
pass `npm run lint` without a word.

Lint covers the tests too (`eslint src tests`), with `no-explicit-any`,
`react-hooks/globals` and `no-img-element` off for them, and the hooks rules
off for Playwright files, whose fixtures take a function named `use`. knip
(`npm run knip`, in CI's quick checks) fails on a file no import reaches and
on an export or dependency nothing uses; a helper nothing imports anymore
has to go, or CI fails. actionlint checks the workflows the same way
(`npm run lint:workflows`, from its Docker image), shell of the run steps
included.

The e2e checks that measure, and can fail (2026-10-18):

- **axe:** `@axe-core/playwright` 4.14; every tagged scan also asks for
  `wcag22aa` (target size). The homepage scans fail on any critical or
  serious violation, at the desktop size and at 412 by 823 px: axe calls
  some findings incomplete at one size and a violation at another, and
  incomplete is not a pass.
- **Lighthouse** (`lighthouse.spec.ts`, Chromium, run alone against
  `npm start`): three audits, and the median of each score and metric must
  reach performance 80, FCP under 1.5 s, LCP under 2 s, CLS under 0.1, TBT
  under 1,000 ms and TTI under 3 s. Calibrated on 2026-10-18 for CI's
  runners, about 3.7 times slower than the Playwright container on an idle
  M4 Max (`docs/performance.md`, round 20): they hold at 1.5 times CI's
  slowness and fail at 8 times the container's CPU time. Every audit's
  numbers and Lighthouse's CPU benchmark go to the job log and, as JSON, to
  the test report; one slow audit cannot fail the gate alone. The budgets
  that used to sit in `lighthouse.config.js` were never read.
- **`performance.spec.ts`:** the homepage's JavaScript under 2,000 KB and
  at least half of it run, counted per byte by the innermost coverage range
  (V8's ranges nest and include code that never ran).
- **The console** (`static-shell.spec.ts`, Chromium, the performance job):
  the homepage loads with no console error and no page error, once its
  requests settle. Production reports none of its client errors, by design,
  so this is where a broken script or a failed request shows. Builds without
  GitHub data stay quiet too: the GitHub routes answer "no data" with a 200.

## The Vitest setup

`vitest.config.mts`:

- jsdom 30 at `http://localhost:3000`, with `pretendToBeVisual`: it has
  `Blob.text()`, and `click()` dispatches a real `PointerEvent`;
- `src/test/polyfills.ts` and `src/test/setup.ts` before every file;
- Vitest 5 (on vite 8): one worker, files one after another, each in a
  fresh fork (`isolate`), 30 s timeouts, one retry in CI;
- `clearMocks`, `restoreMocks` and `mockReset` before every test;
- no on-disk module cache (`fsModuleCache: false`): Vitest 5 would reuse
  transformed modules across runs;
- coverage locally, not in CI.

## Things that bite

- **`mockReset` empties mocks.** A `vi.fn(impl)` made in a `vi.mock` factory
  loses `impl` before each test. Give the implementation in the test
  (`vi.mocked(fn).mockImplementation(...)`), or read hoisted state from the
  factory (`vi.hoisted`).
- **Unhandled rejections do not fail a test.** `src/test/setup.ts` swallows
  them (`window.onunhandledrejection`). To test that code handles a rejection,
  ask the promise whether a handler came: `blog-card-holographic.test.tsx`
  returns a thenable that records its `onRejected`.
- **jsdom draws nothing.** No layout (`getBoundingClientRect` is zero), no
  `:hover`, `:focus-visible` or `:focus-within` styles, and framer-motion's
  entrances stay at their `initial` values (`toBeVisible` fails on
  `opacity: 0`). A unit test can check the classes as a contract; the
  behavior is proved in a browser (`tests/e2e/keyboard-paths.spec.ts`).
- **State per page is state per module.** A module-level store (the Web
  Vitals subscription, the favicon's script loads) survives between tests in
  one file. Load a fresh copy per test: `vi.resetModules()`, then a dynamic
  `import()` (`usePerformanceMonitor.vitals.test.ts`).
- **Restore what you replace.** A test that assigns `globalThis.X` without
  restoring it breaks the later tests of its file (each file gets a fresh
  fork since Vitest 4). Use `vi.stubGlobal` with `vi.unstubAllGlobals()` in
  `afterEach`.
- **A mock the code calls with `new` is a function, not an arrow.** Vitest 4
  refuses `new` on an arrow implementation (`TypeError: () => ({...})`), and
  a `try` around the construction hides it: write
  `vi.fn(function () { return {...}; })`.
- **Mock a Node built-in with a factory.** `vi.mock("fs")` no longer turns
  the default export's functions into mocks; name them in the factory, under
  `default` too when the code imports the default.
- **`vi.mock` belongs at the top level.** Vitest hoists it to the top of its
  module whatever block it sits in; Vitest 4 warned, and Vitest 5 refuses to
  load the file. A helper's mocks apply to every test file that imports it.
- **Type a mock by its callback.** `ReturnType<typeof vi.fn>` is a mock no
  typed callback accepts in Vitest 4: write `Mock<() => void>` and
  `vi.fn<() => void>()`.
- **Define a window property, do not assign it.** Vitest's global for each
  window property is an accessor whose setter writes on to jsdom's window.
  Since jsdom 30 that window is a plain global
  (`vm.constants.DONT_CONTEXTIFY`), and a write to a getter-only property
  throws: `global.localStorage = mock` in `setup.ts` stopped every file from
  loading. Use `Object.defineProperty(globalThis, ...)` or `vi.stubGlobal`.
- **Unit tests see names without our stylesheet.** jsdom 30 applies the
  HTML Standard's default stylesheet, where a span is inline; jsdom 24
  reported no `display` at all, which the name computation took for a
  block. Two Tailwind `block` spans in a button then read as one word
  ("EMR-HyperNEATPaper"), as they would in a browser without our CSS: put
  the space in the markup (`{" "}` between them renders nothing between
  blocks).
- **A library mock encodes one version of the library.** The PDF reader's
  Document mock kept the pages mounted through a reload, as react-pdf 10.0
  did; 10.5 unmounts them, and the tests stayed green on the wrong
  behavior until the mock changed (`pdf-viewer-pages.test.tsx`). Check the
  mocks of a library you upgrade. And let the test release what the mock
  delivers later: a `setTimeout(0)` delivery ran inside React's async `act`
  around the click, so no test saw the pages away.

## Patched dependencies

`scripts/apply-patches.mjs`, first in the postinstall, applies `patches/`.
`patches/patches.json` lists each patch with the package's exact version and
the SHA-256 of every file it touches, before and after; any other version or
content fails the install, and a patched tree is left as it is. Today one:
motion-dom 14.3.1 (framer-motion pins it exactly), whose feature registry
moves out of `VisualElement.mjs` (docs/performance.md, round 22).
`npm install <package>` skips the postinstall: run `npm run postinstall`
after one that reinstalls motion-dom.

When framer-motion moves, the install fails, naming the new version. To redo
the patch:

1. In a scratch git repository, put `node_modules/motion-dom` as npm
   installs it (`npm pack motion-dom@<version>`, untarred), and commit.
2. Make the change again there, then
   `git diff > patches/motion-dom+<version>.patch` (paths
   `a/node_modules/motion-dom/...`, as now).
3. In `patches/patches.json`, set the version, the patch's name, and each
   file's hashes before and after (`shasum -a 256`). `npm run postinstall`
   applies it, and `src/app/apply-patches.test.ts` undoes and redoes it.

Once upstream keeps the registry out of `VisualElement`, drop the patch, its
entry and framer-motion's exact pin instead.

## Hooks that throw

A hook that throws outside its provider is tested with
`renderHookWithErrorBoundary` and `expectHookError` (`src/test/error-test-utils.tsx`,
re-exported by `src/test/context-test-utils.ts`):

```typescript
import {
  renderHookWithErrorBoundary,
  expectHookError,
} from "@/test/context-test-utils";

it("throws outside its provider", () => {
  const { getError } = renderHookWithErrorBoundary(() => useAnimationState(), {
    expectError: true,
  });

  expectHookError(getError(), {
    message: "useAnimationState must be used within an AnimationStateProvider",
    type: Error,
  });
});
```

The hook renders under an error boundary, and `getError()` returns what it
threw. React still prints the error to stderr; that output is expected. The
context tests in `src/contexts/` use this.
