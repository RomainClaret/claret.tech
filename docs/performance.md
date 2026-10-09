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
- **A page on screen before the splash keeps the screen.** When the 4 s
  timer or the CSS fallback uncovers the page before the splash shows (Slow
  3G: the splash used to arrive 7.7 s later and cover the page for two
  seconds, scroll locked), the splash skips itself: it still does its work
  (browser detection, the background, the projects) but shows nothing.
  AppWrapper sees the fallback through its `animationend`, or on mount if
  it ended before hydration.
- **Guards:** `.github/scripts/check-static-home.mjs` fails the build job if
  `/` stops being prerendered or a middleware returns;
  `tests/e2e/static-shell.spec.ts` pins the first paint, a clean hydration,
  the no-script page, the page when the bundle never runs, and no splash
  over a page already on screen.

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
  favoured the baseline.
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

## Traps found on the way

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
  without asking. Bumping the service worker's cache does not help: its
  fetch on a miss goes through that HTTP cache. Give changed content a new
  URL: the splash data is `*.v2.json` since it was minified, and the resized
  conference logos carry `?v=2` from `LOGO_VERSIONS` in
  `conference-logos.ts`.
