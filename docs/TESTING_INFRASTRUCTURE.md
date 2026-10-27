# Testing Infrastructure

How the tests run, and what to know before writing one.

## What runs where

- **Unit tests:** Vitest in jsdom, `src/**/*.test.ts(x)`.
- **End to end:** Playwright against a built site, `tests/e2e/*.spec.ts`, in
  Chromium, Firefox and WebKit, desktop and phone.
- **A push, before it is made:** act runs `ci.yml` and `playwright.yml` as
  GitHub would for the local commits (`.github/workflows/README.md`,
  "Rehearse a push"). Artifact uploads fail under act, without failing
  their job. The Mac is too fast to show WebKit's timing failures: for
  those, see "GitHub's WebKit, before a push" below.

CI runs the unit tests in ten jobs, one npm script each: `test:api`,
`test:utils`, the four component batches (`test:components:batch1` to
`batch4`, hand-kept lists of files), `test:contexts`, `test:hooks`,
`test:lib-dom` and `test:unit`; each test runs in one job (2,722 on
2026-10-26). Two tests keep the lists honest:

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

Lint covers everything the repository runs (`npm run lint`): `src`, `tests`,
`scripts`, `.github/scripts`, the public workers and the root configs; until
round 24, 23 of those files were linted by nothing. ESLint's own recommended
rules (`@eslint/js`) apply to all of it, ahead of eslint-config-next's
TypeScript rules, which turn `no-undef` off for TypeScript. The CommonJS
scripts may `require`. In the tests, `no-explicit-any`, `react-hooks/globals`,
`no-img-element`, `no-constant-binary-expression` and `no-empty-pattern`
(Playwright's `({}, testInfo)`) are off, and the hooks rules are off for
Playwright files, whose fixtures take a function named `use`. knip
(`npm run knip`, in CI's quick checks) fails on a file no import reaches and
on an export or dependency nothing uses; a helper nothing imports anymore
has to go, or CI fails. actionlint checks the workflows the same way
(`npm run lint:workflows`, from its Docker image), shell of the run steps
included.

Commits go through two hooks (husky 9, set up by `npm install`'s `prepare`):
pre-commit runs lint-staged (ESLint and Prettier on the staged files) and
the type-check; commit-msg runs commitlint (conventional commits, the subject
in lowercase, the header at most 100 characters). husky 9 points git's
`core.hooksPath` at `.husky/_`, which `npm install` generates and git
ignores: a new worktree runs no hook until `npm install` has run in it.

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
- **`performance.spec.ts`:** the homepage's JavaScript under 1,500 KB and
  at least half of it run, counted per byte by the innermost coverage range
  (V8's ranges nest and include code that never ran); its CSS under 181 KB,
  more than 80% of it used; fewer than 36 scripts, at most 3 stylesheets
  and 3 fonts, and fewer than 53 requests until the network is idle; the
  cache headers `next.config.mjs` and Next set; `font-display: swap` on
  every face that loads a file. The limits are the highest measured value
  plus 15% (1,321 KB, 157 KB and 0.934, 31, 2, 2 and 46 on 2026-10-20).
  Web vitals are Lighthouse's (above): the FID and vitals tests recorded
  nothing measurable.
- **Compactness** (`card-details.spec.ts`, the accessibility job): at
  1280 px the four philosophy cards in one row, the row at most 260 px,
  the core activities 407 and the research journey 354; at 390 px the
  philosophy cards at most 888. Each is the height measured on 2026-10-21,
  when the cards stopped growing in place, plus 15%. The deploy waits for
  this workflow (`deploy.yml`'s browser-tests job), so these fail a deploy
  too.
- **The hero on a phone** (`static-shell.spec.ts`, Chromium, the
  performance job): at 390 x 664, an iPhone 12's page area in Safari, View
  Resume ends on the first screen (645 px on 2026-10-21, in Chromium and
  WebKit, on macOS and in Linux). One more line of the hero's paragraph,
  26 px, puts it at 671: shorten the text or the spacing, not the test.
- **The console** (`static-shell.spec.ts`, Chromium, the performance job):
  the homepage loads with no console error and no page error, once its
  requests settle. Production reports only the errors that reach an error
  boundary (below); a failed request, or an error in an event handler or a
  promise, reaches none and reports nothing, so this is where those show.
  Builds without GitHub data stay quiet too: the GitHub routes answer "no
  data" with a 200.
- **Error reports** (`error-reports.spec.ts`, the accessibility job): an
  error is forced in the page's boundary (`error.tsx`, on `/pdf/cv`) and in
  the root's (`global-error.tsx`, the privacy notice): one
  `ResizeObserver.observe()` call throws. The page posts it to
  `/api/client-error` with a frame in the site's chunks and its build, with
  no Referer and no cookie; the build answers 204 (it has no
  `GITHUB_ISSUES_TOKEN`), and the page says "A report of it was sent." only
  after a 202, routed in the test. Firefox prints a logged Error as "Error":
  the console check reads the logged values. The route's own rules are unit
  tests (`src/app/api/client-error/route.test.ts`, with a fake GitHub that
  finds the issues it opened, and `src/lib/client-error/issue.test.ts`):
  JSON from the site's own pages only (415, 403), sanitizing, the build
  line, one signature per bug across deploys, the owner's labeled reports
  open or closed (a closed one reopened only from the build serving now),
  an incomplete search opening nothing, 10 new issues a day counted on
  GitHub, 20 comments per instance, both caps holding for reports in flight
  together (a fake GitHub on a real-timer delay), a reopen at most once an
  hour, a failed count giving its slot back, quiet after GitHub's 403 or 429,
  and the rate limit. `.github/workflows/client-error-notify.yml` assigns new
  reports to the owner (GitHub tells nobody of their own activity), and
  `scripts/map-frame.mjs` maps a reported frame with the build's published,
  hidden source maps.
- **Privacy** (`privacy.spec.ts`, the accessibility job): no cookie after
  a theme switch, an old `theme` cookie expired, and a full scroll of the
  homepage contacting no host but the site's own.
  `src/lib/security-headers.test.ts` pins the CSP's host lists and checks
  that the privacy policy names every host the browser may reach;
  `src/app/public-claims.test.ts` holds smaller claims (the footer's host,
  the policy's model sizes).
- **The Python runtime against the browser floor**
  (`src/app/pyodide-floor.test.ts`, unit): the runtime compiles in a Node
  with exnref off, its glue and the worker parse as ES2022, and 20 API
  names newer than the floor are absent; two controls prove the checks
  work. python-terminal.spec.ts also boots the worker as older bundles
  start it (no version, an older one), in every engine.

- **No denied package in a client chunk** (`.github/scripts/check-client-bundle.mjs`,
  CI's build job): it reads every client chunk's source map and fails on a
  package `client-bundle-deny.json` names, with the reason it gives.
  Denied: styled-jsx (round 26 moved its keyframes to `motion.css`) and
  tailwind-merge, which only checks `cn()` outside production (below).
- **Tailwind classes that override each other** (`src/lib/cn-conflicts.test.ts`,
  unit): `cn()` joins classes as written (clsx), so two classes for the
  same property would both reach the page and the stylesheet's order would
  pick one. The test reads every `cn()` call as a syntax tree and fails on
  two written classes that tailwind-merge would merge, unless their
  conditions exclude each other (`a ? x : y`, `a` and `!a`, `x === "a"` and
  `x === "b"`). Classes from props are checked at run time: outside
  production `cn()` calls `reportConflicts`, and `src/test/setup.ts` fails
  the unit test whose render reported one. Round 26 audited the e2e suite
  the same way, on a production build with the report forced on: 0 reports
  in 844 tests, against 210 with one conflict put back.

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

## Proving a test can fail

A test is only worth its cost if it fails when the code it guards breaks.
Round 26 rewrote or deleted the tests that could not (`expect(true)`,
`>= 0`, assertions inside `try`, a page scrolled by the test itself) and
proved each replacement with a mutation:

- Work in a scratch `git worktree` at the commit under test, never in the
  checkout: break one line (a `perl -0` substitution), run the one test,
  put the line back. An e2e mutation needs a production build of its own.
- Run the test on the unbroken candidate first. A test that is already red
  proves nothing, and neither does a substitution that changed nothing.
- A failure is a kill only if it is the expected one: read the error. An
  e2e run against a server that stopped fails too, so check the server
  after a red run. One runner's exit trap once killed another's server.
- Place a mutation where the test looks. A mutation inside a site that the
  test's own allowlist skipped survived, as designed (the `cn()` scan's
  list of known conflicts, while it had one).
- For a check that only runs outside production, prove the audit can see:
  put one known fault back and count the reports.

## Things that bite

- **Unstub after unmounting.** A describe's `afterEach(vi.unstubAllGlobals)`
  runs before the setup file's `cleanup()`, so a component unmounted then
  calls the real global, which jsdom may lack (`cancelIdleCallback`). Call
  `cleanup()` first in that `afterEach`.
- **One coverage run per checkout.** Vitest 5 locks `coverage/`: a second
  run in the same checkout stops with "already in use by another Vitest
  process". A quick side run takes `--coverage.enabled=false`.
- **CI's e2e runs Chromium only.** A spec can fail on the phone projects
  for months: the research map's drawing tests did, until round 26 ran
  every project. Run them all before calling a round done.
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
- **A `vi.doMock` outlives its test.** After `vi.resetModules()`, a fresh
  import gets the last factory any test of the file registered for that
  module: `Skills.test.tsx`'s tests of missing data left the section with
  no cards for a later test that imported it afresh. Hoist the file's data
  (`vi.hoisted`) and register it again with `vi.doMock` in that test.
- **A file-wide `next/dynamic` mock stands in for every dynamic component.**
  `Papers.test.tsx`'s returned the PDF reader for each call, so the paper
  dialog (round 27) would have rendered as the reader. Branch on the props,
  and render the others through their own loader (`React.lazy`), which
  keeps the stand-in for a chunk that fails.
- **WebKit keeps a hover under a backdrop.** When a dialog's backdrop
  appears under a pointer that has not moved, WebKit keeps the card's hover
  (Chromium drops it), and `getBoundingClientRect()` includes the card's 2%
  hover zoom: a card that kept its size measured up to 7 px taller. Compare
  layout sizes (`offsetHeight`), as `card-details.spec.ts` does.
- **A locator read in several calls can read several elements.**
  `locator.nth(i)` resolves again on each call: reading a button's label,
  text and title in three calls, while sections mounted, read three
  different buttons, and a named page failed the name scan once in four
  runs. Read what one check needs in one `evaluate` or `evaluateAll`
  (`accessibility.spec.ts`'s name scan).
- **A library mock encodes one version of the library.** The PDF reader's
  Document mock kept the pages mounted through a reload, as react-pdf 10.0
  did; 10.5 unmounts them, and the tests stayed green on the wrong
  behavior until the mock changed (`pdf-viewer-pages.test.tsx`). Check the
  mocks of a library you upgrade. And let the test release what the mock
  delivers later: a `setTimeout(0)` delivery ran inside React's async `act`
  around the click, so no test saw the pages away.
- **The page's `?playwright=true` stops at the page.** The blog asks
  `/api/medium-posts` with no query string, so the API's own test posts
  (for `?playwright=true` on the API's address, removed since) reached no
  browser test,
  and a spec that did not answer the route showed whatever the server
  fetched from Medium. The dialog tests' posts were one sentence each, and
  a bug that cut every real post at its photo's credit passed them all.
  Answer the route in the spec with data shaped like the real thing
  (`card-details.spec.ts`, `privacy.spec.ts`), and check a fix against the
  live data too.
- **A test that walks every case runs out of time under load.** The
  dialogs' accessibility scan, eight dialogs in one test, ran out of its
  60 s at the fourth in WebKit in the Linux container, where CI is about
  3.7 times slower still. One test per case, as `card-details.spec.ts`
  does now.
- **Assigning `location.hash` before `renderHook` is a second arrival.** jsdom
  queues a `hashchange` for it and delivers it inside a later `act`, so a
  hook that restarts a timer on arrival restarts it late. A page opened at
  a link fires none: model it with `history.replaceState`
  (`useCardDeepLink.test.tsx`).
- **act from the working copy passes CI by skipping it.** paths-filter
  turns `main` into `origin/main` first, which here was the push's `before`:
  no change, every job skipped, a green summary. Rehearse from a fresh clone,
  whose `origin/main` is HEAD as on GitHub, and check that the filter's log
  lists files.
- **A container job's `run:` is sh.** In the Playwright image that is dash,
  which leaves `{1..30}` as it is: the five waits for the server ran once
  (GitHub printed "attempt {1..30}/30"). `ci-workflows.test.ts` refuses
  brace ranges; count with `seq`.
- **Under act, a server that writes after its start step stops serving.**
  The browser jobs start `npm start` in one step and test in the next. The
  squashed history's first six snapshots fetch Medium through rss2json,
  which now answers act's containers with a Cloudflare page; their server
  logged that error on every test and stopped answering, and 14 or 15 of
  their 17 browser jobs failed. One of those jobs passed 21 of 21 with the
  output in a file and failed again without it (2026-10-25). The jobs write
  to `server.log` now and print it at their end; `ci-workflows.test.ts`
  checks both.
- **A synthesized swipe moves nothing in CI's Chromium.** CDP's
  `Input.synthesizeScrollGesture` with touch scrolled the page on the Mac,
  but in CI's Linux image only touchstart and touchend arrived, so a check
  that the page did not move passed whatever the code did (2026-10-26).
  Raw points through `Input.dispatchTouchEvent` scroll there; keep a swipe
  that must move something in the test, as the phone terminal test does.
  No browser but Chromium takes a swipe from a test.
- **Wheel checks go after each wheel.** Down then up cancels out in a check
  at the end: the terminal's wheel test passed without its fix in Chromium
  until each wheel had its own check.
- **Linux WebKit draws few frames.** With the terminal open it drew 4.7 to
  7.9 frames a second alone on 4 CPUs and 0.5 beside another browser (13
  with every blur off): a test that counts frames, or that wants to see an
  animation, cannot work there. Check such things in Chromium and Firefox.
- **A spec that skips itself still fills a shard.** `--shard` splits the
  tests Playwright lists, skipped ones too. `python-terminal.spec.ts` sorts
  first, and its 22 Chromium-only tests were the whole of Firefox's and
  WebKit's terminal shard 1 of 3, which ran nothing (2 to 3 s on GitHub)
  while shards 2 and 3 took the rest. `playwright.yml` leaves them out
  there by their describe's title. `--list --shard=1/3` shows what a shard
  holds.
- **`networkidle` waits for WebKit's hydration.** At a GitHub runner's 4
  CPUs (amd64, CI's image), the homepage loaded at 9 to 10 s, hydration
  held WebKit's main thread until about 15 s, and the network went quiet
  only after the sections' fetches that follow it: 8.3 to 10.1 s after the
  load, 12 loads in 12. The terminal spec's 8 s wait for it failed 9 tests
  in 44. On the Mac, and at d8da49f, the quiet came at the load, which hid
  this. Wait for what the test needs instead: `waitForSplashToEnd`, a
  control that is visible.
- **A test's own timeout can be less than CI's.** `test.setTimeout(60000)`,
  "to increase" it when the default was lower, cuts the config's 300 s in
  CI, setup included. The accessibility describe gave every test 60 s in
  WebKit (30 in Chromium), and the terminal's resize test 60 s under its
  describe's 240: at a runner's 4 CPUs they ran out. Set a timeout only
  above the config's.
- **axe counts opacity.** An element mid-fade reads at a fraction of its
  contrast: the skills manifesto's sentence, which fades every 6 s, read
  1.04:1 to a whole-page scan. `showWholePage` pauses it first.
- **A focus scroll aims at the page of the moment.** Projects and Blog fill
  in when their data comes, after the splash; in WebKit at a runner's 4
  CPUs, 1 to 3 s after it, growing the page by 134 and 820 px. A footer
  link focused before that scrolled to the old end of the page and stayed
  under the cookie notice. Let the page reach its height first (the footer
  test waits for Projects to load and the height to hold for 2 s).

## GitHub's WebKit, before a push

act runs the browser jobs in CI's image on amd64 too (`.actrc`), but on all
of Docker's 16 CPUs, too fast for Linux WebKit's timing failures to show.
Each of GitHub's last five runs (2026-08 to 2026-10-04) had a WebKit
terminal test pass only on its retry: `help` in all five, tab completion in
the three August ones, `about` and a drag once each. Four act rehearsals had
none. The same image at a runner's 4 CPUs comes close (Docker Desktop runs
amd64 under Rosetta, a setting), and `scripts/e2e-container.sh` sets it up:
a commit built and served as `playwright.yml` does, in the image it names,
then a job's specs run there with CI's environment. It refuses a second run
in a container that is running one, and Ctrl-C stops a run's tests in the
container too.

```bash
bash scripts/e2e-container.sh start webkit-ci        # HEAD; or a commit
bash scripts/e2e-container.sh run webkit-ci tests/e2e/terminal.spec.ts \
  --project=webkit --retries=0 --repeat-each=10 --reporter=line,json
bash scripts/e2e-container.sh stop webkit-ci
```

Logs, the JSON report and each run's `test-results/` land in the folder
`start` prints (`OUT` to choose it). `PLATFORM` and `CPUS` change the
machine: `PLATFORM=linux/arm64` is native and about twice as fast.

Calibrated on d8da49f, whose GitHub run is known, in its own image there.
A hash marked pre-squash below names a state of the history from before
it was squashed, kept as the local tag `archive/pre-squash-2026-10-23`
(`docs/performance.md`, "Results").

- WebKit: its terminal shards took 3.2 and 3.7 min against GitHub's 2.3
  and 2.9, and 4 tests passed on retry where GitHub had 3. About 1.3 times
  slower than GitHub, and as flaky.
- Chromium: navigation and performance took 1.5 min and 41 s against
  GitHub's 1.0 min and 21 s at 4 CPUs, and 54 s and 19 s at `CPUS=8`,
  GitHub's speed. Run a Chromium job at 8, or its timing-bound tests fail
  for the container: 24 of the performance job's 76 did at 4, 1 at 8.
  Even at 8, a Chromium failure that comes down to a slow main thread (a
  timeout on the splash's loading bar, or on hydration) may be the
  container's: Rosetta slows that thread more than its CPU benchmark says
  (below). Find its cause before calling it GitHub's; 18 of the 24 at 4
  CPUs waited on the loading bar.
- Lighthouse scores about 20 points low here at any CPU count: d8da49f
  scored 63 against GitHub's 83. First and largest paint and layout shift
  earn all their 60 points; Total Blocking Time and Speed Index, Chromium's
  main thread, earn 3 to 5 of their 40 (at `fa5a1e9`, pre-squash, 2.9 to 4.1 s and 6.7
  to 7.5 s), and 8 CPUs cut the first by 29% without lifting its score off
  the floor. So a score here says nothing of GitHub's, which can lie
  anywhere from about 65 to 95 for the same reading: "Lighthouse before a
  push" projects it.

Why Chromium needs 8 CPUs where WebKit does with 4 is measured in part:
Chromium's page work runs slower here than Lighthouse's CPU benchmark says.
At the same benchmark slowdown, about 4, its Total Blocking Time is
2,930 ms in this container and 280 ms natively on arm64, and its Speed
Index 6.7 s against 1.7 s ("Lighthouse before a push"). Whether WebKit's
engine loses less under Rosetta, as its 1.3 times against Chromium's 1.5
to 1.9 suggests, is not measured. Docker Desktop also starts every `node` in an
amd64 container with V8's optimizing compiler off (`--no-opt`, hidden from
`process.execArgv` by a preload at `/proc/.reset`), so the server and
Playwright's runner run unoptimized for both browsers; Chromium's own
processes carry no such flag, and first paint at 0.4 s says the server is
not what Lighthouse marks down.

A busy Mac voids all of it: research jobs on 12 of its 16 CPUs took a pass
that had failed once at GitHub's speed to 21 failures. The script warns
when the host's load is over half its CPUs.

The sweep of 2026-10-22 ran the terminal job's 44 WebKit tests some 590
times. Found, each fixed in its own commit:

- The setup's 8 s wait for a quiet network failed 9 tests in 44 (above,
  "`networkidle` waits for WebKit's hydration").
- The resize test's own 60 s timeout, written as an increase, cut the
  describe's 240 s for WebKit: it took 52 to 64 s and failed 3 runs of 9.
- In the focus test, xterm's own focus call, from a 50 ms timer, came after
  the test's and took the focus back (1 run of 9). The welcome test read
  xterm's rows before the second line was drawn (1 of 9).
- `waitForSplashToEnd` allowed 15 s for the hydrated app to remove the
  backdrop; it once took longer under the full suite's load (40 loads
  alone: 3.9 to 11.8 s after the load). It allows 30.

One context took 300 s to create, inside WebKit before any page code ran;
GitHub's five runs show none, so it is put down to the container. With the
fixes: the four tests 40 runs of 40, a full pass 43 passed and 1 skipped.
GitHub's flaky ones passed throughout: `help`, `about` and tab completion
11 of 11, the drag 41 of 41.

The accessibility job's 84 WebKit tests, run once there after the act
rehearsal had shown one of them flaky, failed 6:

- Four ran out of the describe's own 60 s (above, "A test's own timeout
  can be less than CI's"), at 61 to 66 s.
- A whole-page contrast scan met the skills manifesto mid-fade (above,
  "axe counts opacity").
- The cookie notice's footer test focused a legal link while Projects and
  Blog were still filling in (above, "A focus scroll aims at the page of
  the moment"), and the link ended under the notice. A first reading, that
  the notice published its height too late, did not survive a probe: the
  height and the scroll padding were in place in 8 runs of 8. That change
  was reverted.

With the fixes, three passes: 83 passed and 1 skipped each, the slowest test
108 s against CI's 300.

Then every other job once there (2026-10-22, at `fa5a1e9`, pre-squash). Navigation in
Chromium, Firefox and WebKit, the terminal in Chromium and Firefox and the
accessibility job in Chromium passed. Found:

- The phones' rail test waited 15 s for the floating rail, which mounts
  after hydration: Mobile Safari loaded at 15 s and the rail came 8 to
  11 s later, once past the wait. It waits for the splash to go first now.
- At GitHub's Chromium speed (`CPUS=8`), the splash stand-in test failed 1
  run in 2: it told the stand-in from the 4 s timer by a clock that starts
  at the page, while the timer starts at the app's mount. It opens the
  terminal instead, which only a completed splash allows; a mutant whose
  stand-in never completes fails it. With the fix, the whole job passed
  twice there on a quiet Mac (load under 5 on 16 CPUs): 75 tests and one
  skipped, 1.8 min each; in the second, the slowest test took 14 s of
  its 300.
- Lighthouse scored 63 to 65, as d8da49f does here (83 on GitHub).

## Lighthouse before a push

The deploy waits for the Lighthouse job (`tests/e2e/lighthouse.spec.ts`,
the median of three audits: performance 80, FCP 1.5 s, LCP 2 s, CLS 0.1,
Total Blocking Time 1,000 ms, TTI 3 s). It audits with no CPU slowdown,
since GitHub's runner is the slow machine. Round 20's method projects its
result on the Mac: Chromium native on arm64, with Lighthouse's CPU
slowdown set to what GitHub's runners take, about 3.7 times the idle arm64
container's CPU time (`docs/performance.md`, round 20). The spec's own
assertions are then the gate's.

```bash
PLATFORM=linux/arm64 CPUS= bash scripts/e2e-container.sh start lh
LIGHTHOUSE_CPU_MULTIPLIER=3.7 bash scripts/e2e-container.sh run lh \
  tests/e2e/lighthouse.spec.ts --project=chromium --retries=0 --reporter=line
bash scripts/e2e-container.sh stop lh
```

At `90d7c32` (pre-squash, 2026-10-22, an idle benchmark of 3,934), three runs at
GitHub's slowdown (3.7 to 3.8) scored 92 to 96: TBT 236 to 347 ms, SI 1.6
to 1.7 s, TTI 1.7 to 1.9 s, LCP 0.86 to 0.92 s, CLS 0. Three at 1.55 to
1.85 times it scored 83 to 86 (TBT 543 to 711 ms, TTI 2.0 to 2.3 s), and
all six passed. Round 20's HEAD scored 89 to 91 at GitHub's slowdown (TBT
367 to 443 ms): nothing has regressed since. Lighthouse simulates the
slowdown from a trace, so a run takes about 45 s at any multiplier.

- A run's slowdown is its multiplier times 3,982, the idle container's CPU
  benchmark, over the run's own, which each log line names with the
  multiplier. Run 1.5 times the multiplier as well for the margin (round
  20's HEAD passed at 1.7 to 1.8 times GitHub's slowdown).
- Wait for a quiet Mac rather than scale the multiplier down: under
  research jobs on 14 of its 16 CPUs, a run at an effective 6.5 scored 76
  and failed, where a quiet Mac gave 83 to 86 at 5.7 to 6.8.
- On arm64, `start` keeps the image under a local tag of its own
  (`claret-e2e/playwright:<version>-arm64`), made on first use: Docker's
  image store here keeps one architecture per tag, and an arm64 pull under
  the shared tag would replace the amd64 image.
- 3.7 dates from 2026-10-18: GitHub's runners worked as a CPU benchmark
  near 1,100 would. The job's log names its runner's benchmark for each
  audit since round 20, and no GitHub run has logged one yet: recalibrate
  from the first.
- The script's build and server are the Lighthouse job's in effect: GitHub
  data needs `USE_GITHUB_DATA=true` and `GH_USERNAME`, which neither sets,
  and the script's `SKIP_EXTERNAL_APIS` only skips Medium's article images
  in `/api/medium-posts`.

## On a phone or a tablet

Over Tailscale a phone reaches the Mac at the Mac's Tailscale address. Test
a production build there: the dev server's page weighs about 30 MB
(unminified, with its live-update code), the production page 2.8 MB
(2026-10-26), and a phone whose network blocks direct connections goes
through one of Tailscale's relays (from UCD's network, London's: 40 to 125
ms a round trip). Build in another checkout, or with the dev server
stopped, since both write `.next`:

```bash
SERVE_HTTP=true npm run build
npx next start -p 3001 -H <the Mac's Tailscale address>
```

`-H` keeps the server off the Mac's other addresses (on UCD's network, a
public one). Plain http stays private inside the tailnet, and `SERVE_HTTP`
drops the headers that would send the browser to https.

`npm run dev` and `dev:https` listen on 127.0.0.1 alone: Next's default,
every interface, put the dev server on UCD's public address with the Mac's
firewall off (`localhost` would bind `::1` alone, which `127.0.0.1` then
misses). A dev server for a phone listens on the Tailscale address instead,
and its host must be allowed: Next 16 refuses its dev resources to any host
but localhost, and the page then never hydrates (its live-update connection,
`/_next/hmr`, is refused; its buttons, data and terminal stay dead). It is
slow on a phone, and localhost does not reach it while it runs.

```bash
DEV_ALLOWED_ORIGINS=<the Mac's Tailscale address>,<machine>.<tailnet>.ts.net \
  npx next dev --webpack --experimental-https -H <the Mac's Tailscale address>
```

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
