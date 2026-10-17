# Testing Infrastructure

How the tests run, and what to know before writing one.

## What runs where

- **Unit tests:** Vitest in jsdom, `src/**/*.test.ts(x)`.
- **End to end:** Playwright against a built site, `tests/e2e/*.spec.ts`, in
  Chromium, Firefox and WebKit, desktop and phone.

CI runs the unit tests in batches: `test:ci`, the four component batches
(`test:components:batch1` to `batch4`, hand-kept lists of files), `test:hooks`
and `test:utils`. Two tests keep the lists honest:

- `src/app/ci-test-lists.test.ts` reads the workflow and fails on a test file
  that no CI script runs, and on a listed file that no longer exists. A new
  component test goes in one of the four batches in `package.json`.
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

## The Vitest setup

`vitest.config.ts`:

- jsdom at `http://localhost:3000`, with `pretendToBeVisual`;
- `src/test/polyfills.ts` and `src/test/setup.ts` before every file;
- one fork, files one after another, 30 s timeouts, one retry in CI;
- `clearMocks`, `restoreMocks` and `mockReset` before every test;
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
  behaviour is proved in a browser (`tests/e2e/keyboard-paths.spec.ts`).
- **State per page is state per module.** A module-level store (the Web
  Vitals subscription, the favicon's script loads) survives between tests in
  one file. Load a fresh copy per test: `vi.resetModules()`, then a dynamic
  `import()` (`usePerformanceMonitor.vitals.test.ts`).
- **Restore what you replace.** A test that assigns `globalThis.X` without
  restoring it breaks a later file in the same fork. Use `vi.stubGlobal` with
  `vi.unstubAllGlobals()` in `afterEach`.

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
