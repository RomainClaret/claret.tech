# Performance

What a visitor's machine pays to keep the homepage open, and what a visit
downloads. Measured with `scripts/perf/measure.mjs`.

## Running the harness

Measure a production build. `next dev` is much slower and not representative.

```
SERVE_HTTP=true npx next build
SERVE_HTTP=true npx next start -p 3000
node scripts/perf/measure.mjs --label <name> --runs 3
```

- `SERVE_HTTP=true` is needed at build and start time on plain http. Without it the
  HTTPS-forcing headers blank the page in WebKit (commit f36b93e).
- `npx next build` skips the `prebuild` scripts. Those regenerate colour data
  from the network, which you don't want between two measurements.
- `--scenarios S1,S8` picks scenarios, `--settle` sets the wait after load in ms
  (default 12000), and `--no-save` skips the results file.
- Results are printed as a table (the median of the runs) and appended as JSON
  lines to `perf-results/<date>.jsonl`, which is gitignored.
- Analytics requests are blocked, so measurement runs don't count as visits.

The browser is headless Chromium. Its software GPU (SwiftShader) stands in for
a machine without a graphics card, and the DevTools protocol throttles the CPU.
WebKit runs for frame pacing only. Firefox can't be launched from the sandbox
this was developed in, so check it by hand: the Firefox Profiler's idle view,
before and after a change.

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
frame sampler since `b020d8d`, and an automatic tier runs none while
animations are off since `ce9565a` (Safari's default): the sampler only
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

### Baseline: `ce75bc9`, before the 2026-10 performance pass

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

- **Never idle.** The page keeps the main thread busy while nobody touches it: 27–37% at full CPU, wherever you are on the page, and 91–100% at 4× slower.
  - SVG `<animate>` drives thousands of style recalculations per second.
  - Most running animations (36–39) target off-screen elements.
- **No click needed for the heavy chunks.** pdf.js (`pdfjs.*`), the terminal (`terminal.*`, `2390.*`) and lottie (`7853.*`) load on every visit without any interaction.
- **Layout shifts at load.** CLS comes from the splash box resizing (`div.max-w-md.w-full.px-8`) and the hero phrase's half-typed words wrapping.
- **PDF reader.** The PhD thesis asks for 7.8 GB of canvas.

### After Phases 1–4: `b87c925` against `ce75bc9` (2026-10-08)

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

### Phases 5–6: targeted checks on the build after them

| Check                                                      | Baseline              | After          |
| ---------------------------------------------------------- | --------------------- | -------------- |
| P1: PhD thesis at DPR 2, canvases / canvas memory          | 368 / 7,824 MB        | 3 / 43 MB      |
| P1: JS heap; text spans in the page (find-in-page)         | 85 MB; 53,486         | 46 MB; 53,486  |
| CLS (S1 / S7 / S8)                                         | 0.127 / 0.321 / 0.120 | 0 / 0.0003 / 0 |
| Window resize listeners after 4 terminal open-close cycles | 9 → 17                | 10 → 10        |

### Final: `acd4ead` against `ce75bc9` (2026-10-08)

Phases 0–6 and 8. Median of 2 runs per scenario, alternating between the two
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
  spread of 19–54 between runs.
- **Frame throughput** in S2–S4 is 5–8% lower on the software GPU, with 0–2
  frames over 20 ms on either side, so no frame misses a 60 Hz display: the
  decorative loops now run on the compositor rather than the main thread,
  whose share halved.
- S7 and S8 run at LOW: the startup check classes a software GPU as weak.

### After the review fixes: `e5320b1` against `acd4ead` (2026-10-08)

The 65 commits of review fixes after the pass, measured the same way.
Absolute numbers drift between sessions (S7 measured 50.4% on `acd4ead` in
the table above and 68–78% here), so compare within a table, not across.

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

- **S7 regressed, and is fixed.** Since `ae53e80` the hero's cover was judged
  against the site grid's own box, measured once while a phone's layout
  viewport was briefly 394 px wide during load: the whole site grid
  animated under the hero, with twice the running animations. With
  `7dd7216` (measure again when the grid's box changes) and `9469a6e` (a
  Research tooltip made every page under 600 px wide pan sideways by up to
  31 px), S7 is 70.6–71.3% against 67.8–75.2% for `acd4ead`, and its
  scroll jank 17–20 against 26 frames over 20 ms.
- **S5**: the brain canvas now stops under the PDF reader (`fa842a8`).
- **S1M** (MAXIMUM, where the automatic loop takes a capable machine) costs
  5–10 points more than S1 on the same build. Its SMIL count is no measure
  of a change: it is a snapshot of whatever signals are in flight, and the
  same `acd4ead` build read 168, 192 and 312 in three runs.
- First-load JS for `/`: 242 → 245 kB (the fallbacks and the quality loop's
  backoff).

### Part 2 (2026-10-08): each change against the commit before it

Measured one change at a time against a build of the previous commit,
interleaved; traces for scroll work, file sizes from the build manifest.

| Change                                           | Measured                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| framer-motion features after hydration           | JS `/` loads before hydrating: 904.7 → 843.9 KB raw, 275.3 → 253.4 KB gzip                             |
| Montserrat Latin subset, full font for the rest  | font fetched on a full visit: 78,724 → 40,508 B; text byte-identical at DPR 2                          |
| no permanent layer per card and skill badge      | main-thread paint in a full scroll: 320–349 → 115–127 ms; frames over 20 ms lower in each pair         |
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
  once saves 5.7 points, so each of these is worth 1–3, under the run-to-run
  spread).

### Static homepage (2026-10-08)

`/` used to be rendered on every request: the root layout read the theme
and Safari cookies, which made each page view a function call. On the live
site that cost 200–350 ms before the first byte from Europe (the edge in
Dublin, the function in US East) and about a second when the function was
cold; the splash's timer starts at hydration, so none of it was hidden.

Now `next build` lists `○ /` and `● /pdf/[slug]`, there is no middleware,
and `next start` answers `/` from the prerender cache (3–8 ms here against
17–23 ms for the render) with an ETag, a 304 on revalidation and no cookie.
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
  chunk, loaded after hydration since `acd4ead`, animates it in. When that
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
  `/` stops being prerendered or a middleware returns;
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

### End to end: `40ec705` against `acd4ead` (2026-10-08)

Part 2 and the static homepage together, against the end of the first pass:
S1 six times and S1M three times per build, interleaved, at a load average
of 7.6 to 12.4. Medians, with the range in brackets. The last column is the
target the part 2 plan set.

| Measure                                  | `acd4ead`          | `40ec705`           | Target |
| ---------------------------------------- | ------------------ | ------------------- | ------ |
| Fetched with no interaction (S1)         | 705.5 KB           | 621.5 KB            | 600 KB |
| Font                                     | 78.5 KB            | 41.2 KB             | 32 KB  |
| Images                                   | 53.9 KB            | 10.0 KB             |        |
| JS the HTML loads before hydrating, gzip | 314.2 KB           | 295.8 KB            |        |
| First-load JS in Next's build table      | 242 kB             | 245 kB              | 225 kB |
| S1 main thread, BALANCED                 | 27.9% [26.2-28.8]  | 29.1% [28.6-30.1]   | 23%    |
| S1M main thread, MAXIMUM                 | 34.3% [31.9-38.0]  | 35.2% [33.7-35.3]   | S1 + 5 |
| S1 frames over 20 ms in a full scroll    | 48 [35-63]         | 27 [14-46]          | 25     |
| S1M frames over 20 ms in a full scroll   | 54 [53-57]         | 27 [26-31]          |        |
| S1 heap                                  | 21.4 MB            | 18.4 MB             |        |
| `/` from `next start`                    | rendered, 17-23 ms | prerendered, 3-8 ms |        |

- **No numeric target is met.** Bytes, scroll jank and heap went down;
  S1's main thread, S1M's and Next's first-load figure did not, for the
  reasons below.
- **Bytes:** 84 KB less per first visit. Next's build table reads 245 kB
  before and after framer's features left the critical path (`c389e86`), so
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
  four builds, order rotated: `acd4ead` 28.3%, `7dd7216` 27.9%, `c83df26`
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
- **Scroll** jank fell 44% in the median, from the card layers (`2646253`).
  The spread is wide: the same build read 14 to 18 in one set of runs and
  36 to 46 in the next, an hour later.

### Frame sampler (2026-10-10)

The frame sampler (`useFpsOnly`) requested a frame on every display refresh
for the whole visit, whether or not the quality loop or auto-disable read
it. On an otherwise still page each callback is a full rendering update
(style, layout, IntersectionObserver checks, a commit) that draws nothing.
Since `b020d8d` it samples only while the automatic loop runs or
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
so its tier also climbed, LOW to BALANCED within 20 s. Since `ce9565a` the
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

| Measure                                            | 15.5.22             | 16.4.1              | Change                                                                        |
| -------------------------------------------------- | ------------------- | ------------------- | ----------------------------------------------------------------------------- |
| Homepage JS, gzipped                               | 298.7 KB            | 326.4 KB            | +27.7 KB (+9.3%), all in Next's framework chunk (React 19.2's vendored build) |
| Homepage CSS and fonts                             |                     |                     | unchanged                                                                     |
| Homepage HTML                                      |                     |                     | 5.5 KB smaller                                                                |
| Image keys hung after a dropped request            | 92 of 160           | 0 of 320            | the optimizer bug below, fixed in 16.4.0                                      |
| Lighthouse (desktop, two runs each, fresh servers) | 100, 96, 96, 92     | 100, 96, 96, 92     | same scores                                                                   |
| FCP / LCP / Speed Index                            | 364 / 704 / 1692 ms | 363 / 750 / 1500 ms | LCP +46 ms, Speed Index -192 ms                                               |
| TBT, CLS                                           | 0, 0                | 0, 0                |                                                                               |

The Linux e2e set on 16.4.1: 347 passed, 0 failed, 7 skipped by design;
mobile 20 of 20. Deprecated in 16, for later: React 18 support (removed in 17) and the Edge runtime of the og-image route.

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
  Python), and the two caches `src/lib/utils/kudos-cache.json` and
  `medium-cache.json`. Compare sizes within one checkout: two builds of the
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
  - put Node 20 first on the PATH: the image's default is 24, and CI's
    setup-node pins 20;
  - run `npm ci --ignore-scripts`, since `canvas` has no linux-arm64 binary
    for Node 20. The flag goes on that command only, so `prebuild` still
    runs;
  - run the postinstall by hand: `node scripts/setup-assets.js`, then
    `node scripts/mirror-legacy-pdfs.js`. Without it `public/pyodide` is
    missing and the Python terminal tests time out;
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
  failed none (on `5d36b46`, which had also fixed one of the 6).

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
  A trace of the scripted scroll put 157–171 ms in the scroll handlers,
  nearly all of it style recalculation forced by reading `window.scrollY`
  and `offsetTop`. Rebuilt on IntersectionObservers, the handlers dropped to
  3 ms, but the scroll's total style recalculation (129–148 ms) and layout
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
  `finishRun`) and closes it. In CI's Firefox, held to one content process
  (`dom.ipc.processCount: 1` and `browser.tabs.remote.autostart: false`
  in `playwright.config.ts`), the key press after that crashed the page's
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
- **The homepage does not reflow at 320 px** (WCAG 1.4.10), with scripts
  or without: 19 px too wide on an iPhone SE. Four no-wrap rows or
  columns: research cards' footer row (300 px), the footer's seven icons
  (340 px), the Papers filter pills and stats rows (332 px with padding),
  and Education's two-column skills grid of no-wrap pills ("Software
  Engineering", 175 px; "JAX/TensorFlow" has no break) in a column left
  176 px. Wrapping the first two fixed them when injected; Papers and
  Education need more (and Education a design call). Not fixed yet.
