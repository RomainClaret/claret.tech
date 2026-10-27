# Performance

What a visitor's machine pays to keep the homepage open, and what a visit
downloads. Measured with `scripts/perf/measure.mjs`.

## Running the harness

Measure a production build. `next dev` is much slower and not representative.

```
SERVE_HTTP=true npx next build --webpack
SERVE_HTTP=true npx next start -p 3000 -H 127.0.0.1
node scripts/perf/measure.mjs --label <name> --runs 3
```

- `SERVE_HTTP=true` is needed at build and start time on plain http. Without it the
  HTTPS-forcing headers blank the page in WebKit (commit f36b93e).
- `--webpack`: Next 16 builds with Turbopack by default, and the custom
  webpack config does not apply there (`npm run build` passes it too).
- `npx next build` skips the `prebuild` scripts. Those regenerate colour data
  from the network, which you don't want between two measurements.
- `--scenarios S1,S8` picks scenarios, `--settle` sets the wait after load in ms
  (default 12000), and `--no-save` skips the results file.
- Results are printed as a table (the median of the runs) and appended as JSON
  lines to `perf-results/<date>.jsonl`, which is gitignored.
- Analytics requests are blocked, so measurement runs don't count as visits.

The browser is headless Chromium. Its software GPU (SwiftShader) stands in for
a machine without a graphics card, and the DevTools protocol throttles the CPU.
WebKit runs for frame pacing only. The harness does not drive Firefox, and
Firefox does not start inside the macOS sandbox this was developed in: run
its tests in Playwright's Linux image (below), and check its costs by hand,
with the Firefox Profiler's idle view before and after a change.

## Scenarios

| id  | What                                                            | Quality tier                               |
| --- | --------------------------------------------------------------- | ------------------------------------------ |
| S1  | Hero, idle. Also load metrics, CLS and a full-page scroll       | BALANCED forced (where every visit starts) |
| S1M | S1 at MAXIMUM, where the automatic loop takes a capable machine | MAXIMUM forced                             |
| S1A | S1 with the cookie notice dismissed, as a returning visitor     | BALANCED forced                            |
| S2  | Scrolled to Papers, idle                                        | BALANCED forced                            |
| S3  | Scrolled to Education, idle                                     | BALANCED forced                            |
| S4  | Scrolled to Contact, idle                                       | BALANCED forced                            |
| S5  | The PDF reader modal open on the CV                             | BALANCED forced                            |
| S6  | The splash window, the first 2.5 s after load                   | BALANCED forced                            |
| S7  | Phone (390×844 at 3×), CPU 4× slower, load and scroll           | automatic                                  |
| S8  | Desktop, CPU 4× slower, load                                    | automatic                                  |
| W1  | WebKit, hero, idle                                              | BALANCED forced                            |
| P1  | `/pdf/phd-thesis` at DPR 2: canvas memory                       | n/a                                        |

The forced tiers are a manual pick (`quality-auto=false`), which runs no
frame sampler, and an automatic tier runs none while animations are off
(Safari's default; both since `60bea03`): the sampler only
feeds the automatic loop and, at battery saver, auto-disable. With
animations playing its share is within noise ("Frame sampler", below), so
S1 to S6 still stand for an automatic visit at their tier.

## What the columns mean

| Column        | Meaning                                                                           |
| ------------- | --------------------------------------------------------------------------------- |
| main%         | Share of a 5 s quiet window the main thread spent in tasks                        |
| recalc/s      | Style recalculations per second in that window                                    |
| fps, >20ms    | Frame pacing over 2 s, and frames slower than 20 ms                               |
| anims, offscr | Running CSS/Web Animations, and how many target an element over 200 px off-screen |
| smil          | Live SVG `<animate>` elements (in an SVG whose animations are not paused)         |
| CLS           | Cumulative layout shift during load (no input)                                    |
| jsKB          | Script bytes transferred in the first 12 s, lazy chunks included                  |
| scroll>20     | Frames over 20 ms during a scripted full-page scroll                              |
| canvasMB      | Canvas backing store in the PDF reader                                            |

## Results

The local history was squashed into phases on 2026-10-23, and round 28
into one commit on 2026-10-26. A hash marked pre-squash, and every other
hash in its paragraph, list item or table, names a measured state in the
history from before that, kept as the local tag
`archive/pre-squash-2026-10-23` (rounds 1 to 27) or
`archive/pre-squash-2026-10-26` (round 28); any other hash is a commit of
this history.

### Baseline: `ce75bc9` (pre-squash), before the 2026-10 performance pass

Median of 3 runs (W1 and P1: 1 run).

| id  | main% | recalc/s | fps  | >20ms | anims | offscr | smil | heapMB | nodes | CLS   | jsKB | scroll>20 | canvasMB |
| --- | ----- | -------- | ---- | ----- | ----- | ------ | ---- | ------ | ----- | ----- | ---- | --------- | -------- |
| S1  | 37.5  | 3091     | 72.9 | 14    | 47    | 38     | 98   | 24.8   | 5584  | 0.135 | 662  | 52        |          |
| S2  | 29.9  | 1532     | 91.6 | 0     | 42    | 38     | 34   | 35.0   | 5083  |       |      |           |          |
| S3  | 29.6  | 894      | 94.6 | 1     | 42    | 37     | 32   | 25.6   | 5069  |       |      |           |          |
| S4  | 27.4  | 1081     | 88.6 | 0     | 40    | 36     | 42   | 36.5   | 5083  |       |      |           |          |
| S5  | 20.9  | 1230     | 33.4 | 52    | 43    | 39     | 86   | 31.1   | 6462  |       |      |           |          |
| S6  | 71.4  | 1268     |      |       |       |        |      | 36.9   |       |       |      |           |          |
| S7  | 99.8  | 1318     | 52.2 | 33    | 44    | 38     | 90   | 37.3   | 5661  | 0.592 | 662  | 248       |          |
| S8  | 91.3  | 1654     | 33.4 | 61    | 43    | 38     | 94   | 30.0   | 5650  | 0.169 | 662  |           |          |
| W1  |       |          | 60   | 0     | 16    | 16     | 2    |        | 4798  |       |      |           |          |
| P1  |       |          |      |       |       |        |      | 69.8   | 75382 |       |      |           | 7824     |

**What each scenario shows:**

- **Never idle.** The page keeps the main thread busy while nobody touches it: 27-37% at full CPU, wherever you are on the page, and 91-100% at 4× slower.
  - SVG `<animate>` drives thousands of style recalculations per second.
  - Most running animations (36-39) target off-screen elements.
- **No click needed for the heavy chunks.** pdf.js (`pdfjs.*`), the terminal (`terminal.*`, `2390.*`) and lottie (`7853.*`) load on every visit without any interaction.
- **Layout shifts at load.** CLS comes from the splash box resizing (`div.max-w-md.w-full.px-8`) and the hero phrase's half-typed words wrapping.
- **PDF reader.** The PhD thesis asks for 7.8 GB of canvas.

### After Phases 1-4: `b87c925` against `ce75bc9` (pre-squash, 2026-10-08)

Median of 2 runs per scenario, alternating between the two builds (baseline,
candidate, baseline, ...), both serving the same content. S5 did not run on the
baseline (see "Measuring well" below for why its first runs failed).

| id  | main%       | recalc/s   | fps          | >20ms  | offscr | heapMB      | nodes       | CLS           | jsKB      | fontKB   |
| --- | ----------- | ---------- | ------------ | ------ | ------ | ----------- | ----------- | ------------- | --------- | -------- |
| S1  | 36.1 → 24.5 | 2821 → 114 | 74.9 → 103.8 | 14 → 2 | 38 → 0 | 39.5 → 23.1 | 5565 → 4826 | 0.127 → 0.087 | 662 → 387 | 208 → 79 |
| S2  | 29.0 → 14.9 | 1260 → 98  | 120 → 102.8  | 0 → 0  | 38 → 1 | 25.7 → 14.3 | 5064 → 4454 |               |           |          |
| S3  | 24.7 → 15.4 | 1656 → 82  | 77.3 → 87.5  | 8 → 1  | 37 → 1 | 37.5 → 16.3 | 5118 → 4467 |               |           |          |
| S4  | 25.0 → 13.3 | 1092 → 93  | 85.1 → 98.3  | 1 → 2  | 36 → 1 | 43.8 → 14.5 | 5107 → 4453 |               |           |          |
| S6  | 61.5 → 50.3 | 1661 → 116 |              |        |        | 33.2 → 17.6 |             |               |           |          |
| S7  | 99.6 → 57.1 | 1507 → 120 | 75.3 → 120   | 2 → 0  | 38 → 2 | 40.1 → 17.4 | 5683 → 4900 | 0.321 → 0.116 | 662 → 387 | 208 → 79 |
| S8  | 95.0 → 77.1 | 1757 → 101 | 46.8 → 89.3  | 46 → 6 | 38 → 0 | 46.6 → 19.8 | 5537 → 4830 | 0.120 → 0.081 | 662 → 387 | 208 → 79 |

Scroll jank (frames over 20 ms in the scripted scroll): S1 36 → 36, S7 52 → 10.
Everything fetched with no interaction: 1,153 → 709 KB on S1. pdf.js, xterm,
the terminal commands, the Pyodide client, DOMPurify and the full Lottie player
no longer load until someone reaches for them.

### Phases 5-6: targeted checks on the build after them

| Check                                                      | Baseline              | After          |
| ---------------------------------------------------------- | --------------------- | -------------- |
| P1: PhD thesis at DPR 2, canvases / canvas memory          | 368 / 7,824 MB        | 3 / 43 MB      |
| P1: JS heap; text spans in the page (find-in-page)         | 85 MB; 53,486         | 46 MB; 53,486  |
| CLS (S1 / S7 / S8)                                         | 0.127 / 0.321 / 0.120 | 0 / 0.0003 / 0 |
| Window resize listeners after 4 terminal open-close cycles | 9 → 17                | 10 → 10        |

### Final: `acd4ead` against `ce75bc9` (pre-squash, 2026-10-08)

Phases 0-6 and 8. Median of 2 runs per scenario, alternating between the two
builds, both with the same content and assets.

| id  | main%       | recalc/s   | fps           | >20ms   | offscr | heapMB      | nodes       | CLS       | jsKB      | fontKB   |
| --- | ----------- | ---------- | ------------- | ------- | ------ | ----------- | ----------- | --------- | --------- | -------- |
| S1  | 35.6 → 26.6 | 1860 → 109 | 74.5 → 91.1   | 14 → 3  | 38 → 0 | 25.4 → 20.8 | 5505 → 5004 | 0.135 → 0 | 662 → 381 | 208 → 79 |
| S2  | 29.5 → 15.1 | 1953 → 100 | 110.1 → 101.6 | 0 → 0   | 38 → 1 | 26.8 → 14.6 | 5107 → 4473 |           |           |          |
| S3  | 27.0 → 14.7 | 1867 → 88  | 94.9 → 89.1   | 3 → 1   | 37 → 1 | 29.8 → 15.2 | 5115 → 4490 |           |           |          |
| S4  | 26.6 → 13.5 | 1311 → 89  | 103.8 → 99.0  | 2 → 2   | 36 → 1 | 31.2 → 14.7 | 5085 → 4468 |           |           |          |
| S5  | 20.3 → 7.0  | 1519 → 51  | 38.8 → 55.8   | 45 → 28 | 39 → 0 | 38.9 → 21.1 | 6496 → 5733 |           |           |          |
| S6  | 60.3 → 50.9 | 809 → 116  |               |         |        | 38.3 → 18.0 |             |           |           |          |
| S7  | 99.7 → 50.4 | 2285 → 120 | 67.5 → 120    | 9 → 0   | 38 → 2 | 40.3 → 18.8 | 5722 → 4766 | 0.320 → 0 | 662 → 381 | 208 → 79 |
| S8  | 96.3 → 72.8 | 2555 → 107 | 43.4 → 86.3   | 49 → 1  | 38 → 0 | 44.6 → 17.5 | 5600 → 4756 | 0.143 → 0 | 662 → 381 | 208 → 79 |

- **P1** (PhD thesis at DPR 2): 368 → 3 canvases, 7,824 → 43 MB of canvas,
  heap 78.5 → 40.6 MB.
- **Everything fetched with no interaction** (S1): 1,153 → 704 KB.
  First-load JS for `/` in the build output: 271 → 242 kB.
- **Scroll jank** on the phone (S7): 59 → 11 frames over 20 ms. On the
  desktop (S1) no measurable change: 36 and 37.5 over 4 runs each, with a
  spread of 19-54 between runs.
- **Frame throughput** in S2-S4 is 5-8% lower on the software GPU, with 0-2
  frames over 20 ms on either side, so no frame misses a 60 Hz display: the
  decorative loops now run on the compositor rather than the main thread,
  whose share halved.
- S7 and S8 run at LOW: the startup check classes a software GPU as weak.

### After the review fixes: `e5320b1` against `acd4ead` (pre-squash, 2026-10-08)

The 65 commits of review fixes after the pass, measured the same way.
Absolute numbers drift between sessions (S7 measured 50.4% on `acd4ead`, pre-squash, in
the table above and 68-78% here), so compare within a table, not across.

| id  | main%       | fps          | >20ms      | heapMB      | scroll>20   |
| --- | ----------- | ------------ | ---------- | ----------- | ----------- |
| S1  | 28.1 → 27.1 | 79.0 → 89.7  | 8.5 → 2.0  | 24.9 → 18.5 | 50.5 → 31.5 |
| S1M | 38.2 → 36.7 | 104.8 → 72.3 | 3.0 → 17.5 | 19.6 → 18.3 | 49.5 → 33.0 |
| S1A | 30.4 → 30.6 | 107.6 → 102  | 0.5 → 0    | 20.4 → 21.2 | 42.5 → 15.0 |
| S2  | 16.2 → 16.1 | 88.4 → 99.7  | 0.5 → 0    | 14.7 → 14.4 |             |
| S3  | 16.4 → 18.0 | 81.2 → 85.1  | 5.5 → 4.0  | 16.0 → 14.6 |             |
| S4  | 14.9 → 15.0 | 90.7 → 92.5  | 1.0 → 1.5  | 13.9 → 14.7 |             |
| S5  | 7.9 → 0.9   | 54.8 → 57.1  | 34 → 35    | 26.0 → 19.7 |             |
| S6  | 54.5 → 53.1 |              |            | 17.2 → 15.2 |             |
| S7  | 76.4 → 95.5 | 119.3 → 110  | 0 → 0.5    | 22.3 → 20.7 | 23.5 → 28.5 |
| S8  | 82.7 → 80.0 | 60.0 → 81.1  | 23.5 → 15  | 14.9 → 15.7 |             |

- **S7 regressed, and is fixed.** Since `ae53e80` (pre-squash) the hero's cover was judged
  against the site grid's own box, measured once while a phone's layout
  viewport was briefly 394 px wide during load: the whole site grid
  animated under the hero, with twice the running animations. With
  `7dd7216` (measure again when the grid's box changes) and `9469a6e` (a
  Research tooltip made every page under 600 px wide pan sideways by up to
  31 px), S7 is 70.6-71.3% against 67.8-75.2% for `acd4ead`, and its
  scroll jank 17-20 against 26 frames over 20 ms.
- **S5**: the brain canvas now stops under the PDF reader (`183b3d9`).
- **S1M** (MAXIMUM, where the automatic loop takes a capable machine) costs
  5-10 points more than S1 on the same build. Its SMIL count is no measure
  of a change: it is a snapshot of whatever signals are in flight, and the
  same `acd4ead` (pre-squash) build read 168, 192 and 312 in three runs.
- First-load JS for `/`: 242 → 245 kB (the fallbacks and the quality loop's
  backoff).

### Part 2 (2026-10-08): each change against the commit before it

Measured one change at a time against a build of the previous commit,
interleaved; traces for scroll work, file sizes from the build manifest.

| Change                                           | Measured                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| framer-motion features after hydration           | JS `/` loads before hydrating: 904.7 → 843.9 KB raw, 275.3 → 253.4 KB gzip                             |
| Montserrat Latin subset, full font for the rest  | font fetched on a full visit: 78,724 → 40,508 B; text byte-identical at DPR 2                          |
| no permanent layer per card and skill badge      | main-thread paint in a full scroll: 320-349 → 115-127 ms; frames over 20 ms lower in each pair         |
| Kudos card's color extracted when near           | 45 KB image, the colorthief chunk and the extraction left out of visits that never reach the blog      |
| MAXIMUM particles travel, three per signal       | S1M main thread unchanged (median 35.1%); eight traveling particles cost 36 → 43%                      |
| Latin subset keeps the default features and tnum | font file 40,508 → 25,876 B (913 → 501 glyphs); S1 fetches 41.2 → 26.9 KB of font; text byte-identical |

- **Fixed on the way:** the phone regression above, and MAXIMUM's signal
  particles, which had never moved: SMIL begin offsets count from their SVG's
  start, so particles added to a running grid began in the past and sat
  frozen at the end of their path.
- **Tried and reverted:** IntersectionObservers instead of the scroll
  handlers (see the trap below).
- **Left out, with the reason:** dropping the publications refetch (an
  invisible request and re-render under the splash, against rewriting
  fifteen tests that feed data through it); minifying the favicon scripts
  (10 KB, not render-blocking); moving `.prose` out of the main stylesheet
  (needs a second Tailwind build); converting the constellation, signal
  draw and brain pulse from framer to CSS (pausing every CSS animation at
  once saves 5.7 points, so each of these is worth 1-3, under the run-to-run
  spread).

### Static homepage (2026-10-08)

`/` used to be rendered on every request: the root layout read the theme
and Safari cookies, which made each page view a function call. On the live
site that cost 200-350 ms before the first byte from Europe (the edge in
Dublin, the function in US East) and about a second when the function was
cold; the splash's timer starts at hydration, so none of it was hidden.

Now `next build` lists `○ /` and `● /pdf/[slug]`, there is no middleware,
and `next start` answers `/` from the prerender cache (3-8 ms here against
17-23 ms for the render) with an ETag, a 304 on revalidation and no cookie.
How it holds together:

- **One HTML for everyone** (light, not Safari). A blocking ES5 script, first
  in `<head>` (`lib/boot/head-boot.ts`), puts the visitor's theme and
  browser on `<html>` before the first paint.
- **The splash's backdrop is the first paint**, rendered by AppWrapper
  (the splash itself loads with `ssr: false`) until the splash shows, or
  4 s after hydration at most. Everything that depends on the visitor
  (Safari flag, quality tier, animation choice, auto-disable, footer year)
  renders the server's value and settles after hydration, under it.
  Today's flash of the page before the splash is gone; a `<noscript>` rule
  keeps the page visible without scripts.
- **If the bundle never runs** (a blocked or missing chunk, an error before
  hydration), a CSS animation in `globals.css` hides the backdrop 6 s after
  its first paint. A working bundle removes it first (0.5 s after the first
  paint here, 3.6 s on Fast 3G with a 4x slower CPU); on Slow 3G the page
  shows 6 s after the first paint.
- **Content that framer starts at opacity 0 shows without framer.**
  framer-motion puts each `m` element's initial state in the HTML, which
  for most of the text in `<main>` is opacity 0, and only its features
  chunk, loaded after hydration since `183b3d9`, animates it in. When that
  chunk fails, the bundle never runs or scripts are off, `globals.css` shows
  that content instead: at once when the chunk failed twice (MotionProvider
  asks once more a second after a first failure, so a transient one still
  ends with the animations, then marks `<html data-motion-features>`), 6 s
  after the first paint when nothing
  said it arrived, and at once under `<noscript>`. Readable text in
  `<main>` without scrolling went from 14% to 84-86% in those three cases,
  against 85% on a normal visit. On Fast 3G with a 4x slower CPU the
  features arrive 4.1 s after the first paint and nothing changes; on Slow
  3G the content shows at 11.1 s instead of 19 s, and fades in once more
  when the features arrive (18.9 s).
  The experience timeline's cards wait for an IntersectionObserver of
  their own, with classes rather than framer's inline styles, so these
  rules missed them: 43% of that section could be read without scripts or
  when the bundle never ran. They mark the wait (`data-reveal="pending"`)
  and the same rules show them, except when only framer's chunk failed:
  their observer still brings them in then.
- **A page on screen before the splash keeps the screen.** When the 4 s
  timer or the CSS fallback uncovers the page before the splash shows (Slow
  3G: the splash used to arrive 7.7 s later and cover the page for two
  seconds, scroll locked), the splash skips itself: it still does its work
  (browser detection, the background, the projects) but shows nothing.
  AppWrapper sees the fallback through its `animationend`, or on mount if
  it ended before hydration.
- **If the splash's own chunk fails, the page shows without it.** Its
  loader goes through `withLoadFallback`: the stand-in tries once more as
  it mounts (webpack forgets a failed chunk, so the second `import()`
  requests it again), then `SplashUnavailable` completes the splash, which
  removes the backdrop and opens the terminal's gate. Before, React.lazy
  threw into AppWrapper's error boundary and the whole site became its
  error screen until a reload. With every request for the chunk aborted,
  the page shows at 0.45 s (Chromium) and 0.70 s (WebKit). A clean load is
  unchanged: one request, and the splash shows at a median of 346 ms
  against 351 ms before (Chromium).
- **Guards:** `.github/scripts/check-static-home.mjs` fails the build job if
  `/` stops being prerendered or a middleware or proxy returns (Next 16
  records a `proxy.ts`, or any Node.js middleware, in
  `functions-config-manifest.json`, not `middleware-manifest.json`: the guard
  reads both since round 14);
  `tests/e2e/static-shell.spec.ts` pins the first paint, a clean hydration,
  the no-script page, the page when the bundle never runs or the splash,
  its player or the hero's brains cannot be fetched, and no splash over a
  page already on screen; `tests/e2e/motion-fallback.spec.ts`, the
  content when framer's features never arrive, and that a normal visit
  keeps its entrance animations.

Checked against a build of the commit before, in Chromium and WebKit, light
and dark: after the splash the theme, tier, browser attributes and site grid
match, and text and cards screenshot byte-identical. **Still to check on
Vercel** (needs a deploy): `x-vercel-cache: PRERENDER` then `HIT` on `/`,
and the first byte at edge speed.

### End to end: `40ec705` against `acd4ead` (pre-squash, 2026-10-08)

Part 2 and the static homepage together, against the end of the first pass:
S1 six times and S1M three times per build, interleaved, at a load average
of 7.6 to 12.4. Medians, with the range in brackets. The last column is the
target the part 2 plan set.

| Measure                                  | `acd4ead` (pre-squash) | `40ec705`           | Target |
| ---------------------------------------- | ---------------------- | ------------------- | ------ |
| Fetched with no interaction (S1)         | 705.5 KB               | 621.5 KB            | 600 KB |
| Font                                     | 78.5 KB                | 41.2 KB             | 32 KB  |
| Images                                   | 53.9 KB                | 10.0 KB             |        |
| JS the HTML loads before hydrating, gzip | 314.2 KB               | 295.8 KB            |        |
| First-load JS in Next's build table      | 242 kB                 | 245 kB              | 225 kB |
| S1 main thread, BALANCED                 | 27.9% [26.2-28.8]      | 29.1% [28.6-30.1]   | 23%    |
| S1M main thread, MAXIMUM                 | 34.3% [31.9-38.0]      | 35.2% [33.7-35.3]   | S1 + 5 |
| S1 frames over 20 ms in a full scroll    | 48 [35-63]             | 27 [14-46]          | 25     |
| S1M frames over 20 ms in a full scroll   | 54 [53-57]             | 27 [26-31]          |        |
| S1 heap                                  | 21.4 MB                | 18.4 MB             |        |
| `/` from `next start`                    | rendered, 17-23 ms     | prerendered, 3-8 ms |        |

- **No numeric target is met.** Bytes, scroll jank and heap went down;
  S1's main thread, S1M's and Next's first-load figure did not, for the
  reasons below.
- **Bytes:** 84 KB less per first visit. Next's build table reads 245 kB
  before and after framer's features left the critical path (`183b3d9`), so
  it does not see that change; the build manifests and the served HTML's
  script tags do (18.4 KB gzip less).
- **Font:** the 32 KB estimate assumed pyftsubset's default OpenType
  features; the file measured here kept every feature (40.5 KB, 913
  glyphs). Since then (Romain's choice, 2026-10-08) it keeps the defaults
  plus `tnum`, the only other feature the site uses (`tabular-nums` in the
  progress ring): 25,876 B and 501 glyphs, so S1 fetches 26.9 KB of font
  instead of 41.2, under the target, and 607 KB in all. The glyphs left out
  (small caps, oldstyle and superior figures, alternates) are reached by no
  CSS on the site. Text renders byte-identical at DPR 2 in Chromium and
  WebKit: every section of `/` and the footer, and `#experience`, which
  changes between two loads of the same build, compared per text element
  (58 of 58).
- **S1 main thread, +1.2 points.** Bisected with S1 three times on each of
  four builds, order rotated: `acd4ead` (pre-squash) 28.3%, `7dd7216` 27.9%, `c83df26`
  27.7%, `40ec705` 29.3%, so it arrives with the static homepage. Traces of
  the same window find no new work there: the same `requestAnimationFrame`
  call sites at the same rates, the same timers, the same layout time (101
  to 106 ms per 5 s) and the same signal rate (Mann-Whitney U = 17 over 7
  runs each). Main-thread time per frame is equal or lower (`c83df26` 3.08
  to 3.46 ms, `40ec705` 2.67 to 3.16 ms), and over 12 traced runs the busy
  time is the same (medians 1,496 and 1,503 ms per 5 s). The harness's main%
  follows its uncapped frame rate (S1 fps 79.5 to 87.8 here), which a
  display caps.
- **Where the hero's idle main thread still goes**, out of about 1,500 ms
  busy per 5 s: compositor updates 269 to 288 ms, style recalculation 179 to
  220 ms, the brain canvases 165 to 179 ms, framer's frame loop 90 to 108 ms.
  Reaching 23% needs the framer-driven SVG (signal draws, constellation,
  brain pulse) moved to CSS, which part 2 left out because each conversion
  alone sits under the run-to-run spread.
- **S1M** costs 6.1 points over S1, against a target of 5, and its particles
  now move (before, they sat frozen at the end of their paths). Moving
  particles add style recalculations (96 to 1,463 per second at MAXIMUM) at
  no measurable main-thread cost.
- **Scroll** jank fell 44% in the median, from the card layers (`183b3d9`).
  The spread is wide: the same build read 14 to 18 in one set of runs and
  36 to 46 in the next, an hour later.

### Frame sampler (2026-10-10)

The frame sampler (`useFpsOnly`) requested a frame on every display refresh
for the whole visit, whether or not the quality loop or auto-disable read
it. On an otherwise still page each callback is a full rendering update
(style, layout, IntersectionObserver checks, a commit) that draws nothing.
Since `60bea03` it samples only while the automatic loop runs or
auto-disable can count (battery tier, animations on), and since the fix
after it, no longer once auto-disable has switched animations off: it
kept sampling there for the rest of the session, on exactly the slowest
machines. Measured with a
scratch script, not measure.mjs: a rAF counter, a CDP trace (5 s), `ps` CPU
per process (10 s), cookie notice dismissed. Chromium, manual LOW,
animations off, 4 runs per side, load 5 to 13:

| Metric                   | before | after |
| ------------------------ | -----: | ----: |
| rAF callbacks/s          |  120.8 |   0.8 |
| BeginMainFrame/s (trace) |  107.5 |   3.3 |
| Commits/s (trace)        |  113.2 |   9.6 |
| Frames drawn/s (trace)   |    0.4 |   0.4 |
| Main thread busy, ms/s   |   46.4 |  13.3 |
| Renderer CPU, ms/s       |   84.4 |  22.8 |
| GPU process CPU, ms/s    |   27.3 |   5.0 |

Playwright's WebKit runs rAF at 60/s and pays more per callback: 159
against 42 ms/s of CPU across its WebContent, UI and GPU processes in the
same case. With animations playing (manual BALANCED) the sampler added 118
callbacks/s but no measurable main-thread time (275.8 against 275.1 ms/s).

An automatic visit with animations off, Safari's default, kept sampling
all visit after that: 105 to 114 ms/s of CPU in WebKit over two series
(166 against 61, 171 against 57). A still page always measures as fast,
so its tier also climbed, LOW to BALANCED within 20 s. Since `60bea03` the
automatic loop, and its sampling, hold while animations are off and start
over when they play again. WebKit, automatic tier, animations off, 3 runs
per side:

| Metric                |   before | after |
| --------------------- | -------: | ----: |
| rAF callbacks/s       |     60.1 |   0.5 |
| WebContent CPU, ms/s  |    122.3 |  48.9 |
| UI process CPU, ms/s  |     27.2 |   3.0 |
| GPU process CPU, ms/s |     16.5 |   9.0 |
| Tier after 20 s       | BALANCED |   LOW |

What a visitor sees: with animations off, a Safari visit keeps LOW's grid
(opacity 0.2, background 0.08) instead of drifting to BALANCED's (0.5,
0.25) on those readings. After auto-disable the tier stays at battery
saver, where it no longer climbs and announces "quality restored" while
the animations stay off.

### Next 16.4.1 against 15.5.22 (2026-10-15)

Both built in the Linux container (Node 20.20.2, clean `npm ci`, CI's env),
webpack kept for both (`--webpack`: the custom webpack config does not
apply under Turbopack).

| Measure                                            | 15.5.22             | 16.4.1              | Change                                                                                                                  |
| -------------------------------------------------- | ------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Homepage JS, gzipped                               | 298.7 KB            | 326.4 KB            | +27.7 KB (+9.3%), all in Next's framework chunk: its own React went from 19.2.0-canary to 19.3.0-canary, and its router |
| Homepage CSS and fonts                             |                     |                     | unchanged                                                                                                               |
| Homepage HTML                                      |                     |                     | 5.5 KB smaller                                                                                                          |
| Image keys hung after a dropped request            | 92 of 160           | 0 of 320            | the optimizer bug below, fixed in 16.4.0                                                                                |
| Lighthouse (desktop, two runs each, fresh servers) | 100, 96, 96, 92     | 100, 96, 96, 92     | same scores                                                                                                             |
| FCP / LCP / Speed Index                            | 364 / 704 / 1692 ms | 363 / 750 / 1500 ms | LCP +46 ms, Speed Index -192 ms                                                                                         |
| TBT, CLS                                           | 0, 0                | 0, 0                |                                                                                                                         |

The Linux e2e set on 16.4.1: 347 passed, 0 failed, 7 skipped by design;
mobile 20 of 20. Its two deprecation warnings went in round 13 (2026-10-15):
React 18, which only the unit tests ran (the site runs Next's own React
build, 19.3.0-canary in 16.4.1), is 19.3 now; the og-image route runs on
Node.js and is built once (`dynamic = "force-static"`; on Edge it was drawn
on every request). Homepage bytes did not move with either (Linux build of
`193ece7` against `bcc716a`, both pre-squash: JS 326.5 KB gzipped, CSS 19.1, HTML 511.7).

### Round 14: the React Compiler fixes, `eb2e966` against `92e347d` (pre-squash, 2026-10-16)

ESLint 9 brought the React Compiler's rules, and fixing their 84 findings
touched canvas and animation code: browser values through
`useSyncExternalStore`, latest values through effect events, state derived
in render. Both builds served side by side (`:3002`, `:3003`), alternated,
two runs per scenario per round.

| Scenario | Measure                | `92e347d` (pre-squash) | `eb2e966` | Runs per side |
| -------- | ---------------------- | ---------------------- | --------- | ------------- |
| S1       | main thread            | 18.06%                 | 17.50%    | 10            |
| S1       | layout                 | 1.34%                  | 1.12%     | 10            |
| S1M      | main thread            | 23.60%                 | 22.01%    | 4             |
| S1M      | style recalcs          | 1537/s                 | 835/s     | 4             |
| S6       | main thread            | 32.13%                 | 31.62%    | 4             |
| S7       | blocking time          | 177.5 ms               | 181 ms    | 10            |
| S7       | long tasks             | 5.5                    | 5.0       | 10            |
| S7       | main thread            | 37.79%                 | 35.55%    | 10            |
| S8       | blocking time          | 151.5 ms               | 149 ms    | 4             |
| S8       | main thread            | 57.07%                 | 56.48%    | 4             |
| W1       | fps, frames over 20 ms | 59.6, 2                | 59.8, 2   | 4             |

No regression; S1M's style recalcs halved. The first round ran under a load
average of about 70 and is left out. At four runs per side, S1's layout
share (0.87 against 1.48%) and S7's blocking time (166 against 181.5 ms)
looked like regressions; three more rounds of those two put both inside the
noise (S7: the head's time was higher in 61 of 100 pairs of runs, where 50
is no difference).

### Round 15: Next 16.4.2 and ESLint 10 (2026-10-17)

Two webpack builds in this checkout with CI's e2e env, Next 16.4.1 and then
16.4.2, compared file by file with build IDs and renamed files mapped:

| Output files (503) | Count | What differs                                                                                                       |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------ |
| Identical          | 494   |                                                                                                                    |
| Version string     | 5     | Next's version, in four client chunks and a server chunk                                                           |
| Noise              | 2     | the sitemap's `lastmod` and the key order of `app-paths-manifest.json`, as between two 16.4.1 builds               |
| Stylesheets        | 2     | xterm's and pdf.js's, from a stale webpack cache (round 15 traps): a cache-free 16.4.1 build emits the 16.4.2 ones |

ESLint 10.13 against 9.39.5, same config: the same 85 rules with the same
options for a `.tsx` file, 0 problems in `src` (4.8 s), and the same
findings on a file with a violation planted for each plugin
(`src/app/lint-rules.test.ts`).

Linux WebKit r2370, the build in Playwright 1.64.x, renders pages with
`backdrop-filter` slowly on few CPUs (microsoft/playwright#43426, WebKit
bug 327850). `requestAnimationFrame` callbacks per second in the 1.64.0
image (arm64), by the CPUs the container may use:

| Page                          | 2 CPUs | 4 CPUs | 16 CPUs |
| ----------------------------- | ------ | ------ | ------- |
| The issue's 12 cards, blur on | 1      | 1      | 22      |
| Homepage, top                 | 9      | 17     | 14      |
| Homepage, scrolled 1500 px    | 30     | 31     | 30      |

The homepage's rate does not fall with the CPUs, so CI's WebKit jobs
should not stall on it.

### Round 19: Lighthouse 13 and colorthief 3 (2026-10-17)

`lighthouse.spec.ts` in the Playwright 1.64 container against CI's e2e
build, three runs per version (Lighthouse's default mobile emulation):

| Category       | 12.8.2 | 13.5.0 | Lost to                                                |
| -------------- | ------ | ------ | ------------------------------------------------------ |
| Performance    | 100    | 100    |                                                        |
| Accessibility  | 96     | 93     | `link-in-text-block` in both, `target-size` in 13 only |
| Best practices | 96     | 96     | `errors-in-console`: no GitHub data in the e2e build   |
| SEO            | 92     | 92     | `link-text`: the blog cards' "More" links              |

The three runs of each version gave the same scores; FCP 403 to 445 ms,
LCP 645 to 689 ms, CLS 0.016 and TBT 0 in all six. `target-size` is the
skill carousel's 15 dot buttons, 6 by 6 px (the current one 12 by 6),
under WCAG 2.2's 24 by 24: Lighthouse 13's axe-core (4.14, from its `^4.13`)
catches them, 12's and the e2e scans' (4.10) do not.

After this round's fixes, at `2a935ac` (pre-squash, three runs, Lighthouse 13):
performance 100, accessibility 100 (the carousel's 24 px controls, the
underlined footer links), best practices 96 (the same console errors), SEO
100 (the cards' "Medium" links). LCP 859 to 870 ms, from 686 to 849 ms
before Tailwind 4's larger stylesheet; FCP 443 ms, TBT 0. npm audit: 46
advisories at the start of the round, 8 at its end, all in tools that never
reach the site (eslint-config-next's fast-glob, braces and micromatch;
@tailwindcss/typography's postcss-selector-parser; vite's esbuild dev
server).

colorthief 3.5.0 against 2.6.0 in Chromium, the hook's call in each, on
the 53 images in `public/images`, the Kudos card's Unsplash photo and two
Medium images:

| Comparison                                         | Result                                      |
| -------------------------------------------------- | ------------------------------------------- |
| 3.5.0 in RGB (`colorCount` 5, `quality` 10)        | identical on all 54 that 2.6.0 can read     |
| 3.5.0 in its default OKLCH                         | all 54 differ; 33 by a delta E over 10      |
| All-white images (`ppsn_2026_logo_white`, 2 files) | 2.6.0 throws, 3.5.0 gives white             |
| The lazy chunk                                     | 6,570 to 16,997 B, 2,707 to 6,409 B gzipped |

The delta E is CIE76 between the colors the hook shows, after its glow
adjustment. In a production build the Kudos card, the only image the site
extracts at runtime, shows the same color (197, 60, 106) once the blog
comes near, and the chunk loads only then.

Tailwind 4.3.3 against 3.4.19, CI's e2e build of the same tree:

| CSS                                   | 3.4.19                      | 4.3.3                       |
| ------------------------------------- | --------------------------- | --------------------------- |
| The homepage's stylesheets (blocking) | 114,882 B, 19,518 B gzipped | 157,531 B, 23,131 B gzipped |
| All stylesheets                       | 127,002 B, 22,383 B gzipped | 169,659 B, 25,996 B gzipped |

Screenshots of every homepage section at 1280 by 900 and 390 by 844, light
and dark, with reduced motion, against two runs of the 3.4 build (pixels
whose largest channel differs by more than 16):

| Section                    | Changed pixels                      | Why                                                               |
| -------------------------- | ----------------------------------- | ----------------------------------------------------------------- |
| Home and page top, desktop | 10.8 to 12.7%, 90 px taller         | `leading-tight` now beats `xl:text-7xl`'s line height of 1        |
| Research, desktop          | 12.5 to 13.8%                       | the title gradients in OKLCH                                      |
| Skills                     | 6.4 to 6.5% desktop, 17% phone      | subtitle sizes and margins (`text-2xl mb-*` beats the gradient's) |
| Education                  | 1.5% desktop, 12% phone             | the same                                                          |
| Projects, Home on a phone  | 2% desktop, 1.7 to 1.9% phone       | the same, and the palette                                         |
| The other 22 shots         | 1.1% at most (the phone's page top) | two 3.4 runs differ by up to 2%; Papers 3 px shorter on desktop   |

### Round 20: Lighthouse limits for CI's runners (2026-10-18)

CI's Lighthouse job (GitHub's ubuntu-24.04 runners, Lighthouse 12, the code
before the performance pass) scored performance 69 to 94 over its last 19
runs, 2026-07-22 to 2026-10-04, median 83; retries of one commit went from
69 to 87 and from 79 to 91. Round 19's bar of 90 would have failed 13 of
the 19. CI kept no metric: only the four category scores reached its log.

Calibration, in the Playwright 1.64 arm64 container: one container served
CI's Lighthouse-job build of `d8da49f` (Next 15.5.22, Lighthouse 12.8.2,
Playwright 1.57's Chromium, Node 24 where CI had 20), another the same
build of HEAD; their audits alternated, three per CPU multiplier, under the
same host load. Each run's effective slowdown is its multiplier times the
idle container's CPU benchmark (3,982, round 19) over its own (1,676 to
2,401 under that load):

| Multiplier | `d8da49f`: slowdown, performance | HEAD: slowdown, performance | HEAD: TBT, ms | HEAD: TTI, s | HEAD: LCP, ms |
| ---------- | -------------------------------- | --------------------------- | ------------- | ------------ | ------------- |
| 1          | 1.8 to 2.3: 87 to 91             | 1.7 to 2.2: 99 to 100       | 60 to 92      | 1.24 to 1.32 | 824 to 951    |
| 2          | 3.3 to 4.2: 79 to 83             | 4.0 to 4.4: 89 to 91        | 367 to 443    | 2.06 to 2.27 | 614 to 960    |
| 3          | 5.2 to 6.6: 67 to 72             | 6.4 to 7.1: 77 to 84        | 635 to 1,055  | 2.50 to 3.02 | 906 to 1,006  |
| 4          | 6.8 to 8.8: 60 to 69             | 6.8 to 8.2: 73 to 80        | 868 to 1,611  | 2.80 to 3.81 | 917 to 1,051  |

`d8da49f` scores CI's 81 and 83 at a slowdown of 3.3 to 4.2: CI's runners
take about 3.7 times an idle M4 Max container's CPU time (by the same
arithmetic, a CPU benchmark near 1,100). HEAD there: performance 89 to 91, FCP 449 to 461 ms, TBT 367
to 443 ms, TTI 2.06 to 2.27 s, CLS 0.016. Round 19's limits, set from the
idle container alone, would likely have failed on CI: TBT under 300 ms and
performance at least 90, against those 367 to 443 ms and 89 to 91. The old
code's CLS (0.10 to 0.20) is gone from HEAD (0.016) and costs it nothing.

The new limits (median of three audits): performance at least 80, FCP under
1.5 s, LCP under 2 s, CLS under 0.1, TBT under 1,000 ms, TTI under 3 s.
Measured with the spec itself (three audits, medians) in the same
container: it passed at a median slowdown of 6.3 and 6.7, 1.7 to 1.8 times
CI's (performance 81 and 82, TBT 706 and 795 ms, TTI 2.64 and 2.79 s), and
failed at 8.2 and 9.8, round 19's 8x CPU and beyond (performance 74 both
times; TBT and TTI over their limits too).

The first version of the median measured repeat visits:
playwright-lighthouse passes `disableStorageReset: true`, so the second and
third audits found the cache the first had filled (FCP 449, then 192 ms;
TTI 1,658, then 532 ms). The first audit was cold anyway: all 22 scripts
came over the network despite the spec's warm-up visit (Lighthouse opens its
own tab, apparently outside that page's browser context). The spec now
passes `disableStorageReset: false`: three cold audits (FCP 454, 551 and
461 ms).

Vite 8 (`5096ede`): all 10 CI unit scripts pass with round 19's counts
(2,552 tests) on vite 8.3.4, and esbuild leaves the tree (npm audit 8 to 7).
Vite 8 raised the shared postcss from 8.5.25 to 8.5.30; built in one
directory with each lockfile, all 71 CSS and JavaScript files of the site
are byte-identical. New since vite 8: one warning per Vitest run that
`vitest.config.ts` is ESM loaded as CommonJS, which vite's native config
loader, planned as a future default, will refuse (rename it `.mts` and
replace `__dirname`).

Final HEAD (`bf7d638`, pre-squash) in the Playwright 1.64 container, against CI's e2e
build. Lighthouse, three spec runs of three audits each, all passing:
medians performance 100, FCP 444 to 450 ms, LCP 647 to 924 ms, TBT 2 to
68 ms, TTI 0.94 to 1.50 s, CLS 0.016 (CPU benchmark 2,017 to 2,728 under
the host's load); every audit scored accessibility 100, best practices 96
and SEO 100. Best practices loses `errors-in-console`: the e2e build has no
GitHub data, so `/profile.json` answers its prerendered 404 and
`/api/fetch-all-repos` a 500 (no `GH_USERNAME`). The homepage asks the API,
then the snapshot, once each, and says the projects could not load: two
console errors, from three (`/profile.json` was asked twice). e2e: Chromium
122 passed and 1 skipped (navigation, the accessibility job, the
performance set), WebKit's accessibility job 41 and 1 skipped, and all 24
on both phones. npm audit: 7.

### Round 21: the dependency backlog (2026-10-18)

Each major and in-range update was measured on its own commit, against
the commit before it.

| Update                                | Evidence                                                                                                                                                            | Cost                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| TypeScript 5.8.3 to 6.0.3 (`~6.0.3`)  | type-check 0 errors under 6.0's new defaults; lint, knip, `next build` clean                                                                                        | none; 7.0.2 waits for typescript-eslint (`<6.1.0`)                                       |
| Vitest 4.1.12 to 5.0.5                | on a copy first: all 10 unit scripts three times with retries off and once as CI, 2,566 passed each run, nothing retried                                            | none                                                                                     |
| prettier 3.6.2 to 3.9.10              | 16 files reformatted; each file's TypeScript syntax tree identical                                                                                                  | none                                                                                     |
| xterm 5.5.0 to 6.0.0                  | window `resize` listeners over 5 terminal open/close cycles: 5.5 without the cleanup 9 to 14, with it 9 to 9, 6.0 without it 9 to 9; terminal screenshots identical | terminal chunk 67,832 to 82,488 B gzipped (+21.6%), its CSS 812 to 1,059 B; both lazy    |
| framer-motion 12.23.11 to 14.3.0      | prerendered homepage: 810 style attributes identical; screenshots of every section within two runs of the old build                                                 | homepage JS 337,221 to 348,067 B gzipped (+3.2%): framer's eager code 27,786 to 38,545 B |
| web-llm 0.2.79 to 0.2.86              | the 7 configured models still listed (165), same weights; a new WebGPU library each (all served); the default model loads and answers a chat                        | its lazy chunk 1,962,235 to 2,170,720 B gzipped (+10.6%)                                 |
| analytics, web-vitals, lottie-react   | homepage JS the same raw bytes; three lazy chunks +54 B each                                                                                                        | +162 B of client JS                                                                      |
| autoprefixer 10.4.21 to 10.6.1        | every CSS file byte-identical (caniuse-lite and browserslist unchanged)                                                                                             | none                                                                                     |
| react-pdf 10.0.1 to 10.5.0 (not kept) | link names in node identical (3,400 of 3,400 under pdf.js 5.3.31 and 5.4.296), font widths identical; but the reader's e2e failed 4 of 32 (below)                   | not committed                                                                            |

react-pdf 10.5 with pdf.js 5.4.296 broke two pdf-reader tests in Chromium
and WebKit alike, and HEAD's 10.0.1 passes all 32: the GECCO paper's 33
internal links got no name in the browser (in node, the same pdf.js names
every link as 5.3.31 did), and the fallback-fonts reload sent a reader on
page 200 back to page 1. The annotation layer's markup is unchanged
(`section.linkAnnotation[data-annotation-id] > a`), and react-pdf still calls
`onGetAnnotationsSuccess` and `onGetTextSuccess`. Both failures look like
the document's load cycle, which react-pdf 10.3 changed ("resilience to
promise cancellations"); confirming it needs the viewer instrumented.
react-pdf stays at 10.0.1. (Round 22 found the causes, neither of them
10.3's change: pdf.js 5.4's link titles and react-pdf 10.5's unmount on
reload. See below.)

The terminal's AI chat could not load any model, in production too: Hugging
Face redirects model weights to its Xet CDN (`params_shard_*.bin` answer 302
to `us.aws.cdn.hf.co`), which the CSP's `connect-src` did not allow, so the
browser refused every weight download ("Failed to fetch", reason csp).
`connect-src` now allows `https://*.hf.co`; the default model (Llama 3.2 1B)
loads and answers in a build. Headless Chromium's default shell offers only
SwiftShader's fallback adapter, without `shader-f16`, which the q4f16
models need ("Invalid ShaderModule"); `channel: "chromium"` (the new
headless) gets the Mac's Metal adapter with it.

The e2e build's console: `/api/fetch-all-repos` ignored `USE_GITHUB_DATA`
and answered 500 without `GH_USERNAME`, and `/profile.json` answered 404
with the switch off: two errors on every load of a build without GitHub
data. Both answer "no data" with a 200 now, and static-shell's hydration
test fails on any console error.

The round's start and end, built the same way in the Playwright container
(CI's e2e build, gzip -9):

| Bytes, gzipped        | `5033cb0` (pre-squash) | `7c740ff`          |
| --------------------- | ---------------------- | ------------------ |
| Homepage JS           | 337,147 (15 files)     | 348,035 (16 files) |
| All CSS               | 25,927                 | 26,174             |
| Terminal chunk (lazy) | 67,835                 | 82,428             |
| PDF chunk (lazy)      | 106,870                | 106,870            |
| web-llm chunk (lazy)  | 1,964,686              | 2,171,956          |

Final HEAD (`7c740ff`, pre-squash) in the container: Lighthouse, three spec runs of
three audits, all passing, medians performance 100, FCP 446 to 450 ms, LCP
692 to 856 ms, TBT 21 to 25 ms, TTI 1.19 to 1.20 s; every audit scored
accessibility, best practices and SEO 100 (best practices was 96: the
console errors are gone). e2e: Chromium 122 passed and 1 skipped (with
pdf-reader), WebKit's accessibility job 41 and 1 skipped, terminal,
python-terminal and research-map 63 in Chromium, 42 in Firefox and 43 in
WebKit (21 and 20 skipped by the specs), and all 24 on both phones. npm
audit: 7.

### Round 22: react-pdf 10.5, framer-motion's eager bytes, jsdom 30 (2026-10-19)

Round 21 left react-pdf 10.5 out (the reader's e2e failed) and framer-motion
14 costing 10.8 KB gzipped of eager homepage JS. The two failures and the
extra bytes each had one cause in a library, dealt with in our code or by a
patch; jsdom and jest-dom moved too. Each change was measured on its own
commit, against the commit before it.

| Update                                     | Evidence                                                                                                                            | Cost                                                                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| jest-dom 6.9.1 to 7.0.1                    | 6.10's code (16 new matchers) as a major; 2,568 unit tests pass                                                                     | none                                                                                                                |
| jsdom 24.1.3 to 30.1.3                     | two copies, three alternating runs of the 10 CI unit scripts each, retries off: every run passes, none retried                      | the suite 118.6 to 140.4 s (+18.4%), about 0.11 s per test file; peak memory -23 to +43 MB per script               |
| react-pdf 10.0.1 to 10.5.0, pdf.js 5.4.296 | 3,400 of 3,400 link names identical, font widths identical; pdf-reader e2e 32 of 32 in Chromium and WebKit, after two fixes (below) | reader chunk 106,976 to 120,684 B gzipped (+12.8%), worker 283,317 to 287,344 B, its CSS 2,011 to 2,256 B; all lazy |
| framer-motion 14.3.0 to 14.3.1, exact      | unit and e2e pass                                                                                                                   | homepage JS +90 B, lazy features +151 B                                                                             |
| motion-dom's registry split (patch)        | prerendered homepage: 810 style attributes identical; screenshots of every section within the run-to-run noise                      | homepage JS 348,155 to 338,576 B gzipped (-9,579 B); lazy features 19,614 to 28,431 B; per visit -762 B             |

react-pdf 10.5's two failures had a cause each, in different packages:

- **Unnamed links: pdf.js 5.4.** Since PR #20096 pdf.js titles each link
  with the text printed under it ("5" for "[5]"), and `fixLinkAnnotation`
  took any title for a name the PDF gave, so none of the GECCO paper's 33
  internal links got a name. A title no longer stops the naming, and a
  named link loses pdf.js's title, which was read after the name
  ("Reference 5, link, 5") and showed as a tooltip.
- **Back to page 1: react-pdf 10.5.** PR #2129 clears the document as soon
  as the old one is destroyed: until the new one arrives, Document shows its
  `loading` in place of all 368 page boxes. The fallback-fonts reload then
  collapsed the column, and both browsers clamped the scroll to the top;
  the counter measured the detached boxes (all zero) and said 1; and the
  page observer reported the removed boxes out of view, so the reader's
  page came back without a canvas until every size was measured again. The
  column holds its size through a reload, the counter keeps its page while
  no box is in view, and the observer skips boxes that left the page and is
  made again for each load's boxes.

A bisect on 10.5: with the link fix alone, both fallback-fonts tests fail
in both engines (the reader on page 1); without the observer's skip, 3 of 4
runs find the reader's page back without its canvas (the observer made for
the new boxes sometimes reports first). Two tests had hidden the second
cause: the page-2 e2e checked only that the counter agreed with the page in
view, which held when 10.5 moved both to page 1, and the unit mock kept the
pages mounted, as 10.0 did.

framer-motion's eager bytes: since 12.26.2 (#3470), framer's `m` and
`LazyMotion` read the feature registry (`get/setFeatureDefinitions`) from
motion-dom's `render/VisualElement.mjs`, which also holds the VisualElement
class and imports KeyframeResolver, NativeAnimation, motionValue, the
frameloop and the value types. webpack does not split a module across
chunks, so all of it left LazyMotion's lazy features for the eager chunk
that holds `m`. `patches/motion-dom+14.3.1.patch` (patch-package, in the
postinstall with `--error-on-fail --error-on-warn`) moves the registry into
`render/feature-definitions.mjs`; any other motion-dom version fails the
install. motion's own size budget bundles `m` alone with rollup, which drops
the unused class, so it cannot see this; an upstream issue is drafted.

jsdom 30 broke the suite twice. Every file failed to load: `setup.ts`
assigned `global.localStorage`, Vitest's accessor writes that on to jsdom's
window, and jsdom 30's window (`vm.constants.DONT_CONTEXTIFY`) refuses a
write to a getter-only property where jsdom 24's contextified sandbox let it
through. And the research map's list buttons lost a space in their names:
jsdom 30 applies the HTML Standard's default stylesheet (a span is inline),
where jsdom 24 reported no `display`, which the name computation took for a
block; the markup has the space now.

The round's start and end, built the same way in the Playwright container
(CI's e2e build, gzip -9):

| Bytes, gzipped         | `647a81f` (pre-squash) | `456e8a7`          |
| ---------------------- | ---------------------- | ------------------ |
| Homepage JS            | 348,021 (16 files)     | 338,521 (16 files) |
| Motion features (lazy) | 19,417                 | 28,343             |
| All CSS                | 26,174                 | 26,419             |
| Terminal chunk (lazy)  | 82,428                 | 82,428             |
| PDF chunk (lazy)       | 106,870                | 120,529            |
| pdf.js worker (lazy)   | 283,837                | 287,697            |

Final HEAD (`456e8a7`, pre-squash) in the container: `npm ci` applied the patch
(`motion-dom@14.3.1 ✔`); lint, type-check, knip, format, CI's build and the
static-home check passed. Lighthouse, three spec runs of three audits, all
passing: medians performance 100, FCP 443 ms, LCP 688 to 871 ms, TBT 0 ms, TTI
688 to 871 ms; accessibility, best practices and SEO 100 in every audit. The
container's CPU benchmark read 3,867 to 3,876 (2,640 to 2,747 in round 21's
run): the lower TBT and TTI cannot be credited to this round without an A/B
under the same load. e2e: Chromium 136 passed and 1 skipped (pdf-reader and
the research map included), WebKit's accessibility job with pdf-reader and the
research map 71 and 1 skipped, both phones 24. Unit: the 10 CI scripts twice
on macOS and act's 8 jobs (each of its 7 installs applied the patch), 2,574
tests every time, none retried. npm audit: 9, up from 7: patch-package and its
find-yarn-workspace-root reach braces 3.0.3, whose stack-exhaustion advisory
(GHSA-vfj7-8cjw-p6xm, 2026-09-18, no fixed release) eslint-config-next's
fast-glob already brought in; patch-package runs at install time, on our own
package.json.

### Round 23: the reader's browser floor, CI's wasted minutes (2026-10-19)

- **The PDF reader opened no PDF on part of the browserslist.** pdf.js 5's
  default build calls `URL.parse` (Chrome 126, Safari 18) and
  `Promise.withResolvers` (Chrome 119, Safari 17.4) without a polyfill;
  `getDocument` reaches the first through `getUrlProp`. On Chrome and Edge 111
  to 125 and Safari and iOS 16.4 to 17.x, all in the browserslist, opening a
  PDF took the page to the app's "Something went wrong". pdf.js 5.3.31 called
  `URL.parse` the same way, and nothing else in the site calls either API. The
  reader runs pdf.js's legacy build now (an exact `pdfjs-dist$` alias in
  `next.config.mjs`, and its worker), which targets Chrome 110, Firefox ESR
  and Safari 16.4: its chunk 120,684 to 139,566 B gzipped, its worker 287,344
  to 304,368 B, both loaded only with the reader. An e2e test deletes both
  APIs before the page loads; it failed on the default build in Chromium and
  WebKit.
- **CI spent minutes on nothing.** In the last GitHub run (2026-10-04),
  every ci.yml job deleted the runner's Android and .NET SDKs first: 53 to
  193 s a job, more than `npm ci` (47 to 82 s) and the tests (2 to 30 s),
  with 103 GB still free after it and `node_modules` at 0.9 GB. Ten jobs
  cached two folders Vitest 5 never writes, and the build job saved a
  `.next` nothing restored. All 23 steps are gone. `test:lib-dom` also ran
  the 11 hook test files `test:hooks` runs: 79 tests counted twice in every
  total. A test fails now on a file two jobs run.
- **The motion-dom patch without patch-package.** `scripts/apply-patches.mjs`
  (Node's built-ins) applies the diff exactly, checked against the exact
  version and every file's SHA-256 before and after
  (`patches/patches.json`): 15 packages left the lockfile, npm audit is 7
  again, and a patched tree comes out byte-identical.
- **The test forks' compile cache: not taken.** jsdom 30's +18% (round 22)
  is cold start: every test file runs in a fresh fork, which loads jsdom
  (212 ms against jsdom 24's 136, median of 10 fresh processes) and makes
  its first window and style (69 ms against 42). Vitest 5 passes
  `NODE_COMPILE_CACHE` to its forks, and nothing set it. Three alternating
  runs each of the 10 CI scripts, the cache empty at each script's start as
  in a CI job: median 211.1 s without, 199.5 s with (-5.5%; pairs -9.8%,
  -5.5%, -9.8%), short of the 10% agreed. Warm it saved 23%, but no run
  has it warm: Vitest turns it off under v8 coverage, which local runs
  use, and CI starts empty. Measured under a load of 25 to 42 from other
  jobs.
- **react-pdf 11 waits.** It pins pdf.js 6.3.289, whose default build needs
  Chrome 145, Firefox 144 and Safari 26.2 (`Map.prototype.getOrInsertComputed`,
  no polyfill) and whose legacy build Chrome 125 and Safari 18; since pdf.js
  5.7, CCITT and JBIG2 images need a wasm decoder (the SNF 2010 poster has
  three); loading suspends by default; the worker grows 86 KB gzipped. The
  site gains nothing from it.

The round's start and end, built the same way in the Playwright container
(CI's e2e build, gzip -9):

| Bytes, gzipped         | `b4a33e8` (pre-squash) | `54f2379`          |
| ---------------------- | ---------------------- | ------------------ |
| Homepage JS            | 338,513 (16 files)     | 338,522 (16 files) |
| All CSS                | 26,419                 | 26,419             |
| Motion features (lazy) | 28,343                 | 28,343             |
| Terminal chunk (lazy)  | 82,428                 | 82,428             |
| PDF chunk (lazy)       | 120,529                | 139,564            |
| pdf.js worker (lazy)   | 287,697                | 305,155            |

Final code HEAD (`54f2379`, pre-squash) in the container: `npm ci` ran the new script
("motion-dom@14.3.1 patched (3 files)"); lint, type-check, knip, format, CI's
build and the static-home check passed. Lighthouse, three spec runs of three
audits, all passing: medians performance 100, FCP 442 to 443 ms, LCP 859 to
869 ms, TBT 0 ms, TTI 859 to 869 ms (CPU benchmark 3,935 to 3,960);
accessibility, best practices and SEO 100 in every audit. e2e: Chromium 137
passed and 1 skipped (pdf-reader with the browser-floor test, and the research
map), WebKit's accessibility job with pdf-reader and the research map 72 and 1
skipped, both phones 24. Unit: act's 8 jobs (each of their 7 installs ran the
script) and the eight timed macOS runs of the 10 scripts, 2,502 tests each
time, each in one job. npm audit: 7.

### Round 24: error reports, Pyodide's cache, lint, a Safari regression (2026-10-19)

- **The error pages report their errors.** They said "we've been notified"
  with nothing sent. An error that reaches one of the three boundaries (the
  page's `error.tsx`, AppWrapper's `ErrorBoundary`, which catches the
  layout's own parts, and `global-error.tsx`) is now posted to
  `/api/client-error`, which files it as an issue in this repository, and
  the page says a report was sent only after a 202. The report code costs
  1,340 B gzipped on every page: Next loads the error pages' chunks
  eagerly, and each of the three carries a copy (`app/error` +479,
  `app/global-error` +470, `app/layout` +391; `not-found` +33 is round
  24's one-control fix).
- **Safari 16.4 to 17.x keep their translucent backgrounds.** A
  `@supports not (backdrop-filter: ...)` block in the layout, from the
  first commit, fired on those versions, which blur through
  `-webkit-backdrop-filter`, and gave the nav buttons, tooltips, scrims,
  toasts and cookie notice 5 to 20% black. No floor browser lacks both
  forms, so the block went.
- **Pyodide's runtime moves with its version.** `/pyodide/*` is cached as
  immutable for a year and came from one unversioned folder, so a version
  bump would have left returning visitors on the old runtime, or on a mix
  of two. It sits in `/pyodide/<version>/` now, named by the worker's URL,
  and runs 314.0.7 (numpy 2.4.6, +53,104 B raw over 16.5 MB). And
  `python --version` said Python 3.14.0, copied from the package's lock
  file; the interpreter is 3.14.2. Not known: whether the Python terminal
  runs on Chrome and Edge 111, in the browserslist, since Pyodide is
  tested from Chrome 112.
- **Lint covers everything the repository runs.** 23 files (the root
  configs, `scripts/`, `.github/scripts`, the public workers) were linted by
  nothing; with ESLint's own recommended rules on, lint found 38 issues,
  none a bug (case blocks without braces, overwritten defaults, double
  negations, two invisible characters in a regex), and 4 unused names
  outside `src`.
- **Tooling:** knip 6.42, postcss 8.5.31 (CSS byte-identical),
  `@vitejs/plugin-react` 6 (no Babel), dotenv 18, lint-staged 17,
  commitlint 21 and husky 9.

The round's start and end, built the same way in the Playwright container
(CI's e2e build, gzip -9):

| Bytes, gzipped         | `04447db` (pre-squash) | `2b6c3dd`          |
| ---------------------- | ---------------------- | ------------------ |
| Homepage JS            | 338,513 (16 files)     | 339,890 (16 files) |
| All CSS                | 26,419                 | 26,397             |
| Motion features (lazy) | 28,343                 | 28,343             |
| Terminal chunk (lazy)  | 82,428                 | 82,428             |
| PDF chunk (lazy)       | 139,563                | 139,564            |
| pdf.js worker (lazy)   | 305,155                | 305,155            |

Final code (`2b6c3dd`, pre-squash; `432ad4d` after it changed only a test) in the
container: `npm ci` (the patch script, and 314.0.7 alone in
`public/pyodide`), lint, type-check, knip, format, CI's build and the
static-home check passed. Lighthouse, three spec runs: performance 100,
FCP 442 ms, LCP 687 to 861 ms, TBT 0 ms, CLS 0.016 (CPU benchmark 3,931 to
3,955); accessibility, best practices and SEO 100 in every audit. e2e:
Chromium 163 passed and 1 skipped (with the 404 scan, the error reports and
the Python terminal), WebKit's accessibility job with the error reports,
pdf-reader and the research map 77 and 1 skipped, both phones 24. In
Firefox the error-report spec failed 2 of 4 on its console check: Firefox
prints a logged Error as "Error". The test reads the logged value since
`432ad4d`: 24 of 24 in the three engines, two repeats without retries. The
Pyodide worker booted 314.0.7 and ran numpy in all three (the Python spec
runs in Chromium only). Unit: act's 7 test jobs (one `npm ci` lost to a
network reset, rerun) and two macOS runs of the 10 scripts, 2,556 tests
each time. npm audit: 7.

### Round 25: error reports fixed before they ship, privacy claims made true (2026-10-19)

- **Round 24's error reports, fixed before their first deploy.** A report
  now names the build its page ran (a commit inlined at build time) and
  the one serving. One bug keeps one signature across deploys. The search
  takes only the owner's labeled reports, closed ones too: a closed report
  is reopened only when the build serving now runs into it. The route
  takes JSON from the site's own pages only, caps new issues across
  instances by a GitHub count, and goes quiet when GitHub limits it. The
  error screens can reload the page. A workflow assigns new reports to the
  owner, whom GitHub would not otherwise tell. The builds publish hidden
  source maps (16.9 MB deployed, 0 B to visitors), which
  `scripts/map-frame.mjs` reads.
- **Python in tabs opened before a deploy.** The worker read its runtime's
  version from its URL, which an older bundle does not give: it now names
  its own. A failed load is no longer kept; with no WebAssembly (Lockdown
  Mode), `python` says so at once instead of waiting out 120 s. A unit test
  holds the runtime to the browser floor (no exnref, ES2022 glue), and the
  unused UMD build left the deployment (-18,912 B).
- **Privacy: the code first, then the words.** The site sets no cookie (a
  theme cookie no server had read since the homepage became static is
  gone, and expired for returning visitors). Cards no longer load remote
  images in the browser to read a color (the Kudos card reached Unsplash).
  Reports send no cookie, Referer or query. The CSP allows the browser
  only the hosts it uses (17 hosts to 10, images from the site alone). The
  legal texts are built once with the site, without the drifted fallback
  copies. Then the policy, terms, notice and modal were made exactly true,
  with tests that hold the policy to the CSP's hosts and the model sizes.

The round's start and end, built the same way in the Playwright container
(CI's e2e build, gzip -9):

| Bytes, gzipped         | `becc3db` (pre-squash) | `21caf49`          |
| ---------------------- | ---------------------- | ------------------ |
| Homepage JS            | 339,875 (16 files)     | 340,027 (16 files) |
| All CSS                | 26,420                 | 26,426             |
| Motion features (lazy) | 28,343                 | 28,343             |
| Terminal chunk (lazy)  | 82,428                 | 82,428             |
| PDF chunk (lazy)       | 139,563                | 139,564            |
| pdf.js worker (lazy)   | 305,155                | 305,155            |

Final HEAD (`21caf49`, pre-squash) in the container: `npm ci`, lint, type-check, knip,
format, CI's build and the static-home check passed. Lighthouse, three spec
runs: performance 100, FCP 442 to 443 ms, LCP 858 to 868 ms, TBT 0 ms, CLS
0.014 (CPU benchmark 3,845 to 3,952); accessibility, best practices and
SEO 100 in every audit. e2e: Chromium 169 passed and 1 skipped (with the
privacy spec, the error reports and the Python terminal), WebKit 82 passed
(the accessibility job, privacy, error reports, pdf-reader, the research
map, and the Python worker as older bundles start it; 23 skipped, mostly
Chromium-only Python tests), Firefox 9 (error reports, privacy, the
worker), both phones 24; the Pyodide worker booted and ran numpy in all
three engines. Unit: act's 8 jobs and two macOS runs of the 10 scripts,
2,578 tests each time. npm audit: 7.

### Round 26: the free Hobby plan, tests that could not fail, a lighter homepage (2026-10-20)

- **The Hobby plan.** The site runs on Vercel's free plan, which the
  round's checks now assume.
  - **Deploys:** the CLI uploads only the files Vercel lacks (17.6 MB for
    a 639-file deployment last time), so the hidden source maps stay. The
    deploy job installs `vercel@64.7.0`, not `latest`, since it runs
    beside the deploy token.
  - **Images:** Hobby includes 5,000 transformations a month, each cache
    MISS or STALE counting one; past that, uncached images answer 402.
    The optimizer took any image from seven hosts, two of them unused, so
    anyone could spend the quota. It now takes the GitHub avatar alone,
    kept 31 days. Medium's images come from `/api/blog-image/<id>`, which
    serves only the images the Medium feed names, resized by sharp and
    cached a month at the edge. The Kudos photo is a file of the site,
    and its scraper is gone.
  - **Functions:** Fluid compute is on in `vercel.json`, whose `functions`
    block named paths that do not exist. Every server fetch to a third
    party times out after 10 s, and the routes Next revalidates in the
    background (where it drops a fetch's `signal`) have a `maxDuration`.
  - **Words:** the privacy policy's Hosting paragraph (an hour of request
    logs, 24 hours of firewall traffic, the API in Washington, D.C.) and
    its services (Kudos out; Crossref and rss2json.com, which the server
    contacts, in).
- **Tests that could not fail.** Eighteen commits rewrote the tests that
  asserted nothing that could fail (`expect(true)`, `>= 0`, assertions
  inside `try`, a test scrolling to the section itself) and proved each
  rewrite with a mutation, or deleted the test where another covers the
  behavior. The method is in `TESTING_INFRASTRUCTURE.md`. Running every
  project at the end found three more failures: a new keyboard test on
  phones, the research map's drawing tests on phones (failing since
  before the round), and the request-count budget, which the new chunks
  passed.
- **Eager JavaScript.** Code the page needs only after hydration moved to
  chunks of its own: the animated favicon, the project and article cards
  (fetched with their data), the hero's background layers (never on
  Safari, which draws none), the interest constellation (wide screens
  only), the publications' abstracts and the research section's long
  texts. styled-jsx left (its two keyframes moved to `motion.css`), as
  did 27 dead icon entries and tailwind-merge: `cn()` joins classes with
  clsx, after a syntax-tree scan and an audit of the e2e suite settled
  every Tailwind conflict where it is written. CI's build fails if a
  client chunk ships styled-jsx or tailwind-merge
  (`.github/scripts/check-client-bundle.mjs`).

Each change against the commit before it, on the Mac (CI's e2e build,
homepage scripts without the polyfills, gzip -9):

| Commit (pre-squash) | Change                                     | Bytes   | Files |
| ------------------- | ------------------------------------------ | ------- | ----- |
| `b010632`           | before the eager-JS commits                | 300,006 | 15    |
| `d8bd363`           | 27 dead icon entries                       | 298,768 | 15    |
| `6c85a90`           | styled-jsx out                             | 295,910 | 15    |
| `e9d0391`           | animated favicon, lazy                     | 294,882 | 15    |
| `5c562ab`           | project cards, with the repositories       | 288,228 | 15    |
| `d186880`           | article cards, with the articles           | 285,704 | 15    |
| `92da77f`           | hero layers, after hydration               | 277,413 | 16    |
| `0feda8d`           | constellation, wide screens only           | 274,965 | 16    |
| `a30e392`           | abstracts left to the API                  | 271,421 | 16    |
| `4f6b0c5`           | research texts, when idle                  | 268,540 | 16    |
| `90b1deb`           | papers filed by title (a fix of the above) | 268,550 | 16    |
| `925cc94`           | the conflict report                        | 268,620 | 16    |
| `0d09a11`           | conflicts settled                          | 268,576 | 16    |
| `b75aa2a`           | `cn()` with clsx                           | 260,427 | 15    |
| `ce9dceb`           | an icon per technology, 9 icons fewer      | 260,024 | 15    |

`39eb6da` (pre-squash, between `6c85a90` and `e9d0391`) adds the CI check only.
`ce9dceb` and `9b1b0cc` (the ring labels' line height, no change in size)
came last, both chosen by Romain from before/after screenshots. Not kept:
a split-chunks group for the root boundaries' shared helpers saved 1,162 B
for 8 more requests.

The round's start and end, built the same way in the Playwright container
(CI's e2e build, gzip -9):

| Bytes, gzipped                       | `bca23f5` (pre-squash) | `f082507`          |
| ------------------------------------ | ---------------------- | ------------------ |
| Homepage JS, without the polyfills   | 300,625 (15 files)     | 260,808 (15 files) |
| Polyfills (`noModule`, never loaded) | 39,405                 | 39,405             |
| All CSS                              | 26,426                 | 26,454             |
| Terminal chunk (lazy)                | 82,428                 | 82,428             |
| PDF chunk (lazy)                     | 139,563                | 139,564            |

The new chunks at `f082507` (pre-squash): project cards 8,833 B; hero layers 6,478
(never fetched on Safari); abstracts 4,450 (only when /api/publications
fails); research texts 4,253; article cards 3,842; constellation 3,314
(wide screens only); animated favicon 1,386. The homepage asks for 31
scripts on a desktop (23 at `bca23f5`), the extra ones after hydration.

Final HEAD (`f082507`, pre-squash) in the container: `npm ci`, lint, type-check, knip,
format, CI's build, the static-home check and the client-bundle deny list
passed. e2e, every spec: Chromium 196 passed and 13 skipped. WebKit 166
passed, 39 skipped and 4 failed: the two splash-timer tests in
static-shell.spec.ts, which fail at `bca23f5` too (WebKit in this container
hydrates too slowly for them); the dashboard-spring test in
terminal.spec.ts, marginal there (this WebKit draws a frame every 1 to
2.5 s at both commits; macOS WebKit draws 26 to 29 in 600 ms at both); and
one axe scan that caught the skill manifesto mid-fade (6 of 6 reruns
passed). Both phones: 286 passed and 127 skipped; the same two splash-timer
tests failed on Mobile Safari, and three chunk-abort cases were flaky under
load (3 of 3 reruns passed each). Firefox (terminal, Python, error reports,
privacy): 39 passed. The Pyodide worker booted and ran numpy in all three
engines. Lighthouse, three runs alternating with `bca23f5` on one machine:
performance 100 and TBT 0 ms for both, CLS 0.014, FCP 443 to 569 ms
against 443, LCP 648 to 831 ms against 691 to 870 (CPU benchmark 3,737 to
3,861); accessibility, best practices and SEO 100. Unit: CI's ten scripts
on macOS twice, 2,640 tests each time, and act's 8 jobs. npm audit: 7, as
before.

### Round 27: cards that open in a dialog, a more compact page (2026-10-21)

- **What changed.** The research, skills, paper and blog cards grew in
  place to show their long text, which pushed the rest of the page around:
  opening one research card took its grid from 800 to 1,332 px at 1280 px.
  Their details open in a dialog above the page now, in the frame of the
  GitHub project dialog (`src/components/ui/details-dialog.tsx`), one per
  section, rendered outside the cards. Experience and Education still
  expand, by Romain's choice.
  - **Skills.** A philosophy card shows its first point, the key one, and
    how many it has; its dialog has the framing and all six. The four
    cards stand in one row, 226 px tall at 1280 px (790 before) and 772 px
    at 390 px (2,308). The core activities lost their fixed heights.
  - **Research.** The journey's card shows a two-sentence teaser, and its
    902-character story opens in the dialog: the old short text (595
    characters) told a different story at about the same length.
  - **Links.** `#<card>` points at the card, as before. `#<card>-full`
    also opens its details, and closing turns the link into `#<card>` and
    leaves the page at the card, the focus on its Read more.
- **Loading.** Each section's dialog is a chunk of its own, fetched when a
  card or its Read more is pointed at or focused, and the card's short text
  in a stand-in when the chunk cannot load: `lazyDetails`
  (`src/components/ui/lazy-details.tsx`) builds both. The research and
  skills long texts came with the page's first JavaScript or an idle fetch,
  and come with their dialogs now. A Medium post's text keeps its
  paragraphs, and its extraction moved into the blog cards' chunk.

The sections' heights, before (`6499311`, pre-squash) and after (`d68b534`):

| Section  | 1280 px        | 390 px         |
| -------- | -------------- | -------------- |
| Skills   | 1,904 -> 1,294 | 4,318 -> 2,596 |
| Research | 2,451 -> 2,321 | 3,682 -> 3,329 |
| Papers   | 4,735, same    | 8,197, same    |
| Blog     | 948, same      | 948, same      |

Eager JavaScript, each change against the commit before it, on the Mac
(CI's e2e build, homepage scripts without the polyfills, gzip -9):

| Commit (pre-squash) | Change                                  | Bytes   | Files |
| ------------------- | --------------------------------------- | ------- | ----- |
| `6499311`           | before the round                        | 260,024 | 15    |
| `6d76b2b`           | the shared dialog pieces (five commits) | 260,289 | 15    |
| `c598c87`           | research cards open a dialog            | 260,590 | 15    |
| `2a4c087`           | the PhD and the journey; no idle fetch  | 260,149 | 15    |
| `3730a17`           | the paper cards' shared parts           | 260,167 | 15    |
| `6252afa`           | papers open a dialog                    | 261,190 | 15    |
| `903689c`           | one lazy loader and stand-in            | 261,101 | 15    |
| `dab6eab`           | skills open a dialog, compact cards     | 261,160 | 15    |
| `2ac093e`           | the skills' long texts come with it     | 260,100 | 15    |
| `b62bd7c`           | blog posts open a dialog                | 260,012 | 15    |

The dialogs' chunks: research 6,532 B (with its long texts), skills 3,316
(with theirs), papers 2,421 and blog 1,921; the blog cards' chunk went from
3,842 to 4,487 with the Medium text's extraction. The homepage asks for 29
scripts and 46 requests until the network is idle on a desktop (30 and 45
before) and 28 and 42 on a phone (29 and 43): one script fewer, the
research texts' idle fetch, and two Experience logos more, now within the
browser's lazy-loading distance of the first screen.

Each commit's new tests were proved by mutation (66 mutations from the
papers commit on, all killed). One choice differs from the plan: the blog's
dialog has a chunk of its own, where the plan put it in the blog cards'
chunk, which every visit fetches.

Final HEAD (`d68b534`, pre-squash) in the Playwright container (Node 24.21): `npm ci`,
lint, type-check, knip, format, CI's build, the static-home check and the
client-bundle deny list passed (56 client chunks). e2e, every spec: Chromium
216 passed, 13 skipped and 3 failed; WebKit 189 passed, 41 skipped and 2
failed; both phones 328 passed, 131 skipped and 5 failed; Firefox (terminal,
Python, error reports, privacy) 39 passed. Two failures in every engine are
console checks (`static-shell.spec.ts`'s hydration test and
`error-reports.spec.ts`'s global-error test): rss2json answered this machine
403 all day, and `/api/medium-posts` turns that into a 500, which the
browser logs. Both fail the same way at `6499311`. Chromium's ARIA-label
scan failed once under load and passed 5 of 5 reruns; Mobile Safari's 4 s
splash-timer test fails in this container, as at round 26's end.
Lighthouse, three runs alternating with `6499311`: performance 100 and TBT
0 ms for both, CLS 0.014, FCP 442 to 444 ms against 443, LCP 819 to 821 ms
against 820 to 833 (CPU benchmark 3,822 to 3,902). Unit: CI's ten scripts
on macOS twice, 2,671 tests each time; act's 8 jobs passed; actionlint.

Follow-ups the same day, from the round's findings:

- **Medium's feed, read directly.** rss2json began answering servers with
  a Cloudflare challenge. On the live site `/api/medium-posts` answered
  500 (no Medium posts, and a console error for every visitor) and
  `/rss.xml` was empty. The server reads `medium.com/feed/@<user>` itself
  now (`src/lib/utils/medium-rss.ts`, which the build's color script loads
  too). A feed that cannot be had gives 200 with no posts, cached five
  minutes. The privacy policy names Medium alone.
- **The PDF reader under `next dev`.** pdf.js 5.4's plain build declares
  an unused `var __webpack_exports__`. Webpack before 5.103 keeps the name
  (webpack/webpack#20097), and inside `next dev`'s eval source maps it
  hides the module's exports, so the reader's chunk failed to load in dev
  only (vercel/next.js#89177, open). The alias points at pdf.js's minified
  legacy build, which a test holds; the reader's chunk went from 139,615
  to 139,371 B.
- **`AGENTS.md`,** which `next dev` writes when it detects an AI agent, is
  gitignored.
- **The button and link name scan** in `accessibility.spec.ts` reads each
  element once (see the testing guide's "Things that bite").
- **A Medium post's text, past its first photo.** The text was cut at the
  first "Photo by", and Medium puts a photo under a post's first lines:
  both posts were down to their first sentence (64 and 127 of 854 and
  1,559 characters). Their cards had no Read more, and a `-full` link
  opened a one-line dialog whose closing left the focus at the top of the
  page. The photos' captions, where the credits are, are left out instead.
- **A link's highlight after the splash.** On a page opened at `#<card>`,
  the card's 2.6 s highlight started with the link, and the splash covered
  about 2 s of it (a production build: the highlight from 0.13 to 2.71 s,
  the splash until 2.10 s). AppWrapper says when the page is shown
  (`src/contexts/page-shown-context.tsx`, false while the splash covers
  it), and the highlight starts then; the scroll to the card does not wait.
  Eager JavaScript went from 259,980 to 260,075 B.

Then, from checking those against the live dev server (Romain's choices):

- **The deploy waits for the browser tests.** The height budgets, the
  dialog and link tests and the accessibility scans run in
  `playwright.yml`, and the deploy waited for `ci.yml` alone. A job before
  both deploys, previews included, now waits for the commit's run
  (`.github/scripts/browser-tests-passed.sh`, with a test of its own that
  `ci.yml` runs) and refuses a failed run, one with a job skipped, or code
  no run tested; a docs-only push takes the run before it. On `main` every
  browser-test job runs whatever changed: a green run there had skipped
  the phone tests (37212624117). Asked of GitHub, the check passed
  `d8da49f`'s run and refused `07318f1`'s.
- **The hero's buttons on a phone's first screen.** Below 640 px the hero
  has 16 px above it (64), 16 px paragraph text (18) and 24 px above the
  buttons (32): View Resume ends at 645 px (766) of a 390 x 664 page area,
  an iPhone 12's in Safari, in Chromium and WebKit, on macOS and in Linux.
  On a first visit the cookie notice, 185 px tall, covers it until closed;
  a 320 px phone stays about 120 px short.
- **The focus after a link's dialog** goes to the card's first control
  when the card has no Read more (a text too short for one): it went to
  the page itself, so Tab started from the top. No card is that short
  today.
- **The dialog tests' Medium posts are their own.** The page asks
  `/api/medium-posts` with no query string, so the API's test posts never
  reached a browser test. `card-details.spec.ts` answers the route with a
  post shaped like the real ones (a photo under its first lines, the
  credit in its caption) and a short one. Its accessibility scan runs one
  test per dialog: all eight in one test ran out of 60 s in the Linux
  container.

And from rehearsing the next push with act (Romain's choices):

- **The rehearsal.** act ran `ci.yml` and `playwright.yml` as GitHub would
  for a push of the 564 local commits (from `d8da49f`), every job, in native
  arm64 containers (`.github/workflows/README.md`, "Rehearse a push"). CI
  passed whole, twice: the five quick checks (knip and actionlint for the
  first time in a CI shape) and 2,693 unit tests on the final HEAD
  (`07e72e8`, pre-squash). The browser tests failed one WebKit test (below), and with it
  fixed passed in every job: navigation 7 a browser, accessibility 84 and
  83, performance 75, the terminal's nine shards, the phones 26, Lighthouse 2. Artifact uploads fail under act 0.2.89 and do not count.
- **The server waits ran once.** A job in a container runs its steps under
  `sh -e`, dash in the Playwright image, which leaves `{1..30}` as it is:
  each of the five waits for the server was one 2 s sleep, where it was to
  wait up to 60 s (GitHub's own log printed "attempt {1..30}/30"). They
  count with `seq` now.
- **act's image and its manners.** `node:24-bookworm` had no jq, gh or
  docker, which CI's steps use: `.github/act/Dockerfile` adds them
  (`claret-act:24`, never pulled). act also could deploy: `.env.act.local`
  holds the real Vercel token, and with `--input environment=production` a
  dry run reached the production deploy. The deploy steps and Update
  Publications' pull request skip when `ACT` is set.
- **No section rail on phones.** The floating section nav, a 40 x 324 px
  column fixed at the right, covered the end of the hero's View Resume
  (38 x 43 to 56 px) and a strip of content on phones, and most of the
  height in landscape: it shows from 640 px wide and 501 px tall only.
- **The API's test posts are gone.** `/api/medium-posts` answered two
  made-up posts to `?playwright=true`, which no page or test asked for.
- **WebKit and frame counts.** The one browser test that failed in the
  rehearsal waits for 12 frames as the dashboard opens; Linux WebKit drew
  the page with the terminal open at 4.7 to 7.9 frames a second alone on 4
  CPUs, 0.5 beside another browser, and it failed 4 runs in 5 under CI's 4
  workers. It skips WebKit, which cannot see a 300 to 500 ms spring at that
  rate, and the dashboard dims the page without a blur on Safari, as the
  other dialogs do (about 20 frames a second with it open).

And from reading GitHub's own runs beside the rehearsal's (2026-10-22,
Romain's choices):

- **Two terminal jobs ran nothing.** `python-terminal.spec.ts` sorts first,
  and its 22 Chromium-only tests were the whole of Firefox's and WebKit's
  shard 1 of 3: those two jobs ran 0 tests, on GitHub too (2 to 3 s on
  2026-10-04), while shards 2 and 3 took the 44 others. Left out there by
  their title, the shards hold 15, 15 and 14. The rehearsal's "every job
  passed" above counted those two.
- **No upload fails its job.** Three of the six report uploads could fail
  their job: an artifact outage would fail the run, which the deploy
  refuses, and under act they turned three passing jobs red. All six
  continue on error now. Two cache steps that restored test results
  nothing reads are gone.
- **GitHub's WebKit, rehearsed.** Each of GitHub's last five runs had a
  WebKit terminal test pass only on its retry; the act rehearsals on the M4
  Max had none. Playwright's image on amd64 at a runner's 4 CPUs is about
  1.3 times slower than GitHub (d8da49f's WebKit terminal shards: 3.2 and
  3.7 min against 2.3 and 2.9) and showed d8da49f's flakes, so the terminal
  job's 44 WebKit tests ran there some 590 times
  (`docs/TESTING_INFRASTRUCTURE.md`, "GitHub's WebKit, before a push").
- **What would have failed on GitHub.** Every terminal test began by
  waiting up to 8 s for a quiet network after the load: there, hydration
  held WebKit's main thread until about 15 s and the sections' fetches
  followed, so the quiet came 8.3 to 10.1 s after the load and 9 tests in
  44 failed in one pass. On the Mac, and at d8da49f in the same container,
  it came at the load. The setup waits for the splash to end now. Beside
  it: the resize test's own 60 s timeout (3 runs of 9), a focus race with
  xterm's 50 ms focus timer, a welcome line read before xterm drew it, and
  15 s for the hydrated app to remove the splash's backdrop. All five are
  fixed; a full pass then gave 43 passed and 1 skipped, and the drag test
  that failed on GitHub passed 41 runs of 41.
- **The accessibility job too.** The act rehearsal of `c415aea` (pre-squash) passed
  every job, with one WebKit test flaky (the dark theme's scan). The
  accessibility job's 84 WebKit tests, once in the same container, failed
  6: four ran out of a 60 s timeout the describe set (CI's is 300 s), the
  plain contrast scan read the skills manifesto at 1.04:1 mid-fade, and a
  footer link focused by the cookie notice's test stayed under the
  notice. The timeouts are gone and whole-page scans pause the manifesto.
- **The page grows after the splash.** Projects and Blog fill in when their
  data comes, 1 to 3 s after the splash there, by 134 and 820 px above the
  footer; a focus scroll aimed before that leaves a footer link under the
  cookie notice. The test now lets the page reach its height first. A
  first fix, moving the notice's height into a layout effect on the
  reading that it came too late, was reverted when a probe showed the
  height in place in 8 runs of 8.
- **One product change from it.** The skills manifesto no longer plays on
  its own for visitors who ask for reduced motion (Romain's call): framer
  keeps opacity animations under that setting, so its sentence still
  faded every 6 s; Play and Pause stay theirs.
- **With every fix.** Three accessibility passes in the container: 83
  passed and 1 skipped each, the slowest test 108 s. The act rehearsal of
  the push at `8b9f0e2` (pre-squash), both workflows: CI's 18 jobs (2,696 unit tests)
  and the browser tests' 19 jobs passed, none flaky, Firefox's and
  WebKit's terminal shards holding 15, 15 and 14 tests (one skipped).

And the rest of the jobs at GitHub's speed (2026-10-22, Romain's choices):

- **The harness is a script.** `scripts/e2e-container.sh` builds and
  serves a commit as `playwright.yml` does, in the image it names, on amd64
  at 4 CPUs, and runs a job's specs there with CI's environment.
- **Every other job, once.** Navigation in three browsers, the terminal in
  Chromium and Firefox and accessibility in Chromium passed. The phones'
  rail test waited 15 s for a rail that mounts after hydration, which in
  Mobile Safari came 8 to 11 s after a 15 s load (fixed: it waits for the
  splash to go first; the phone job 26 of 26, twice).
- **Chromium needs its own calibration.** The performance job failed 24
  tests of 76 at 4 CPUs, but d8da49f's Chromium jobs ran 1.5 to 1.9 times
  GitHub's times there and within 10% of them at 8 CPUs, where the job
  failed 1 test in two passes: the splash stand-in test, which told the
  stand-in from the 4 s timer by a clock that starts at the page while the
  timer starts at the app's mount. It now opens the terminal, which only a
  completed splash allows; a mutant whose stand-in never completes fails
  it, as it passed a first fix that timed from the chunk's first request.
- **Lighthouse here reads low.** 63 to 65 at 4 or 8 CPUs, as d8da49f
  (which scored 83 on GitHub) does here. First and largest paint (0.4 to
  1.1 s) and layout shift earn all their 60 points; Total Blocking Time
  (2.9 to 4.1 s) and Speed Index (6.7 to 7.5 s), Chromium's main thread,
  earn 3 to 5 of their 40, and 8 CPUs cut the first by 29% without lifting
  its score off the floor. GitHub's log of d8da49f kept only the score.
- **A busy Mac voids a pass.** Research jobs took 12 of the 16 CPUs midway,
  and the same job then failed 12 and 21 tests. The script now warns when
  the host's load is over half its CPUs. On a quiet Mac (load under 5),
  the whole performance job with the stand-in fix passed twice at 8 CPUs:
  75 tests and one skipped, 1.8 min each.
- **Node runs unoptimized in the container.** Docker Desktop starts every
  `node` in an amd64 container with `--no-opt` (V8's optimizing compiler
  off), hidden from `process.execArgv` by a preload at `/proc/.reset`: the
  server and Playwright's runner, for both browsers, but not Chromium. The
  calibration measured the whole; why Chromium needs 8 CPUs where WebKit
  does with 4 is unmeasured. The reasons first written here (Rosetta costs
  V8 more; one Lighthouse audit leans on one thread) were guesses.

And what that confirmation left open (2026-10-22, Romain's choices: a
repeatable Lighthouse projection, guards in the container script, the
hidden `--no-opt` left documented):

- **The amd64 container cannot project Lighthouse.** Total Blocking Time
  and Speed Index sit at their scoring floor there, so it reads 63 to 65
  for a page GitHub could score anywhere from about 65 to 95, and the
  "about 83 on GitHub" read from it was unsound. Round 20's method,
  Chromium native on arm64 with Lighthouse's CPU slowdown at GitHub's, is
  now a setting (`LIGHTHOUSE_CPU_MULTIPLIER`, 1 unless set, an error for a
  value it cannot read) and a recipe in the testing guide. At `90d7c32` (pre-squash):
  92 to 96 at GitHub's slowdown (TBT 236 to 347 ms, TTI 1.7 to 1.9 s) and
  83 to 86 at 1.55 to 1.85 times it, where round 20's HEAD scored 89 to 91
  (TBT 367 to 443 ms). No regression, and 12 to 16 points over the gate.
- **Rosetta, measured for Chromium.** At the same CPU-benchmark slowdown,
  about 4, the amd64 container's Total Blocking Time is 2,930 ms against
  280 ms natively, and its Speed Index 6.7 s against 1.7 s: Chromium's page
  work under Rosetta runs far slower than the benchmark says. The reasons
  retracted above came from an inference (18 of the 24 failures at 4 CPUs
  timed out on the splash's loading bar); this measures it, for Chromium
  only.
- **An interrupted `docker exec` returns 0** while its command goes on in
  the container. Interrupted during `npm ci`, the container script went on
  to a build that failed on `next: not found`, the pattern of a container
  left at 15:20 that day (its install log cut at the same 3,153 bytes). It
  now ends on Ctrl-C (exit 130; in `run` it stops the tests inside too),
  and refuses a second run, or a start, while tests run in the container.
- **act is not native.** `.actrc` runs every job on amd64, so act runs
  CI's image as the script does, on all of Docker's 16 CPUs instead of a
  runner's 4.

Then the script's polish (2026-10-22, Romain's choice of all four):

- **No archive left behind.** `start` pipes `git archive` into the
  container: it had left a 45 MB `source.tar` per start in `OUT`, 270 MB in
  one day. A name that is not a commit now stops it before anything else.
- **The busy warning names what is busy.** It sums the CPU of the
  processes outside Docker's VM and of the other containers, read with
  `docker stats` in 1 to 2 s, where the load average had counted the
  script's own runs too; under research jobs it read "13.3 of 16 CPUs in
  use, the most by python".
- **arm64 needs no manual tag.** `start` keeps that platform's image under
  `claret-e2e/playwright:<version>-arm64`, made on first use, since the
  local image store keeps one architecture per tag.
- **Wait for a quiet Mac to project.** Under research jobs on 14 of 16
  CPUs, a Lighthouse run at an effective slowdown of 6.5 scored 76, where a
  quiet Mac gave 83 to 86 at 5.7 to 6.8: scaling the multiplier by the
  benchmark does not make up for a loaded host.
- **Chromium failures in the container need a cause first.** The testing
  guide says so where it sets Chromium at 8 CPUs.

### Round 28: the squashed history rehearsed, the old copies reviewed (2026-10-25)

- **Every squashed commit under act.** Each of the nine commits ran CI and
  the browser tests as the workflows README rehearses a push. The unit tests
  passed in all nine (2,149 to 2,699 tests). Every browser job passed in
  phases 7 and 8 and the references commit (`110ea35`, pre-squash); phases 1
  to 6 failed 14 or 15 of their 17. Lint and the type check ran from phase 5
  on (until round 23, `ci.yml`'s jobs began with a sudo step that act cannot
  run) and passed, except actionlint in phases 5 and 6, whose act image had
  no docker CLI. The browser jobs built the site in every phase.
- **Why phases 1 to 6 failed: act, not their code.** They fetch Medium
  through rss2json, which now answers act's containers with a Cloudflare
  page. Their server logged that error on every test, and under act a
  server that writes after its start step stops serving. Phase 5's terminal
  shard 2 passed 21 of 21 with the server's output in a file, and 4 failed
  with 12 not run without it. Phase 7 reads Medium's feed directly and
  passed. The browser jobs write to `server.log` now.
- **act's own failures.** One or two jobs a phase found npm half unpacked
  in act's shared tool cache; each passed alone (workflows README).
- **The old copies.** `claret.tech copy`, the site of 2025-09-03, held
  nothing the site lacks but two items, both taken back: the memberships,
  data no section ever rendered (now "Memberships & Service" under
  Education, eight entries from 2015 on), and a unit test of
  `WebLLMClient.isSupported()` deleted in 2025 (`src/lib/webllm/client.test.ts`).
  Its history, 725 commits with two found nowhere else, is kept in the git
  bundle `claret.tech-copy-2025-history.bundle` beside the repository.
- **What the memberships cost.** Projected at GitHub's slowdown on a quiet
  Mac (two containers, runs alternating), `2877e8b4` (pre-squash) scored 93
  and 94 (TBT 301 and 277 ms, LCP 0.90 s) where `110ea35` scored 95 and 94
  (TBT 263 and 286 ms, LCP 0.86 s). Under act both sit at the gate, back to
  back on a quiet Mac: 80 to 81 against 78 to 82. The rehearsal's one
  Lighthouse failure (73 to 74, TBT 1.2 s) ran with 4 to 6 cores busy
  outside Docker.
- **The terminal keeps the wheel, and the finger.** xterm takes a wheel
  only while it has lines to scroll. Before any scrollback, past either end
  of it, and over the title bar, the wheel scrolled the page behind the
  window, 300 px a notch in Chromium, Firefox and WebKit. The window now
  cancels every wheel after xterm has used it, except Ctrl and a wheel (the
  browser's zoom, and a trackpad pinch) and while minimized to its title
  bar. On a phone, where the terminal covers most of the screen, xterm 6
  has no touch scrolling at all: a swipe scrolled the page, 200 to 1,500
  px, and the scrollback was out of reach. A finger now moves the lines
  under it and a flick glides on (`src/lib/terminal/touch-scroll.ts`); two
  fingers stay the browser's pinch zoom.

### Round 28, part 2: the review (2026-10-26)

- **The dev server on 127.0.0.1.** `next dev` listens on every interface by
  default, and on UCD's network the Mac has a public address, with its
  firewall off: the dev server was open to whatever UCD lets in.
  `npm run dev` and `dev:https` now bind 127.0.0.1 (`localhost` binds
  `::1` alone, which a client of `127.0.0.1` then misses). A dev server for
  a phone listens on the Tailscale address (testing guide, "On a phone or a
  tablet").
- **A wheel on the terminal's title bar scrolls its lines**, as a finger
  there already did.
- **Each badge drawn once.** The training and memberships grids drew a
  desktop, a tablet and a phone copy of every badge, two hidden by CSS: 524
  elements where 200 showed (11% of the page's 4,820), each copy with its
  own framer-motion entrance. One responsive grid now holds 228, 198 shown,
  with the same look at each width in light and dark (high contrast boxes
  every element, so its heights moved by a few rows of borders). Projected
  at GitHub's slowdown, A/B on a quiet Mac, it scored 95 and 95 (TBT 252
  and 251 ms, LCP 0.87 s) against `cc786ded`'s 94 and 95 (TBT 282 and 266
  ms, LCP 0.87 to 0.90 s): what the memberships cost is back. A badge
  lights for a mouse alone: a phone fires mouse events on a tap, which
  would have left the tapped badge lit.
- **act's Node cache.** The rehearsals' cleanup removed act's shared
  `act-toolcache` volume, so three jobs unpacked Node at once and one or
  two found npm half unpacked (6 of 10 rehearsals). The workflows README's
  recipe keeps the volume and warms a new one with a single job.
- **The old React site's history**, 586 commits that only a local folder
  held (GitHub's repository keeps `main` alone), is in the git bundle
  `claret.tech-2022-history.bundle` beside the repository.
- **Kept as they are:** touch scrolling, which works on Romain's iPhone and
  iPad; the memberships; Playwright 1.64.0 (1.64.1 fixes nothing used here,
  and 1.65 brings the Firefox fix two skips wait for).

### Round 28, part 3: the badges on a phone (2026-10-26)

- **A phone shows the newest few.** On a 390 px wide phone the training and
  memberships grids stacked their 15 badges one per row, 1,038 px (the two
  blocks 1,274 px with their headings, 1.5 screens of an 844 px phone). A
  phone now shows the 3 newest training badges and the 4 newest memberships,
  newest first (CSS `order`), each grid followed by a Show all button: the
  blocks take 834 px, 440 px less, as at 360 and 412 px wide. Show all
  brings every badge back, plus the button's 52 px row. Tablets and desktops
  show every badge, oldest first, as before: their screenshots are
  pixel-identical.
- **Hidden, not removed.** The folded badges stay in the HTML (the DOM size
  is unchanged), hidden below `sm`. Without scripts, layout.tsx's
  `<noscript>` style shows them and hides the buttons.
- **The counts are data.** How many a phone shows is `phoneCount` beside
  each section's title in `src/data/sections/education.ts`. The tests take
  it and the totals from there: the first phone tests named them, so a new
  membership would have failed them.

### Round 29: the security audit's fixes (2026-10-27)

Cloudflare's security-audit skill reviewed `0341d998` (run 1, kept outside
the repository in `~/security-audit-skill/claret.tech/run-1/`): no critical,
high or medium finding, 3 confirmed low ones and 19 leads that need a fact
from outside the repository (Vercel, GitHub or the Mac). The fixes are on
`main`, one commit each, each code change with its tests.

- **The three low findings.** The client-error daily caps now hold for
  reports in flight together (a slot is taken before the first await and
  given back on failure). The Medium scraper's image fetch stays on Medium's
  image hosts, with a byte and pixel cap. The AI chat loads only model
  artifacts pinned by commit and checked by SRI
  (`src/lib/webllm/model-pins.json`).
- **Leads with a fix in the source.** `npm start` binds 127.0.0.1; act
  rehearsals get no host Docker socket and no host GitHub token; the GitHub
  routes list public repositories only, whatever the token reads;
  `/pdf/[slug]` renders the registry's documents only; the image optimizer
  takes no remote image (the GitHub avatar is vendored); `vercel.json`
  turns Git deployments off by both keys, and the project's Git link is
  gone; no MCP endpoint on the dev server; the Pyodide runtime, the PDFs and
  the pdf.js worker are same-origin only; the deploy's Vercel CLI comes from
  a lockfile with no install script; every action is pinned by commit and
  every container image by digest.
- **Hardening.** Capped and checked request bodies (client-error,
  performance-report; POST `/api/publications` removed); fixed error
  answers with redacted logs on both GitHub routes; one GitHub load at a
  time with a minute's pause after a failure; a limiter on `/rss.xml`, whose
  query now redirects to the one cached URL; a CDATA-aware RSS reader and a
  well-formed feed without Medium's view counter; only colors leave the
  Medium pipeline; escaped JSON-LD, server markdown and terminal output;
  quoted values blanked from client error reports before they leave the
  browser; HSTS on every build but a dev server's; `npm audit` of the
  runtime tree in CI.
- **The pdf.js worker** (1.1 MB) was revalidated on every visit by the
  pages' no-cache rule. Its URL now names the pdf.js version, and that path
  is immutable for a year.
- **Not done, on purpose.** Route handlers do not pass `request.signal` to
  their upstream loads: those loads are shared between callers now
  (single-flight, the scraper's in-flight map, the blog-image memo), and
  one caller's abort would cancel the others' answer. `?playwright=true`
  still works in production builds: CI's browser tests depend on it, and
  it only quiets toasts.
- **Romain's part.** Rotate the tokens dated 2025-08-27 (Vercel's
  `GITHUB_TOKEN`, the Actions secrets `GH_TOKEN` and `VERCEL_TOKEN`) for
  fine-grained, read-only ones on the Production target, and revoke the
  classic token in this repository's 2025 history, which is public.
  Secret scanning with push protection and a `main`-only Production
  environment were turned on the same day.
- **Checked on `df1d06b6`:** lint, types and formatting; 2,814 unit tests;
  the touched browser specs (privacy, PDF reader, error reports, terminal,
  Python terminal, static shell, card details) in CI's image on Chromium,
  153 passed (8 CPUs, the Mac under load, so no timings); act's API job
  under the new `.actrc` (no Docker socket, empty token), 147 passed.

## Measuring well

- **Interleave.** Build the baseline in a git worktree, serve it on another
  port, and alternate runs. Machine load drifts by tens of percent between
  runs; back-to-back blocks of runs attribute that drift to the change.
- **Give the baseline the same environment.** A worktree has none of the
  gitignored files: no `.env.local` (its GitHub API route answered "username
  not configured", so Projects rendered empty: 930 px shorter, ~300 fewer DOM
  nodes) and no `public/pdf.worker.min.mjs` (made by `scripts/setup-assets.js`,
  which `npx next build` skips, so its PDF reader failed to load). Link or copy
  them before building. The first comparisons on 2026-10-07/08 lacked both and
  favoured the baseline. The full list: `.env.local`, `node_modules` (a
  link), `public/pdf.worker.min.mjs`, `public/profile.json`,
  `public/pdfs/RomainClaret_CV.pdf`, `public/pyodide/` (the terminal's
  Python), and the cache `src/lib/utils/medium-cache.json` (round 26
  removed the Kudos scraper and its cache). Compare sizes within one checkout: two builds of the
  same commit, one in the main checkout and one in a fresh worktree, gave
  `/` sizes 809 B apart, with every chunk id changed (2026-10-11).
- **Check for strays.** A test run that hangs can leave a forked vitest worker
  ("node (vitest 1)") at several cores; `pkill -f "vitest run"` does not reach
  it. One skewed an hour of measurements here. Look at `ps` first.
- **Keep the machine awake and to itself.** A run across a sleep returns
  nonsense (270 of 290 scroll frames over 20 ms, 20 fps), and the minutes
  after a wake, or another session building, load it too. Log the load
  average before each run (`sysctl -n vm.loadavg`) and discard runs taken
  under load.
- **fps here is throughput.** Headless Chromium does not cap frames at the
  display rate (it reaches 120), and with SwiftShader the GPU process sits at
  100%. A lower fps means more GPU work per frame. To find where it goes,
  pause or hide one thing per fresh page load and compare, and read the GPU
  process's CPU time (`ps -o time`).
- **main% follows fps.** With frames uncapped, each extra frame is extra
  main-thread work, so a build that draws more frames reads a higher main%.
  When two builds differ in fps, compare main-thread time per frame (a rAF
  counter over the traced window) before calling it a regression. A
  +1.2-point S1 difference on 2026-10-08 bisected cleanly to one range of
  commits, then showed no extra work per frame and no difference over 12
  traced runs.
- **CLS here is the sum of every shift** in the run, not the 5 s session
  window web-vitals reports, so anything that shifts repeatedly (a typing
  animation) adds up.
- **Check the startup check's verdict for S7 and S8.** They stay at LOW
  because headless Chromium runs WebGL on SwiftShader: Playwright launches
  it with `--enable-unsafe-swiftshader`, `failIfMajorPerformanceCaveat`
  fails, and the check pins that (`software-webgl`) for the session.
  Measured with Playwright's Chromium 143 on macOS. A Chromium launched
  without that flag refuses SwiftShader and has no WebGL at all
  (`no-webgl`), which starts at LOW but may be raised after 60 s, so its S7
  and S8 numbers are not comparable. The harness records the verdict with
  each run (`probe`) and prints it for the scenarios on the automatic tier.
- **Headless WebKit stalled on macOS: Playwright ran a build for an older
  macOS.** A test's `page.evaluate` never returned, and the context then
  failed to close: 60 s each, in about half of all `navigation.spec` runs on
  2026-10-11, on every build tried, with every WebKit process idle (a
  protocol stall, not a busy page). Playwright 1.57 caps macOS at version 15,
  so on macOS 27 it ran WebKit 26.0 (build 2227) made for macOS 15. 1.64
  runs WebKit 27.2 (build 2370) made for macOS 26: alternating 10 runs each
  of `navigation.spec` and `pdf-reader.spec`, 1.57 failed 8 (1.9 to 2.9 min
  each), 1.64 none (27 to 33 s), Fisher p = 0.0007 (2026-10-12). Before
  calling a browser problem environmental, check which build Playwright
  picks for the OS (`hostPlatform`), and judge a timeout by an A/B with a
  concurrent control, never by a count from another day. And look for
  strays first: a probe that had timed out kept a WebKit browser running
  for 18 hours.
- **Test mode must not change the layout under test.** A test-mode style
  gave every nav, button and link `position: relative` and a z-index of
  10002: in Chromium the fixed navigation scrolled away, and the logo test
  passed because its helper forced styles and scrolled to the top itself;
  `sr-only` links lost their clip and sat on screen at 168 x 19, so the
  skip link test clicked a link no visitor sees. Gone since 2026-10-11:
  tests see the site as it ships, and `ensureElementNotBlockedByToast`
  fails instead of forcing its way.
- **axe cannot decide on text over gradients, blurs or other elements.**
  The axe tests fail on any contrast failure since 2026-10-11 (384 had
  built up while they let them through), but on the homepage axe set aside
  about 500 texts, the stat numbers among them: a clean run proves only
  what it could measure. Measure the
  rest on pixels: make the text transparent, capture its box (its own
  range, not its padding or border), lay its colour over every pixel, and
  take the 10th percentile (2026-10-11: 93 failures in the light theme
  that axe never reported). Emulate reduced motion first, and tag the
  elements before scrolling: axe's selectors carry state that a scroll
  changes (`data-anim="off"`). Read `color(srgb ...)`, which `color-mix()`
  computes to, in 0 to 1.
- **Measure after the page settles.** `scroll-behavior: smooth` makes
  `focus()` and `scrollTo()` animate, so poll for the end or scroll
  `instant`ly; and a dialog fading in reads to axe at its partial opacity (a
  6.7:1 badge measured 1.01). A panel that springs in moves under a hit
  test: points taken from its box mid-spring fell on the terminal's edge, so
  wait for its transform to settle. A click is a press and a release: in
  Firefox the dashboard's close button was pressed mid-spring and released
  after it had moved, and the click went to their common parent, which
  neither closes nor minimizes (recorded in 4 of 10 runs; every box was read
  at a scale between 0.9 and 0.99). Wait on the moving element itself: a
  child's computed style does not show its parent's transform, and the close
  test had waited on its static hint. Colours too: right after an arrow key,
  WebKit gave axe one frame of a tab whose `transition-colors` had moved its
  background but not its text (#9ca3af on #1e40af, 3.43:1), and with motion
  the scan read every change at its start. Wait for the running animations
  inside what is scanned (skip endless ones).
- **The API's rate limit counted local test browsers as one client.** It
  keys a client by IP and the first 50 characters of its user agent, and
  locally no proxy sets an IP: all the test browsers of an engine shared
  100 requests a minute, and each homepage load spends 6. One run of the
  terminal spec (27 loads in 26 s) had 38% refused on a fresh bucket and
  99% right after another run, and the sections fell back without a word.
  Since 2026-10-12 `tests/e2e/utils/fixtures.ts` gives each test its own
  `x-real-ip` (0 of 326 refused), and every spec imports `test` from it.
  A header on the context, not a route: routing turns the HTTP cache off.
  Contexts a test makes with `browser.newContext()` inherit it with the
  test's other context options. Playwright's WebKit drops it now and then:
  4 of 2,110 WebKit API requests in a full gate (Chromium: 0 of 1,119),
  ordinary page fetches, all within the first seconds of a run while six
  workers start their browsers; the test running at each, alone, sent 60
  with the header in 10 runs. They land in the shared bucket, which no
  test relies on.
- **`test.use({ reducedMotion })` needs Playwright 1.64.** 1.57 had no such
  test option and ignored the key, so `terminal.spec.ts`, written for a
  reduced-motion page on 2026-08-04, ran with motion until the upgrade. The
  spec now asserts the media query. TypeScript flagged the key from the
  start (TS2353), but nothing type-checked test files until
  `tsconfig.test.json` (2026-10-12), which found 61 more errors in 9 unit
  test files.
- **Load can also understate.** Under a load average of 83 to 190 the
  frame sampler read cheaper than on a quiet machine (main thread 35
  against 46 ms/s): the pipeline dropped frames, 79 traced BeginMainFrames
  a second against 107.
- **A test that orders events by the clock fails on a slow machine.**
  static-shell held the splash chunk a fixed 6 s and assumed the 4 s timer,
  which starts after hydration, came first: with the other chunks 5 s late
  it failed every run, and under load 3 of 40. Hold each request until the
  event it must follow (the page showing, the check after the first
  failure) and let it go then: 20 of 20 since, and 3 of 3 with the delay.
  CPU throttling past ~12x is not the same test: there the page stops
  answering at all (the cliff in terminal.spec's header).
- **No stopwatch in unit tests.** A jsdom render timed against 10 to 100
  ms measures the machine: the button's failed at 37 ms under a load
  average of ~500 and passed 29 of 29 runs at ~35. Guards against work
  that grows faster than its input keep a ceiling a loaded runner cannot
  reach (`sanitize.test.ts`, `markdown-server.test.ts`: 2,000 ms).
- **Firefox and CI's Linux browsers run here in Playwright's image.**
  Firefox does not start inside the macOS sandbox, and CI's WebKit is Linux.
  Build and serve inside the container, as CI does, so no request leaves
  it. In `mcr.microsoft.com/playwright:v1.64.0-jammy` (or `-noble`: they
  behave the same here; arm64, or x64 emulated at about half speed):
  - unpack a `git archive` of the commit: tracked files only, as a local
    `public/profile.json`, which CI never has, changes the Projects section;
  - use the image's Node 24, CI's too since 2026-10-15 (until then CI
    pinned 20 and this recipe put Node 20 first on the PATH);
  - run `npm ci`. Its postinstall (`setup-assets.js`,
    `mirror-legacy-pdfs.js`) makes `public/pyodide`, without which the
    Python terminal tests time out. (`npm ci --ignore-scripts` and a
    postinstall by hand were needed while `canvas`, which had no
    linux-arm64 binary for Node 20, was installed; it went in round 14.)
  - build with CI's env (`SERVE_HTTP=true`, `USE_GITHUB_DATA=false`, ...)
    and `npm start` with `SKIP_EXTERNAL_APIS=true`;
  - wait for a 200 as CI does, then run with `CI=true` and `--retries=0`.
    With no server answering, `playwright.config.ts` starts `npm run dev`
    without a word.

  Install, build and start take about 70 s on arm64. Run the commit before
  too, and run many probes in one container through `docker exec`.

  Serving from the Mac instead, through a forwarder to
  `host.docker.internal` (until 2026-10-14), stalled 10 to 24 of the about
  2,800 connects of a full run, for 2 to 68 s. The stalls fell at 2.1, 5.1,
  7.1, 11.2, 19.3, 35.8 and 68.0 s: macOS's SYN retry schedule (1, 1, 1, 1,
  1, 2, 4, 8, 16, 32 s), not Linux's. So the drops were on the Mac, between
  Docker Desktop and a server whose listen queue never overflowed (0 in
  `netstat -s`). Tests that waited 30 s on a request failed there and
  nowhere else. Round 10's set of 354 tests failed 6 through the
  forwarder, 4 of which passed 5 of 5 alone; served in the container, it
  failed none (on `5d36b46`, pre-squash, which had also fixed one of the 6).

  For CI itself, rehearse with `act`: a scratch workflow with CI's steps
  (CI's x64 image, Node 20, `npm ci`, the build and the server inside the
  container), run with `act workflow_dispatch -W <file>`, `--pull=false`,
  `--reuse=false`, `--action-offline-mode` and an artifact directory
  (`--artifact-server-path`). Offline mode uses the actions act has
  cached: its own fetch of them timed out here.
  - **One server per step.** Give each test step a fresh server, as CI's
    jobs each start their own. One server for every step left three
    no-script tests hanging at 60 s on both tries: Next's image optimizer
    (Traps).
  - **Emulated x64.** It runs at about half speed, which exposes
    clock-bound tests. arm64 cannot stand in: `npm ci` with scripts fails
    on `canvas`.
  - **An idle Mac.** Round 11's rehearsal (a server per step) ran while
    another project's jobs held the load average at 180 to 275. Every step
    took 2.5 to 5 times as long as round 10's, and 15 tests failed (2 more
    were flaky): 60 s test timeouts, and the stylesheet's fallback
    beating the 4 s timer. Each passed natively in the arm64 container.
    The three no-script tests that had hung passed.
  - **Cache pruning.** On its first start, act's cache server prunes old
    entries.
  - **WebKit's "Page crashed".** It was neither arm64 nor the image
    (Playwright #43070, closed with the advice to use a newer image, is
    another crash): it was backdrop filters (Traps, below).

## Traps found on the way

- **A requestAnimationFrame loop that draws nothing is not free.** The
  frame sampler's callback is a few lines of arithmetic, yet on the still
  homepage it cost 33 ms/s of main thread and about 84 ms/s of CPU across
  Chromium's renderer and GPU processes, and about 117 ms/s in WebKit: each
  callback runs a rendering update and a commit at the display rate, with
  no frame drawn. Count BeginMainFrame, Commit and DrawFrame in a trace
  before calling a page idle.

- **A CSS `opacity` animation on an SVG element gets its own compositor
  layer** in Chromium, even while paused. Forty grid circles became forty
  layers under the grid's blur and cost more per frame than the SMIL they
  replaced. Animate a registered custom property (`@property`) and derive
  the opacity from it (`motion.css`, `--grid-pulse`).
- **Hidden is not free.** The fixed site grid behind the hero's opaque grid
  was the largest GPU cost at the top of the page although only a 64 px band
  of it showed. It now clips itself to that band and rests the rest
  (`useGridCover.ts`).
- **Invisible movement still counts as layout shift.** Transparent text is
  painted, so the typewriter's untyped remainder moving with each keystroke
  was a shift; `visibility: hidden` is not painted. A moving element is a
  shift where a newly inserted one is not, hence one cursor per keystroke.
- **next/dynamic fetches when it renders.** A component rendered closed
  (`<Modal isOpen={false}>`) still downloads its chunk. Mount it only while
  open, and preload on intent (`load-on-intent.ts`).
- **A failed next/dynamic chunk is an error, not an empty slot.** React.lazy
  throws while rendering and keeps the rejection, so the nearest error
  boundary takes over, and its "Try Again" cannot fetch the chunk again.
  That was the whole site for the splash, its Lottie player and the
  terminal's performance monitor, dashboard and report, everything under
  the navigation for the hero's brains, and the reader on `/pdf/<slug>`.
  Loaders on those paths now go through `withLoadFallback`. Test one by
  aborting the chunk whose code contains a given string (`routeChunk` in
  `static-shell.spec.ts`).
- **A dialog rendered inside the page stays under it.** Every section sits
  under AppWrapper's `relative z-10`, and each project card's grid item is a
  stacking context of its own (its entrance animation keeps a transform), so
  no z-index lifts what renders inside one above the next card or the
  root-level cookie notice (`z-50`). The project cards' details panel painted
  under the next row and gave it its links' clicks, and the PDF reader sat
  under the cookie notice, a quarter of a phone's screen. Render a dialog
  through a portal to `<body>` (`project-details-dialog.tsx`,
  `pdf-modal.tsx`, `z-[9999]` as PerformanceModal), and once, outside the
  clickable card: React events bubble through a portal along the component
  tree, so inside the card every click in the dialog would reach the card's
  handler. At the same z-index, the later element in the document paints
  on top: the performance dashboard, rendered in place, opened from the
  terminal under a PDF reader already open (a portal at the end of
  `<body>`), so it portals too, and the one opened last is on top. So do
  the performance monitor and the stand-ins for the dashboard, report and
  monitor (2026-10-12): every point of the monitor opened over the reader
  was the reader's. A panel that is not modal leaves an Escape typed inside
  a modal dialog to that dialog.
- **The cookie notice comes first in the page.** GOV.UK places its cookie
  banner first in `<body>`, before the skip links. Last in `<body>`, the
  notice came after the whole page, and after "Got it!" WebKit's next Tab
  left the page for the browser's own controls. It renders through a
  portal into a container prepended to `<body>` while it shows, a region
  named "Cookies on claret.tech"; after "Got it!" the next Tab is the skip
  link. Tests that tab or scan from the top and are not about the notice
  acknowledge it first (`tests/e2e/utils/cookie-notice.ts`): it shows 1 s
  after load, so they met it or not by timing.
- **`/rss.xml` read the site's own API over HTTP.** Each poll was a second
  request through the rate limiter (every RSS reader one client), made
  `/api/medium-posts` scrape each post's page for images the feed never
  uses, and in a local or preview build read production. Both read
  Medium's feed through `fetchMediumFeed` (`src/lib/utils/medium-feed.ts`)
  now.
- **One scroll lock, counted.** The dialog hook, the performance dashboard
  and the splash each wrote `body.style.overflow` and wrote back their own
  idea of unlocked ("", "unset", "auto"), so whichever closed first
  unlocked the page under the other. `lockPageScroll` (`scroll-lock.ts`)
  counts: the first lock saves the inline value, the last release puts it
  back.
- **A hint laid over a panel takes its clicks.** The dashboard's "Press
  ESC to close" floated at the window's top right, after the panel: below
  1920 px wide it covered the header's minimize and close buttons, at
  1280 x 720 a click at the close button's centre landed on it, and at
  opacity 0, before it faded in, it already caught clicks. It sits in the
  header now, where the layout keeps it apart from the buttons.
- **A run started on "no result yet" loops on failure.** The report dialog
  generated whenever no run was in flight and no report had come back. A
  failed run ends that way too, so with the API answering 429 it started
  over every 2.2 s, a new request each time, and cleared its error before
  anyone could read it. It generates once per opening now.
- **`statusText` is empty over HTTP/2.** HTTP/2 carries no reason phrase,
  and production serves HTTP/2, so the report's error, built from
  `response.statusText`, read "Failed to generate report: " and nothing
  more. Say what the API said (`{ error, retryAfter }`) or the status code.
- **A tap on a card still sliding in can scroll the page.** A card's 20 px
  entrance starts when an IntersectionObserver reports it in view, a frame
  or two after a test scrolls to it, so a trial tap or a wait for identity
  transforms both run before it starts. A tap on the moving button waits,
  retries, and Playwright 1.64 then scrolled the page 410 px to place it,
  after the test had read the page's position (14 of 20 runs). A test that
  is not about motion runs with reduced motion.
- **The unit tests' `performance` has no methods.** `src/test/setup.ts`
  spreads it into a plain object to mock `now`, and a spread copies none of
  a class's methods, so `getEntriesByType` is missing; and vitest's fake
  timers, by default, fake `performance` too and rebuild it the same way.
  Fake only the timers (`toFake`) and define what the code reads.
- **A line clamp does not stop a stretched box.** `-webkit-line-clamp` only
  places the ellipsis; the lines after it are still laid out, and a box
  stretched taller than the clamp (`flex-grow` in a card that a taller
  neighbour stretches) shows them: 5 lines under a 2-line clamp on a phone.
  Let a wrapper take the spare height and keep the clamped element at its
  own.
- **WebKit's Tab skips links and buttons.** Safari's default (and
  Playwright's macOS WebKit) moves Tab between form fields and elements with
  an explicit tabindex only (framer's tap gesture gives its buttons
  `tabindex="0"`, so those count). A focus trap that wraps only at its first
  and last control may never run: the PDF reader's own trap let the first
  Tab from its close button leave it, and Shift+Tab walk the page behind it;
  the legal texts' trap let all 12 Tab presses out. The modal dialogs (the
  reader and its stand-in, the legal texts, a project's details, the
  performance tools' stand-ins) now use `useModalDialog`, which moves focus
  by hand on every Tab and Shift+Tab; the performance dashboard and report
  are not modal dialogs and have no trap at all. In jsdom a Tab moves
  nothing either, which is how a unit test catches the half trap.
- **One Escape, one layer.** The performance monitor hides on Escape
  through a `window` listener, and `window` comes after `document`, where
  the dialogs listen, so one Escape closed a dialog and hid the monitor
  with it. Whoever uses Escape now calls `preventDefault()`, and the
  monitor skips a marked one. A dialog's own handler must not skip marked
  keys: stacked dialogs register bottom first. The terminal sits above all
  of them (z 10000), and xterm cancels Escape and Tab at its textarea, so
  nothing it opened (the monitor, the dashboard, the report) could be
  closed with Escape while typing there. It now lets Escape through
  (`attachCustomKeyEventHandler` returning false skips xterm without
  cancelling the event; neither the shell nor the REPL reads it), and a
  dialog ignores an Escape whose target is an element outside it, other
  than `body`, so Escape in the terminal never closes the reader beneath
  it.
- **A lazily mounted dialog hears keys only once its effects have run.**
  The dashboard, the report and every dialog on `useModalDialog` set up
  their Escape and Tab handling in `useEffect`; mounted from a chunk, that
  ran after the browser painted them, and a key pressed in between went
  elsewhere: under a load average of ~480 an Escape pressed as soon as the
  dashboard showed closed the performance monitor instead. They use
  `useIsomorphicLayoutEffect` now (listeners, focus, scroll lock before
  paint). To test it deterministically, render a probe after the dialog:
  its layout effect runs after the dialog's and before any passive effect,
  which is when such a key lands. (A MutationObserver firing at the first
  mutation is not enough: React may flush passive effects in the same task
  when a render is fast.)
- **pdf.js gives each link's wrapper `tabindex="1000"`, and the link no
  name.** A positive tabindex goes ahead of everything else in the Tab
  order, and each wrapper holds the link itself. On `/pdf/<slug>` the first
  Tab presses walked the wrappers before the page's own controls, skip links
  included (21 on the CV, 2,184 on the PhD thesis), and in a dialog that
  cycles through its controls every link would be two stops (48 instead of
  27 on the CV). The viewer now resets the wrappers to -1, names web and
  mail links by their address (`pdf-links.ts`), and names the 3,400 links
  within the site's PDFs by the text printed under them
  (`pdf-link-names.ts`). It watches with a
  MutationObserver: pdf.js appends each wrapper after an await, so none is
  in place when react-pdf reports the layer rendered. A `setTimeout(0)` from
  that callback would see them today, as those awaits are microtasks, but
  the observer relies on neither, and catches the layers every zoom
  rebuilds. `useModalDialog` still leaves positive tabindex out, as a guard.
- **The text under a PDF link is in the page's text content, not the DOM.**
  pdf.js merges a printed line into one text item, so joining the items a
  link overlaps gave the right text for 16% of links. Each item is split
  into characters, the item's width shared out by each character's width in
  the PDF core font of the item's family (Times-Roman, Helvetica or Courier,
  from the metrics pdf.js ships: `pdf-font-widths.ts`, which
  `scripts/pdf-font-widths.mjs` writes), and a character belongs to the link
  when its centre is inside the link's rectangle; words are kept whole.
  Against the same centre test on PyMuPDF's glyph boxes (link rectangles
  derotated), run in node over all 28 PDFs with pdf.js's own text content
  (2026-10-14), that text is exact for 3,313 of the 3,400 links (97.4%), and
  98.9% of names read as printed. The widths were a canvas's until then, in
  the generic families pdf.js names, which each system resolves to fonts of
  its own: on Linux, Firefox and WebKit read "Section" where the page prints
  "Section 4.2". macOS's Times, Helvetica and Courier carry Adobe's metrics,
  so not one name changed there. Where the widths put a neighbouring word
  under a link ("4.7 discusses", "Sybil[44", "traces" for a chapter's "7"),
  the word is dropped, and a chapter, appendix, equation, theorem,
  proposition or definition link with no number read takes its target's:
  those targets' numbers matched the printed ones on every link of the 28
  PDFs. A bare number gets a type word from the target ("cite." gives
  "Reference 5") or from the label printed before it ("Ch. 4"), or, for a
  year, its author's name ("Markram et al, 2004", also when the citation
  wraps between the two links): 97.9% of them. The names come from
  react-pdf's `onGetAnnotationsSuccess` and `onGetTextSuccess`, which arrive
  in either order, carry no page number, and fire again for every page on
  each zoom, so each page is named once per document; with fallback fonts
  the text layer is off and the page's text is fetched on its own. Cost in
  node: 34 to 37 ms warm for all 474 pages with internal links, about 60 ms
  cold; one page takes at most 0.6 ms warm, and the first page 3 ms cold.
  The PDF's own description (`/Contents`) wins when there is one. The
  target's suffix is never checked against a printed number, nor used for
  sections, figures, tables or algorithms: arXiv's and IEEE's anchors
  (`section.42` printed "4", `table.1` printed "I") would have stripped 110
  correct numbers and caught none.
- **An observer on the whole document sees every text span.**
  SVGProtectionWrapper watched `document.documentElement` with `subtree`
  for circles added anywhere, and the PDF reader adds 53,486 text-layer
  spans for the thesis: its callback ran about 13,700 times for 145,059
  records, 37 to 44 ms per load and zoom, and it scanned every circle on
  the page every 5 s, idle or not. It guarded against a radius no current
  code produces, after the head script's `setAttribute` guard had already
  fixed it. Retired (2026-10-11): in Chromium on `/pdf/phd-thesis`, 5 runs
  a side, the median script time fell from 361 to 333 ms on load and from
  266 to 242 ms on a zoom. Watch the smallest subtree that can change; the
  reader's own link watcher reads only additions to an annotation layer
  (13.8 ms for the same records).
- **will-change on an ancestor moves every fixed element.** On a hovered
  or pressed element, `:hover` and `:active` also hold for every ancestor
  up to `html`, and `will-change: transform` on `body` makes it the
  containing block of every fixed element: in WebKit the navigation's top
  read -2000 after a 2,000 px scroll, instead of 0. globals.css's Safari
  block had a rule giving exactly that back on `:hover`, `:focus` and
  `:active`; it never applied, as the block's `will-change: auto` rule
  outweighs it (0,2,1 against 0,2,0), and it is gone. The same block stops
  Tailwind's spinners in Safari, which is why the PDF reader also says in
  words that it is loading.
- **A route handler can outlive its test.** One that reads a fetched
  response while the test closes its context fails the test with "Response
  has been disposed" (`close()` disposes the responses first, and the
  handler's rejection reaches the worker as an unhandled one, even in the
  fixture's teardown); under a parallel run it did. Call
  `context.unrouteAll({ behavior: "ignoreErrors" })` before closing
  (`closeContext` in static-shell and motion-fallback); `page.unrouteAll`
  for routes on a page.
- **A PDF's text layer answers `getByText`.** On `/pdf/phd-thesis`,
  `getByText(/^\d+%$/)` found the zoom label alone right after the first
  page drew, and 170 elements five seconds later, once the pages' text had
  loaded.
- **A class name built at runtime is not in the CSS.** Tailwind keeps a
  class from an `@layer` only when it sees it written out. `animated.tsx`
  built its classes at runtime (`animate-${name}`, `animation-delay-${ms}`),
  so only those another file spelled out shipped: no `delay` but 200 ms did
  anything, the slides in from the left and right never moved, and
  globals.css's `opacity: 1 !important` hid every fade. Romain chose to keep
  that look (2026-10-11): the 19 wrappers that did nothing are plain `div`s,
  the 24 delays are gone, and `animated.tsx` writes out the two classes it
  still adds, which `animated.test.tsx` checks.
- **A stylesheet import can drag a chunk in.** `Terminal.tsx` imports
  `@xterm/xterm/css/xterm.css`, and the `terminal` cache group collects every
  `@xterm` module, so mounting the terminal component downloaded all of xterm.
- **Placeholders must have the final size.** Both the hero's brain and the
  canvas inside it loaded behind square placeholders up to 512 px tall for a
  300 px result.
- **xterm 5.5.0 leaks its DPR monitor** (a window resize listener holding the
  whole disposed terminal); the terminal releases it by hand on close.
- **lint-staged formats JSON.** Minified data needs a `.prettierignore` entry.
- **A hidden element still widens the page.** `opacity: 0` and
  `visibility: hidden` keep their box: a hover tooltip 14 px past a
  390 px phone screen made the page pan sideways, and Chrome and WebKit
  then size fixed elements (the navigation, the site grid) to the wider
  page. Check with `scrollWidth` against
  `document.documentElement.clientWidth`; `window.innerWidth` grows with the
  overflow, so a check against it never fails.
- **No resize event when a phone's layout viewport shrinks back.** While the
  page loads, Chrome's emulated phone went from 394 × 853 to 390 × 844 with
  no resize event. Anything measured on resize keeps the larger size; watch
  the element's own box with a ResizeObserver.
- **A forced recalculation in a scroll handler is not always extra work.**
  A trace of the scripted scroll put 157-171 ms in the scroll handlers,
  nearly all of it style recalculation forced by reading `window.scrollY`
  and `offsetTop`. Rebuilt on IntersectionObservers, the handlers dropped to
  3 ms, but the scroll's total style recalculation (129-148 ms) and layout
  stayed where they were, and so did the frames over 20 ms over 4
  interleaved rounds: the frame recalculates once either way, and the
  handler only made it happen earlier. Compare totals before rewriting.
  (Tried and reverted on 2026-10-08.)
- **A component loaded with `ssr: false` is not in the HTML,** whatever it
  renders before mount: the splash's own pre-mount backdrop never reached
  the generated page, and its tests, which rendered the component on its
  own, passed. Test what the server renders through its parent
  (`renderToString` of the app wrapper), or fetch the built page.
- **Render-time reads of storage were already mismatches.** The quality
  tier, the animation choice and the auto-disable were read from storage
  while rendering, where the server could not: a stored LOW tier rendered
  differently from the HTML even before the page was static. Start from the
  server's value and restore in a (layout) effect.
- **Bursty content makes single snapshots noisy.** The spike schedulers fire
  in bursts, so the SMIL count and a 2 s frame window depend on whether a
  burst is in flight at that moment. Compare main-thread share, or average
  over a minute.
- **A changed file under an immutable URL never reaches a returning
  visitor.** `/images`, `/animations` and `/pyodide` are served
  `max-age=31536000, immutable`, so the browser keeps its copy for a year
  without asking. Give changed content a new URL: the splash data is
  `*.v2.json` since it was minified, and the resized conference logos carry
  `?v=2` from `LOGO_VERSIONS` in `conference-logos.ts`.
- **A listener added after its event never fires.** The service worker was
  registered on the window "load" event, from an effect: on the static
  homepage hydration ends after "load" (118 ms against 150 ms in Chromium),
  so it never registered, throttled or not, and nothing said so (the
  site's error logging is silent in production). Check
  `document.readyState` before waiting for "load". The worker only
  repeated the HTTP cache for `/images`, `/fonts` and `/animations`, so it
  is retired instead: the page removes it and its `claret-tech-*` caches
  (`service-worker-cleanup.tsx`), and `public/sw.js` removes itself from a
  browser that still runs an older one.
- **framer-motion ignores reduced motion unless told.** Its
  `reducedMotion` defaults to "never": a visitor who asked for less
  motion still got every slide, scale and spring a component did not
  check for itself, and the dashboard sprang in from 0.9 under the
  reduced-motion terminal spec. `MotionProvider` sets
  `<MotionConfig reducedMotion="user">` (2026-10-14): framer then jumps x,
  y, scale, rotate, size and position, and still fades opacity and
  colour. Context passes through portals, so the dialogs follow it. In
  unit tests framer reads the system's setting once per process, and Node,
  not vitest's per-file isolation, holds framer's modules: in the shared
  fork an earlier file's render had already read "no preference", so a
  test that mocked `matchMedia` to "reduce" passed alone and failed in its
  batch. Test the config the provider hands framer instead.
- **A backdrop filter ran Linux WebKit out of memory.** With Playwright
  1.64, WebKit on Linux grew the homepage's page process by 250 to 470 MB
  a second until it was killed ("Page crashed": 12 of 12 terminal tests
  in a container), on arm64 and x64, Ubuntu 22.04 and 24.04 alike. 1.57's
  WebKit, CI's until then, levels off at about 840 MB on the same build.
  The cause was 24 elements with `backdrop-filter: blur(4px)`, the
  education cards' skill chips: a bare page of 24 such chips grows the
  same way, static or animated, and bare pages without the filter stay
  flat. They blurred the card's own near-opaque background, which no one
  could see (33 of 207,480 pixels changed, by 3/255 at most, in Chromium;
  none in WebKit), so they went (2026-10-14), and the homepage stays at
  800 to 870 MB. It then still drew at 1 frame a second (1.57: 42;
  Chromium: 60), and the cost grows with the page's backdrop filters:
  turning off any large group brought the frames back. The 21
  certification badges' blur showed nothing either (a 3% tint over a plain
  background: 45 of 132,804 pixels, by 13/255 at most, in Chromium; none
  in WebKit), and without it the homepage draws at 42 fps; the Linux
  WebKit specs went from 19 failures to 2, both older (the terminal's help
  test, which read only the screen at 1 fps, passes). The contact cards
  and the navigation keep their visible blur; any new backdrop filter is
  a suspect. How it was found: hide parts of the page from the first
  paint (`display: none` from an init script) and halve. For the memory,
  count the runs whose page process passes 3 GB within 40 s (5 a variant,
  a fresh browser each: WebKit keeps a closed page's process a while,
  which muddles the reading; removing parts mid-leak misled, as the
  growth starts and stops on its own). For the frames, count
  `requestAnimationFrame` callbacks over 3 s, one run a variant.
- **react-pdf's reload replaces the canvases.** New `options` (the
  fallback fonts) start a second `getDocument` and keep the old document
  until it resolves; then each `Page` resets and remounts its canvas, so
  a test that watches a page's canvas sees it leave the document, not
  hide and show again.
- **A wait on the whole screen passes on the echo.** The Python spec's
  `run()` polled the whole terminal for its pattern, so a pattern found in
  the command itself, or on an earlier line, passed at once: four "still
  responsive" checks after an interrupt or an exit checked nothing, and
  "Ctrl+C stops a runaway one-shot run" waited for "spam", which its own
  command holds, so its Ctrl+C could land while Python was still starting
  (2 of 15 runs failed). Wait on what follows the command's echo (`below()`
  in `python-terminal.spec.ts`), or on a line of its own.
- **A cancelled command kept painting.** On Ctrl+C the terminal draws
  "Command canceled by user" and a new prompt, and ignored the command's
  result, but not its writer. A `python -c` cancelled while the
  interpreter's code loaded went on to print "Downloading CPython..." and
  its program's output after that prompt (the command listened for Ctrl+C
  only once that code had loaded); a `python` REPL cancelled while CPython
  downloaded erased the "^C" lines (its boot line's cursor restore) and
  took the terminal over. The terminal now drops a cancelled command's
  output, and the command checks the abort after every await and races
  each boot against it: the client leaves an interrupted boot pending, by
  design, so the command would otherwise wait forever.
- **"Shown, then gone" assumes a splash that shows.** Five setups waited
  for the splash's progress bar to show, then to go. When the 4 s timer
  uncovers the page first, the splash skips itself, so on a slow load they
  timed out on a page that was up (5 of 6 Linux WebKit runs of one setup).
  `waitForSplashToEnd` (`tests/e2e/utils/splash.ts`) waits for the
  backdrop, which only the running app removes, then for the progress bar.
- **Under reduced motion every element transitions.** `globals.css` cuts
  transitions to 0.01 ms, and `transition-property` defaults to `all`, so
  every element transitions every change, inherited ones too. Linux
  WebKit's clock stands still between frames, and a transition that a style
  read starts shows its first frame until the next one: axe read the
  monitor's Timeline badge gray-400 on its tab's new blue-800 (3.43:1), in
  every run. A test about colours at rest turns transitions off.
- **Firefox crashed when axe opened its blank page.** By default
  `@axe-core/playwright` opens a blank page for each scan (its
  `finishRun`) and closes it. In CI's Firefox, then held to one content
  process (`dom.ipc.processCount: 1` and `browser.tabs.remote.autostart:
false`, since removed: below), the key press after that crashed the page's
  process (signal 11): 10 of 10 runs, as the monitor's views were scanned
  one after another. In legacy mode (`.setLegacyMode()`: axe runs in the
  page and opens nothing), 0 of 20; with the default processes, 0 of 10.
  The tools' scans run in legacy mode, which leaves out only cross-origin
  frames, and Firefox scans every view again.
- **xterm repaints on its next frame.** `fullScreen()` read the scrollback
  a fixed 120 ms after each Shift+PageUp and stopped after two unchanged
  screens; a slow renderer had not repainted yet, and the help and about
  tests missed their first lines (3 of 30 Linux WebKit runs). It now waits
  for the change, up to 1.5 s a press.
- **Changing a backdrop filter under a hovered element crashes Linux
  WebKit.** High contrast mode set `backdrop-filter: none` on every
  element, and the click that turns it on leaves the pointer on the
  toggle: Playwright 1.64's Linux WebKit then crashed the page. Measured
  with that click, the page scrolled: taking the filter off, 10 of 10 runs;
  a 2 px radius, 10 of 10; a zero radius, 60 of 60, with reduced motion or
  without. Colour changes never crashed it. High contrast leaves every
  filter alone and makes the blurred panels opaque instead
  (`[class*="backdrop-blur"]`, in the page's colour; the dark ones keep
  theirs): 0 of 60.
- **Time a CSS fallback from its own clock.** "shows 6 s after the first
  paint when the bundle never runs" checked 4.5 and 6.5 s after the
  navigation, assuming a first paint within 0.5 s; under emulation it came
  later and the content was still hidden at 6.5 s. The fallback
  animations' start times (`document.getAnimations()`, on
  `performance.now()`'s clock) say when its 6 s began, and need no app
  script.
- **High contrast's colours were RGB read as HSL.** The theme reads
  `hsl(var(--token))`, and `high-contrast.css` set triples such as
  `255 255 255`. Chromium and WebKit painted light high contrast yellow,
  rgb(255, 255, 0), while Firefox clamped it to white; dark high contrast
  had ochre and brown accents everywhere. The high-contrast scan had axe's
  contrast rule off, so nothing saw it. A test now reads every token
  through the same `hsl()` and expects greys, and scans the whole page in
  both themes.
- **`prefers-contrast: high` matches nothing.** The value is `more`. No
  engine matched `high`, even with more contrast asked for.
- **Playwright's Firefox drops colour scheme and contrast emulation under
  COOP.** On a page sent with `Cross-Origin-Opener-Policy: same-origin`,
  as every page here is, `matchMedia` answers no preference for
  `colorScheme` and `contrast` (1.64). A bare server lost both with that
  one header and kept them without it. `reducedMotion` holds either way.
  Fixed upstream for 1.65 (microsoft/playwright#43287); two static-shell
  tests skip Firefox until that bump.
- **A check once a frame misses what goes before the first frame.**
  static-shell's watcher looked for the splash's backdrop on each
  animation frame. In Linux WebKit the backdrop was sometimes gone before
  the first one, and the test read `undefined` (30 of 80 runs). A
  MutationObserver from the document's start sees insertions and removals
  as they happen: 0 of 80.
- **A bound on the clock stood in for an order.** "skips the splash when
  the 4 s timer showed the page" asserted that the backdrop went within
  6 s of the navigation, meaning "before the stylesheet's fallback", which
  counts its 6 s from the first paint. The app removes the backdrop only
  after that animation ends, so its `animationend` tells which came first,
  on no clock. With an 8x slower CPU the fallback did come first, and the
  test now says so.
- **Without scripts the load event waits for every image.**
  `loading="lazy"` needs scripting (HTML spec), so a no-script page loads
  all 13 of the homepage's images, and `page.goto` waits for them.
  No-script tests wait for the HTML and its stylesheets instead
  (`tests/e2e/utils/no-script.ts`).
- **Next's image optimizer can hang an image for the server's lifetime.**
  It reads a local image through a mocked request on the client's own
  socket (`fetchInternalImage`). When the client drops the request, the
  read never ends, and every later request for that image in that format
  waits on it (Next 15.5.22, `next start`). One dropped request per
  uncached image, 0 to 30 ms in, left 85 of 160 AVIF images hanging, while
  their WebP twins (another cache key) and the stylesheet answered in
  under 10 ms. Self-hosted servers have it, CI's among them. On Vercel,
  `/_next/image` is served by Vercel's image service rather than this
  code (to confirm at the Vercel check). Fixed in Next 16.4.0
  (vercel/next.js#98168), never in 15.5; the site runs 16.4.1 since
  2026-10-15 (0 of 320 keys hung). Lighthouse against a 15.5 server that
  had had such requests timed out waiting for network idle, twice.
- **A phone's first second was 4 px too wide, and not because of the
  font.** Sampled every frame, a Pixel 5 page was 397 px wide from its
  first frame to 0.6 s in Chromium and to 1.9 s in WebKit, with the web
  fonts loaded or blocked alike (round 11 suspected the font). The cause:
  the Contact section's avatar column enters from `x: 20`. On a phone it
  is as wide as the screen inside 16 px of padding, and the server's HTML
  paints its starting state until the bundle runs and the entrance ends;
  without the bundle, for good. The fixed layers only stretched to the
  wider page. The section clips sideways now (`overflow-x-clip`, not
  `hidden`, so no scroll container), and static-shell's "fits a phone's
  screen before the bundle runs" holds the page without its bundle. The
  `<noscript>` style already resets these starting states when scripts
  are off, which is why a no-script page never showed it.
- **The config starts a dev server when port 3000 is empty.**
  `playwright.config.ts` checks `localhost:3000` whatever
  `PLAYWRIGHT_BASE_URL` says, so a run against a build on another port
  also starts `npm run dev` in the checkout, which rewrites its `.next`
  as a development build. Fixed: no `webServer` when `PLAYWRIGHT_BASE_URL`
  is set (`src/app/playwright-config.test.ts`).

- **`toHaveBeenCalledWith(new CustomEvent(x))` matches any CustomEvent**,
  whatever its type or detail: equality on two events compares no fields
  that differ. Eight assertions on the terminal's events passed with every
  expected name replaced by a wrong one, and one expected an event the
  command never sent. Read the type: `sent()` in `commands.test.ts`.
- **Vitest's `mockReset: true` empties `vi.fn().mockImplementation(...)`
  before each test**; `vi.fn(impl)` keeps its body. `setup.ts`'s
  ResizeObserver stand-in, written the first way, returned `undefined` in
  every test, and a component's `new ResizeObserver(...).observe` threw.
- **`pkill -f pattern` matches the shell that runs it** when the pattern is
  on that shell's command line: `bash -c "pkill -f 'next start'; npm run
build"` killed itself before building. Put the commands in a script
  file (`r11/rebuild.sh`).
- **A hand-rolled Tab cycle must leave out tabindex -1.** `useModalDialog`
  moves Tab itself (WebKit's own Tab skips links), and kept every button:
  in a roving tabindex, as on the research map, Tab walked every item.
  From an element Tab skips, such as a heading given focus to announce it,
  Tab must go on from there, not back to the dialog's first control.
- **Stacked dialogs each listened on document.** With the reader over the
  research map, the lower dialog pulled each Tab into itself and the
  reader pulled it back, so Tab never left the reader's first control, and
  an Escape from the page closed both. Only the dialog on top answers keys
  now (a module-level stack in `useModalDialog`).
- **CI's single-process Firefox bought nothing.** `dom.ipc.processCount: 1`
  and `browser.tabs.remote.autostart: false`, added unmeasured as
  stability settings, made axe crash the tab (10 of 10). CI's Firefox
  suites without them, alternating three runs each: 45 of 45 passed every
  time, median 120 s against 118 s. Removed.
- **The homepage did not reflow at 320 px** (WCAG 1.4.10), with scripts
  or without: 19 px too wide in Chromium, 18 in WebKit. Four no-wrap rows
  or columns: research cards' footer row (300 px), the footer's seven
  icons (340 px), the Papers filter pills and stats rows (332 px with
  padding), and Education's two-column skills grid of no-wrap pills
  ("Software Engineering", 175 px; "JAX/TensorFlow" has no break) in a
  column left 176 px. Fixed in round 13: the rows wrap, and under 400 px
  Education hides its rail (Romain's choice) while its skills are tags that
  wrap on every phone. No overflow from 320 to 414 px, scripts on or off;
  mobile-accessibility.spec.ts goes through the whole page at 320 px.
- **The unit tests ran a React the site never ran.** The App Router ships
  Next's own React build (the homepage's framework chunk said
  19.3.0-canary), and the installed react-dom 18.3.1 reached only the
  pages-router fallback chunk, which `/` never loads. So 2,347 tests ran
  React 18 for a site on 19. `src/app/react-version.test.ts` now holds the
  installed major to Next's.
- **A colour table keyed by file name missed the format the site loads.**
  `scripts/extract-colors-simple.js` named `unine_logo.jpg`; the site loads
  `unine_logo.webp`, which got the default grey, and a table hit stops the
  runtime extraction. Every Experience, Education and Other Work card was
  grey from the first commit. Keyed by base name now, with a coverage test.
- **A hex alpha after `rgb()` is not a colour.** `${color}20` with
  `color = "rgb(0, 102, 255)"` gives `rgb(0, 102, 255)20`; browsers drop
  the declaration without a word, and so does jsdom (`style.x === ""`).
  Nine tints and glows never rendered; they are deleted. Short hex fails
  the same way: `#333` + `30` is `#33330`.
- **A test file's saved stand-in can be the reset-prone one.** Six test
  files keep the IntersectionObserver they find at load to restore it in
  afterEach: setup.ts's load-time one, written as
  `vi.fn().mockImplementation()`, which mockReset empties (its beforeEach
  installs a good one later). On React 19 the PDF reader's pending
  observer effect ran while unmounting, after that restore, and threw.
- **axe passes what it cannot judge.** In the Experience section it rated
  46 texts "incomplete" (background gradient), 2 passed, none failed, with
  the raw brand colours (Libacy 2.15:1 on white) as with the fixed ones.
  The colour arithmetic lives in `src/app/accent-text.test.ts`.
- **A route handler on Node.js is dynamic unless it says `force-static`**,
  and the Edge renderer drew the og-image differently: it ignored the
  background pattern's `fill-opacity`, so the shipped preview has solid
  white marks; on Node.js the opacity applies, hence `fill-opacity='1'`.
- **A local build without `SERVE_HTTP=true` cannot be tested in WebKit
  over http.** Production's CSP has `upgrade-insecure-requests`; Chromium
  ignores it for localhost, WebKit upgrades every subresource to https and
  gets none: an unstyled page whose splash never ends. CI and the container
  harness build with it; a hand-made host build must too.
- **Lint passed with a warning for months.** `npm run lint` runs with
  `--max-warnings 0` now, so CI fails on the next one.
- **Keywords matched as substrings misfile.** The Papers area guess read
  "revolution" and "evolutionary paths" as neuroevolution (the Blockchain
  paper) and an "ai" inside a word as machine learning (the vestibular
  poster). `src/lib/utils/research-area.ts` matches whole words, with
  HyperNEAT and NEAT as neuroevolution's own.

Round 14 (2026-10-15/16):

- **`--write` beats `--check`.** CI's format check ran
  `prettier --write ... --check`, and Prettier sets no failing exit code
  while `--write` is on: the check rewrote CI's copy and passed. It runs
  `format:check` (`--check` alone) now, and `ci-workflows.test.ts` fails on
  a `--write` in CI.
- **Hand-kept lists drift.** Seven test files ran in no CI job, and a spec
  only runs once a Playwright job names it. `ci-test-lists.test.ts` and
  `ci-workflows.test.ts` read the workflows and fail on what no job runs.
- **A change under `scripts/` skipped the build**, which runs it
  (`prebuild`, `postinstall`, `next.config`'s plugin): no path filter named
  the folder.
- **There is no Vercel check.** `vercel.json` turns the Git integration
  off: production deploys only through the "Deploy to Vercel" workflow,
  which runs CI first.
- **The splash hides the window before hydration.** A colour or icon that
  depends on the theme's state in JavaScript is wrong until hydration, and
  the splash's backdrop covers that window (0.5 s locally, 3.6 s on Fast 3G
  with a 4x slower CPU). It shows only on a load slower than the backdrop's
  6 s fallback, a failed bundle, or a page without the splash (`/pdf/*`).
  Let CSS choose from the class the head script sets.
- **`useSyncExternalStore` keeps hydration identical.** The server snapshot
  renders during hydration, and the client's applies in a synchronous
  re-render right after. It merges that re-render into the effects' task,
  where an effect's `setState` ran as a task of its own; at ten runs per
  side, S7's blocking time did not move (round 14 results).
- **ESLint 8 could not see what React 19's compiler rules catch.** With
  eslint-config-next 15 it knew neither effect events (`useEffectEvent`)
  nor the compiler's rules. ESLint 9 with config 16 found 84 sites: state
  copied by effects, refs read during render, clock reads in render.
- **web-vitals 5's `on*` return nothing.** Their return values kept as
  cleanups made an empty list: observers stacked on each toggle. Subscribe
  once per page.
- **Next 16 records a proxy elsewhere.** `proxy.ts` (or a Node.js
  middleware) is in `functions-config-manifest.json` under `/_middleware`;
  `middleware-manifest.json` stays empty.
- **Browserslist's defaults follow usage data.** An `npm audit fix` updated
  caniuse-lite, Safari 17 left the defaults, and autoprefixer dropped
  `-webkit-backdrop-filter`. `package.json` names the targets now (Next's
  own, and iOS 16.4).
- **Four runs per side cannot call a 10% change.** Two regressions at four
  runs vanished at ten. Interleave, then add rounds before bisecting.

Round 15 (2026-10-17):

- **The webpack cache keeps third-party CSS built for old targets.** After
  round 14 pinned the browser targets, local builds still served xterm's and
  pdf.js's stylesheets as `.next/cache` held them from before: prefixes the
  targets no longer need, and no `-webkit-backdrop-filter` for Safari 16.4
  in pdf.js's forced-colors rule. Our own CSS was current. CI and the deploy
  build without a cache, so they never shipped it. Fixed in round 16:
  next.config.mjs adds `package.json` and `postcss.config.js` to the
  cache's `buildDependencies`.
- **ESLint 10 runs three plugins outside their peer range.**
  eslint-config-next wraps react and import for the context methods ESLint
  10 removed; jsx-a11y needs none. npm warns, and `npm ls` calls the pair
  invalid. A rule that loads but stops reporting would pass lint without a
  word: `lint-rules.test.ts` plants a violation for each plugin.
- **An env var nothing reads passes every check.** deploy.yml passed
  `MEDIUM_USERNAME` and the code read `NEXT_PUBLIC_MEDIUM_USERNAME`, so the
  secret never reached the site, and six CI mocks of it changed nothing.
  `ci-workflows.test.ts` now fails on a workflow env var that no code, test,
  config, shell script, step or tool reads.
- **Names follow the same rule as colours.** An `aria-label` from React's
  state is wrong until hydration, as the icon was: the theme toggle told
  dark visitors "current: light". Hold both names in `sr-only` spans and
  let the class on `<html>` hide one: a hidden span is left out of the
  accessible name. A description inside the button must then be `hidden`
  too (`aria-describedby` still reads it), or it joins the name.
- **Search upstream before drafting a report.** Both reports drafted in
  round 12 were filed by others and fixed by the time they were ready
  (microsoft/playwright#43287, #43426). `gh search issues` with several
  words found neither; `gh api search/issues -f q='repo:… is:issue …'` did.
- **A lockfile from another npm can fail `npm ci`.** ESLint 10's lockfile,
  written by npm 11.6.2 (Node 25 on the Mac), left out the required peers
  of an optional dependency (`@napi-rs/wasm-runtime`'s `@emnapi/core` and
  `@emnapi/runtime`), and npm 11.19 (Node 24.21, as in CI) refused it as
  out of sync. Since round 16 the Mac has Node 24 from nvm (`.nvmrc`;
  `nvm use` in the repo gives CI's npm); still run `npm ci` in the
  container before trusting a lockfile.
- **macOS `tar` adds `._` files.** An archive of the working tree made with
  macOS `tar` carries AppleDouble `._*` files for extended attributes.
  ESLint lints dotfiles and failed on each with "Invalid character", while
  tsc and Next skip them. Archive with `git archive`.
- **Search the specs for selectors on an attribute before removing it.**
  The toggles' `aria-label`s went, and a terminal test still found the
  toggle by `button[aria-label*="theme" i]`. A search for the old names
  missed it; the e2e gate caught it.

Round 16 (2026-10-17):

- **A name match is not a use.** Round 15's sweep for dead test helpers
  matched names, so a same-named local (`mockApiCache` in three route
  tests), a commented-out import and a same-named type elsewhere all
  counted as uses, and five dead helpers stayed. knip follows imports:
  it found those, 5 e2e helper files nothing imported since the first
  commit (825 lines) and 25 more dead exports and re-exports. It runs in
  CI's quick checks now (`knip.jsonc` explains each setting).
- **knip cannot see a namespace object passed along.**
  `const [webllm] = await Promise.all([import("@/lib/webllm")])` then
  `webllm.webLLMClient` read as unused, and deleting it would have broken
  the terminal's AI commands. Destructure where you import
  (`const [{ webLLMClient }] = ...`): knip traces that. type-check is the
  backstop: a deleted export that is still read fails to compile.
- **Linting the tests found what the dead-code pass left.** With tests in
  lint, the helper whose only export went still imported `vi`. The test
  rules turn off `no-explicit-any`, `react-hooks/globals` and
  `no-img-element`, and every disable comment for them then counts as an
  unused directive: 25 went with that change. `eslint --fix` removes such
  a comment's text but leaves its blank line.
- **The Mac ran an unsupported Node.** Homebrew's Node 25.2.1 (end of life
  2026-06-01) with npm 11.6.2, while CI and the deploy run Node 24 and npm
  11.19: the source of round 15's broken lockfile. nvm (its default is
  16.20.2) has Node 24.22.0 for `.nvmrc`, and `ci-workflows.test.ts` holds
  the file to the same major as CI. But the Mac's shell never loads nvm
  (round 17), so its terminals stayed on Node 25.
- **Previews built without production's env.** The preview job passed
  `vercel build` none of it (no GitHub token, no `USE_GITHUB_DATA`, no
  Medium account). One env block now serves both, through a YAML anchor
  (GitHub reads anchors since 2025-09-18; actionlint 1.7.12 accepts it).
  actionlint's only other findings were 12 info-level shellcheck notes
  (unquoted variables, SC2086) in three workflows, quoted in round 17.

Round 17 (2026-10-17):

- **`.nvmrc` does nothing where nvm is not loaded.** Neither `~/.zshrc`
  nor `~/.zprofile` sources nvm, so `nvm use` did not exist in the Mac's
  terminals. The Mac's own Node is Homebrew's `node@24` now (24.22.0, npm
  11.19.1, as CI), so lockfiles come from CI's npm by default.
- **Homebrew 7.0.9 fails to install `node@24` on its own lock** ("A brew
  install node@24 process has already locked
  /opt/homebrew/Cellar/openssl@3") while pouring the new `openssl@4`
  dependency: Homebrew/brew#24204, fixed by #24207 on 2026-10-10, 35
  commits after 7.0.9, the latest release. Installing `openssl@4` on its
  own first, then `node@24`, works. That install also upgraded six shared
  libraries `node@24` needs (simdjson 4 to 5 among them), after which the
  unlinked Node 25 keg cannot start (`libsimdjson.29.dylib` is gone from
  `opt/simdjson`): `brew upgrade node` (26) or `brew uninstall node`.
- **Chain a destructive step after a fallible one with `&&`.**
  `brew install node@24; brew unlink node` unlinked Node 25 although the
  install had failed, and the Mac had no `node` until it was relinked a
  few seconds later.
- **`brew uninstall` removes more than you name.** Its autoremove also
  uninstalled `hdrhistogram_c`, as no installed formula needed it. Set
  `HOMEBREW_NO_AUTOREMOVE=1` to remove only what you name.
- **actionlint checks the workflows in CI** (`npm run lint:workflows`, from
  its Docker image pinned by digest): syntax, expressions, job references,
  and shellcheck on every run step. It needs the repository mounted, not
  only `.github`, to find the workflows itself.

Round 19 (2026-10-17):

- **npm audit counts code that never runs.** None of the 46 advisories at
  the start of the round reached production code. The critical ones were
  Vitest 3's (tinypool), gone with Vitest 4. colorthief 2's nested sharp
  0.33.5 never ran: the browser build reads pixels from a canvas, and the
  server bundle never calls the library. Sort each advisory into runtime,
  build or dev only before acting on it. After colorthief 3: 38, none
  critical.
- **Vitest 4 refuses `new` on an arrow mock.** `vi.fn(() => ({ ... }))`
  standing in for a class (IntersectionObserver, Worker,
  PerformanceObserver, NextRequest) throws "is not a constructor"; write
  `vi.fn(function () { return { ... }; })`. A hook's try/catch swallowed
  one such TypeError, so its test failed far from the cause.
  `docs/TESTING_INFRASTRUCTURE.md` lists the other changes.
- **Lighthouse never read the budgets.** `lighthouse.config.js`'s
  `settings.budgets` (resource counts, sizes, timings) came with the first
  commit, on Lighthouse 12, which had removed budgets: neither 12.8.2 nor
  13.5.0 has a line that reads them. The spec's budget check read
  `resource-summary`, an informative audit, and Lighthouse scores every
  informative audit 1, so the check could not fail (the homepage loads 22
  scripts against a budget of 20). Both are gone; the limits now come from
  measurements (`docs/TESTING_INFRASTRUCTURE.md`).
- **Lighthouse 13 rejects a category it does not know.**
  playwright-lighthouse passes the thresholds' keys as `onlyCategories`;
  12 ignored the `pwa` key (it had removed the category) and 13 throws
  "unrecognized category in 'onlyCategories': pwa". An unknown id in
  `skipAudits` is still ignored without a word: `uses-http2` is
  `modern-http-insight` in 13.
- **A newer axe finds what the old one passed.** Lighthouse 13 brings
  axe-core 4.14 (`^4.13`), which failed `target-size` on the skill
  carousel's 6 px dots; axe-core 4.10 (Lighthouse 12, `@axe-core/playwright`
  4.10) passed them, and the e2e scans did not ask for `wcag22aa`. They run
  4.14 with it now, and the carousel has 24 px controls.
- **axe's "incomplete" hid a link told apart by color alone.** The footer's
  "Hosted on Vercel" link (1.35:1 against the text around it, underlined
  only on hover) is `incomplete` at 1280 by 900 and a `serious` violation
  at 412 by 823. The homepage scans ran at the desktop size and allowed
  five serious violations; they allow none now, and one runs at 412 px.
- **colorthief 3's sync API defaults to OKLCH.** Its type says
  `@default 'rgb'`, its `validateOptions` says `oklch`. Pass
  `colorSpace: "rgb"`, or the colors change (all 54 compared did).
- **A port in use answers for someone else.** The comparison page's server
  could not bind 8766, held by another session's process, and Playwright
  loaded that server's 404 for two minutes. Ask the OS for a free port
  (`server.listen(0)`) and read it back.
- **A component rendered twice cannot use a fixed id.** The navigation
  renders the high contrast toggle in the desktop bar and in the phone
  menu, so its `id="high-contrast-desc"` was on every page twice. `useId`
  gives each copy its own.
- **Tailwind 4's codemod breaks what it cannot see.** `@tailwindcss/upgrade`
  4.3.3 moved the theme into `@theme`, whose variables resolve on `:root`:
  `--font-sans` reads next/font's `--font-montserrat`, set on `<body>`, so
  the whole site lost Montserrat until `@theme inline`. It also dropped the
  typography plugin (`@plugin` brings it back), removed autoprefixer
  although xterm's and react-pdf's stylesheets need it, and renamed ten
  strings that only looked like classes: a button variant (`"outline"`),
  next/image's `placeholder="blur"`, a `data-shape="ring"`, an effect name
  (`includes("blur")`, which would never have matched again), test names
  and comments. Review every renamed string that is not a class.
- **Tailwind 4 puts your CSS in cascade layers.** The codemod moved the
  unlayered rules and the imported stylesheets into `layer(utilities)`.
  Order inside a layer is source order, as before, but an `!important`
  declaration now ranks by layer (an earlier layer's wins), and an
  unlayered rule beats every layered one. 108 `!important`s live in these
  stylesheets; the e2e suites found no change, but a rule added outside a
  layer later will win over all of them.
- **axe 4.14 checks that a link's name contains its text.** The accepted
  arXiv line showed "accepted version" and was named "Authors' accepted
  manuscript on arXiv, ..." (WCAG 2.5.3): a speech user saying what they
  see would not reach it. A custom name starts with the visible label.
- **Measure copy in a fixed grid before changing it.** "More on Medium" in
  the blog cards' three equal columns wrapped to two lines at every width
  from 360 to 1280 px and stretched every card's action row from 34 to
  50 px; "Medium" fits.
- **A browserslist floor can be a statement only.** Raising Firefox
  from 111 to 128 changed no byte of the build (autoprefixer adds nothing for 111 to 127,
  and the JavaScript compiles the same): the floor records what Tailwind
  4's CSS was written for.

Round 20 (2026-10-18):

- **CI recorded four scores and nothing else.** playwright-lighthouse prints
  the category scores; the spec's metric logs were commented out and its
  JSON went to `test-results/`, which CI does not upload. A passing run
  therefore could not calibrate any limit, and round 19's "the first CI run
  calibrates" could not have worked. Each audit now prints its numbers and
  Lighthouse's CPU benchmark in the job log, and the test report (uploaded
  for 90 days) keeps them as JSON.
- **`npm audit fix` can be a downgrade.** For esbuild's GHSA-g7r4-m6w7-qqqr
  (`>=0.27.3 <0.28.1`) under vite 7's `^0.27.0`, the "fix available" was
  esbuild 0.27.7 to 0.27.2, below the range. Read `npm audit fix --dry-run`
  before calling an advisory fixable.
- **npm keeps a transitive version that still fits.** Taking
  `@vitejs/plugin-react` 5.2, whose peer range allows vite 8, left vite at
  7.3.5, since 7.3.5 still satisfied every range; the first trial ran four
  suites on vite 7 before `npm ls` showed it. `npm update vite` moved it to
  8.3.4. Check the resolved version after loosening a range.
- **Next prerenders a route's 404, never its 5xx.** A `force-static` GET
  route answering 500 at build becomes a function run on every request
  (`next/dist/export/routes/app-route.js` keeps an answer below 400, or a
  404). `/profile.json` answers 404 when a build has no GitHub data.
- **A file in `public/` can sit at a route's URL.** The Mac kept an
  untracked `public/profile.json` from 2026-07-04, written by a manual
  script deleted in round 14, at the new route's path. Next's build checks
  only pages-router routes against `public/` (`build/index.js`), so nothing
  said so. It is deleted, and its ignore rule with it.
- **An ignore rule hides a tracked file from search.** Git keeps a tracked
  file whatever `.gitignore` says, but ripgrep, act and a fresh `git init`
  read the rules: `rg skipAudits` missed `lighthouse.config.js`. Seven such
  rules are gone, and `src/app/gitignore.test.ts` fails on a new one.
- **Compare builds in one directory.** The vite 8 A/B, built in two
  directories, differed in nine JavaScript chunks of identical sizes (the
  module ids); built in the same directory with each lockfile, all 71 CSS
  and JavaScript files matched, the shared postcss bump (8.5.25 to 8.5.30)
  included.
- **A cycle can wrap back to where it started.** The carousel's rotation
  test advanced three steps over three skills, so the old component, which
  never held, showed the same skill and passed. A fail-first run caught it;
  the test now waits two steps.
- **playwright-lighthouse keeps the cache between audits.** It passes
  `disableStorageReset: true` unless told otherwise, so a second audit in
  the same browser measures a repeat visit (FCP 449, then 192 ms). Pass
  `disableStorageReset: false` for first visits every time.
- **A loaded host is a slower CPU, and Lighthouse says by how much.** The
  calibration ran at load averages of 75 to 180 from other jobs on the Mac.
  Lighthouse's CPU benchmark (1,676 to 2,401, against 3,982 idle) gave each
  run's effective slowdown, and alternating the two builds' audits gave both
  the same load.

Round 21 (2026-10-18):

- **A CDN move can break a CSP silently.** Hugging Face moved model weights
  behind a redirect to `us.aws.cdn.hf.co`; the CSP allowed only
  `huggingface.co` hosts, so the AI chat could load no model, and nothing
  reported it (production logs no client error). Only an end-to-end model
  load found it. After a change upstream, load the thing, not its listing.
- **Headless Chromium has two WebGPU adapters.** The default headless shell
  gets SwiftShader's fallback adapter, without `shader-f16`, and web-llm's
  q4f16 models fail to compile ("Invalid ShaderModule"). The new headless
  mode (`channel: "chromium"`) gets Metal with `shader-f16`, as Chrome does.
  Probe the adapter on a secure origin (`http://localhost`): `about:blank`
  has no `navigator.gpu`.
- **`npm install <package>` does not refresh what the postinstall copies.**
  After pdf.js 5.4.296 went in, `public/pdf.worker.min.mjs` was still the
  5.3.31 worker, which pdf.js refuses ("API version does not match the
  Worker version"). `npm ci` (CI, Vercel) runs the postinstall;
  locally, run `npm run postinstall` after such a change.
- **A mock of a module that does not exist passes quietly.** The context
  test helper mocked `@/lib/utils/performance-monitor`, gone since an
  earlier cleanup, with a factory that read a variable out of its scope
  once hoisted. Vitest 5's refusal of nested `vi.mock` surfaced it.
- **`**/*.ts` does not match `.mts`.** Renaming the Vitest config to `.mts`
  would have taken it out of type-checking; `tsconfig.test.json` includes
  `**/*.mts` now.
- **A formatter upgrade can be checked by syntax tree.** prettier 3.9
  reformatted 16 files; parsing each old and new text with TypeScript and
  comparing node kinds with identifier and literal text (parentheses
  skipped) showed them identical, and a one-identifier mutation shows the
  check bites.
- **No visible change can still cost bytes.** framer-motion 14 changed no
  pixel and no prerendered style, and its eagerly loaded code grew 39%
  (+10.8 KB gzipped on the homepage). Measure the bundle by chunk with
  every dependency bump.
- **Node and the browser can disagree after a library bump.** With react-pdf
  10.5, pdf.js names every link in node exactly as before, yet the browser's
  reader applied none: the integration, not the computation, broke. Keep an
  e2e check on the integration (pdf-reader.spec's naming test caught it).

Round 22 (2026-10-19):

- **A scroll box whose content goes away loses its place.** react-pdf 10.5
  shows its `loading` in place of the pages while it loads a document
  again; the column collapsed and the browser clamped the scroll to the
  top. Hold the content's size until it is back.
- **An IntersectionObserver reports a removed target as out of view.** The
  reader's near-pages set lost page 200 when react-pdf unmounted its box,
  and the new box came back undrawn. Skip entries whose target is no
  longer connected when a replacement is coming, and observe the
  replacements.
- **A test that compares two derived values passes when both are wrong.**
  The page-2 reload test checked that the counter agreed with the page in
  view; react-pdf 10.5 moved both to page 1. Assert the value expected.
- **webpack cannot split a module across chunks.** A three-line registry
  that framer's `m` needs, in the same module as motion-dom's VisualElement
  class, put the class and its imports in the eager chunk, because the
  lazy features need the class. A size budget that bundles one entry alone
  (motion's rollup budgets) cannot see it: unused code is dropped there.
  Measure the real build, by chunk.
- **patch-package only warns when the version differs.** It applies a
  patch made for another version if it fits, and exits 0 locally.
  `--error-on-fail --error-on-warn` and an exact pin make any change of the
  patched package fail the install. It also crashed cleaning up its temp
  folder (ENOTEMPTY) after writing the patch: read the patch, then
  `--reverse` and apply it again to check it.
- **`git stash create` leaves untracked files out.** A scratch copy made
  from it lacked the new `patches/` folder; copy new files in by hand, or
  stage them first.
- **jsdom 30's window refuses what jsdom 24's let through.** A write to a
  getter-only window property throws (`DONT_CONTEXTIFY`), and spans are
  inline under the HTML Standard's stylesheet, which changes accessible
  names made of block spans. Both are in docs/TESTING_INFRASTRUCTURE.md. Its
  cost is setup: about 0.11 s more per test file, nothing per test.
- **A timer in a mock can fire inside React's async `act`.** The PDF mock
  delivered a reloaded document on `setTimeout(0)`, which ran before the
  click's `act` resolved: no test saw the pages away. Let the test release
  the delivery.

Round 23 (2026-10-19):

- **A prebuilt dependency brings its own browser floor.** The browserslist
  shapes our code, not pdf.js's default build, which is for the latest
  browsers only: the reader failed on Safari 17 for as long as it ran
  pdf.js 5. Check what a lazily loaded package calls, and test the floor in
  e2e by deleting the APIs in an init script. The failure was the app's
  error page, not the reader's own message.
- **A CI step can cost more than the tests, unseen.** The disk cleanup took
  53 to 193 s in every job. Step timings are in the API
  (`gh api repos/<owner>/<repo>/actions/runs/<id>/jobs`): read them before
  tuning the tests.
- **A cache of a path nothing writes saves nothing, quietly.** Ten jobs
  cached Vitest folders that do not exist. And a cache step placed after a
  build restores an older copy over the fresh one.
- **"Every file runs" is not "every file runs once".** Two CI scripts
  matched src/lib/hooks: 79 tests ran twice, and every total counted them.
- **An assertion on output a dependency stopped producing passes for
  good.** The e2e count of `[tabindex="1000"]` was 0 whatever our code did,
  once pdf.js 5.4 stopped setting it. When a library changes what it
  renders, re-read the assertions written against it.
- **A compile cache helps only where it is warm.** `NODE_COMPILE_CACHE`
  saved 5.5% on a CI-like cold start and 23% warm; Vitest drops it under
  v8 coverage, and CI starts empty.

Round 24 (2026-10-19):

- **A rule's name is not its coverage.** axe's `nested-interactive` passed
  a `<button>` inside an `<a>` on the 404 page: two Tab stops for one
  action, and no finding. Assert the structure the rule should protect.
- **A fallback can be the bug.** A `@supports not (backdrop-filter: ...)`
  block from the first commit fired on Safari 16.4 to 17.x, which blur
  through `-webkit-backdrop-filter`, and gave the nav buttons, tooltips,
  scrims, toasts and cookie notice 5 to 20% black for their translucent
  backgrounds. Check a fallback's condition against every engine of the
  floor, prefixed forms included.
- **Tailwind 4 reads `_` as a space in an arbitrary variant.**
  `[&_.react-pdf__Page__canvas]:max-w-none` compiled to
  `.react-pdf Page canvas`, which matches nothing. The zoom worked anyway
  (each page box has an explicit width), as an e2e test at a narrow
  viewport showed.
- **"The error pages" are three boundaries.** `error.tsx` wraps only the
  page. The layout's own parts inside AppWrapper (navigation, terminal,
  research map) fall to AppWrapper's `ErrorBoundary`, and the root
  layout's other children (the cookie notice, the toasts) to
  `global-error.tsx`. A report from `error.tsx` alone would have missed
  most real crashes.
- **A production error can be forced on one component.** An init script
  that makes `ResizeObserver.prototype.observe` throw for one element fails
  the component that observes it, in an effect, as a real bug would.
  Breaking the whole API instead changed nothing visible: the guarded hook
  that mounts the sections just kept them unmounted.
- **Production stack frames carry URL encoding.** A dynamic route's chunks
  sit under `app/pdf/%5Bslug%5D/`, and Vercel's skew protection appends
  `?dpl=`: a frame pattern without `%` skipped the page's own frame for one
  in React.
- **A package's metadata can misstate its runtime.** Pyodide 314.0.3's lock
  file says Python 3.14.0; its interpreter is 3.14.2, and `python --version`
  repeated the lock from 2026-08-03 (`b24b125`) to this round. Compare a
  pinned constant with the running thing.
- **An immutable cache needs versioned URLs.** `/pyodide/*` was immutable
  for a year, from one unversioned folder: a version bump would have left
  returning visitors on the old runtime, or on a mix of two.

Round 25 (2026-10-19):

- **A never-cached script should name its own version.** Round 24 put the
  Pyodide version in the worker's URL; a tab opened before that deploy
  starts the worker at the URL its old bundle knew, gets the new worker,
  and the new worker refused it. The worker and its folder ship together,
  so the worker now names its version itself.
- **A memoized failure is permanent.** `loadPython()` kept its import's
  promise, rejected or not: one failed chunk load made every later
  `python` fail until a reload.
- **Source maps can cost visitors nothing.** `productionBrowserSourceMaps`
  added a `sourceMappingURL` comment to every chunk (+647 B gzipped on the
  homepage); `hidden-source-map` publishes the same maps without it.
- **On a prebuilt CLI deploy, Vercel's Git variables are not to be trusted.**
  `VERCEL_GIT_COMMIT_SHA` named nothing useful; inline the commit at build
  time (`git rev-parse HEAD`, else `GITHUB_SHA`).
- **GitHub tells nobody about their own activity.** Issues filed with the
  owner's token notified no one; a workflow acting as github-actions can.
- **A per-instance cap on serverless caps nothing.** Each instance starts
  at zero and Vercel runs as many as traffic calls for: count where the
  writes land (a GitHub search), and keep the instance's count as well.
- **`text/plain` needs no preflight.** A route that reads any content type
  can be posted to by any page, from its visitors' browsers; require JSON
  and check `Sec-Fetch-Site`.
- **Same-origin requests carry the full Referer.** Under
  `strict-origin-when-cross-origin`, a fetch to the site itself sends the
  page's address with its query: telemetry needs
  `referrerPolicy: "no-referrer"` (and `credentials: "omit"`).
- **A refactor can leave a cookie behind.** The server stopped reading the
  theme cookie when the homepage became static; the client kept writing
  it, and every request carried it for a year.
- **Reading a color from a remote image is a third-party request.** A
  scroll test that records every host the page contacts found Unsplash.
- **A fallback nobody can see still drifts.** The legal routes' fallback
  copies had stale dates and missing sections, and the modals could not
  even show them; built at build time, the routes need none.
- **Node keeps flags only for wasm features not yet shipped.** exnref can
  be turned off to guard the browser floor; tail calls and GC cannot.
- **A claim needs its source.** The site said the default model was
  0.5 GB; Hugging Face's listing says 0.70.
- **An open image optimizer is a quota anyone can spend.** On Vercel's
  Hobby plan every cache miss is a transformation, and `remotePatterns`
  with whole hosts let any page ask for any image there. Allow the
  images the site shows, or serve them from a route that knows which.
- **Next drops a fetch's `signal` when it revalidates in the
  background** (`patch-fetch.js`): a timeout on the fetch does not bound
  that request, so the route needs a `maxDuration`.
- **Moving data out of a module breaks what computes from it at first
  render.** The papers' card colours read the abstracts, which the page
  no longer had until the API answered: two cards were gray in the HTML.
  Only the full unit run caught it.
- **A splitting commit adds requests.** Six new chunks took the homepage
  from 23 scripts to 31, all after hydration: the bytes before it fell,
  and a request-count budget failed. Count both.
- **tailwind-merge hides conflicts, props included.** The site grid's
  `fixed` beat the grid's own `absolute` only because tailwind-merge
  dropped the earlier class. Without it, the stylesheet's order would
  have decided. A syntax-tree scan finds the written conflicts; only a
  run-time report finds the ones that come from props.
- **A chunk split pays only above its requests.** A shared-helpers group
  saved 1,162 B for 8 more requests: not kept.
- **A test that feeds a component its own data can pass on a dead
  mapping.** All six Skills chips drew the fallback icon: the
  component's map from names to icons matched no real technology, while
  its test mocked the old names the map knew. Hold mappings to the real
  data, or keep each value beside its key.
- **CI's Chromium-only e2e hides phone failures.** Two specs failed on
  both phone projects, one of them since before the round.
