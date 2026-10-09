#!/usr/bin/env node
/**
 * Performance harness for the homepage: what a visitor's machine pays to keep
 * it open, and what a visit downloads.
 *
 * Runs headless Chromium, whose software GPU (SwiftShader) stands in for a
 * machine without a graphics card, optionally with the CPU throttled through
 * the DevTools protocol, plus WebKit for frame pacing. Every scenario starts
 * from a fresh browser context, so nothing carries over between runs.
 *
 * Usage:
 *   node scripts/perf/measure.mjs --url http://localhost:3000 --label baseline
 *   node scripts/perf/measure.mjs --scenarios S1,S8 --runs 3
 *
 * Measure a production build, not `next dev`: SERVE_HTTP=true npm run build &&
 * SERVE_HTTP=true npm start (without SERVE_HTTP the HTTPS-forcing headers blank
 * WebKit on plain http). Results are printed as a table and appended as JSON
 * lines to perf-results/<date>.jsonl (gitignored). docs/performance.md lists
 * the scenarios and keeps the before/after numbers.
 */
import { execSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { chromium, webkit } from "@playwright/test";

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

// Forced tiers, through the localStorage keys of a manual pick. BALANCED is
// where every non-Safari visit starts; the automatic loop then raises a
// capable machine to MAXIMUM (decide.ts), so S1M is the look most capable
// machines end up with. The automatic tier (S7, S8) is what a slow machine
// ends up with.
const FORCE_BALANCED = { "quality-auto": "false", "quality-mode": "balanced" };
const FORCE_MAXIMUM = { "quality-auto": "false", "quality-mode": "maximum" };
// A fresh profile shows the cookie notice, a full-width backdrop-blur bar
// over the animated hero. A returning visitor has dismissed it.
const NOTICE_DISMISSED = { "cookie-notice-acknowledged": "true" };

/**
 * Each scenario loads the page, waits for the splash and the first fetches to
 * settle, optionally scrolls to a section or opens something, then measures a
 * quiet window with no input.
 */
const SCENARIOS = {
  S1: { title: "hero, idle", load: true, scroll: true, force: FORCE_BALANCED },
  S1M: {
    title: "hero, idle, MAXIMUM",
    load: true,
    scroll: true,
    force: FORCE_MAXIMUM,
  },
  S1A: {
    title: "hero, idle, notice dismissed",
    load: true,
    scroll: true,
    force: { ...FORCE_BALANCED, ...NOTICE_DISMISSED },
  },
  S2: { title: "papers", section: "papers", force: FORCE_BALANCED },
  S3: { title: "education", section: "education", force: FORCE_BALANCED },
  S4: { title: "contact", section: "contact", force: FORCE_BALANCED },
  S5: { title: "PDF modal open", open: "resume", force: FORCE_BALANCED },
  S6: { title: "splash window", splash: true, force: FORCE_BALANCED },
  S7: {
    title: "phone, 4x CPU, automatic tier",
    viewport: PHONE,
    mobile: true,
    throttle: 4,
    load: true,
    scroll: true,
  },
  S8: { title: "desktop, 4x CPU, automatic tier", throttle: 4, load: true },
  W1: { title: "WebKit hero, idle", engine: "webkit", force: FORCE_BALANCED },
  P1: { title: "PDF reader, PhD thesis", pdf: "phd-thesis" },
};

const DEFAULT_SCENARIOS = [
  "S1",
  "S1M",
  "S1A",
  "S2",
  "S3",
  "S4",
  "S5",
  "S6",
  "S7",
  "S8",
];

/** Installed before any page script: load-time observers and a clean rAF. */
const INIT_SCRIPT = `(() => {
  window.__perf = { longtasks: [], lcp: 0, shifts: [] };
  // Captured first, so frame sampling still works if a page script wraps rAF.
  window.__origRAF = window.requestAnimationFrame.bind(window);
  const label = (n) => !n || !n.tagName ? String(n && n.nodeName) :
    (n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") +
     (typeof n.className === "string" && n.className.trim()
       ? "." + n.className.trim().split(/\\s+/).slice(0, 4).join(".") : "")).slice(0, 90);
  const observe = (type, cb) => {
    try { new PerformanceObserver((l) => l.getEntries().forEach(cb)).observe({ type, buffered: true }); } catch (e) {}
  };
  observe("longtask", (e) => window.__perf.longtasks.push(Math.round(e.duration)));
  observe("largest-contentful-paint", (e) => { window.__perf.lcp = Math.round(e.startTime); });
  observe("layout-shift", (e) => {
    if (e.hadRecentInput) return;
    window.__perf.shifts.push({ t: Math.round(e.startTime), v: e.value,
      src: (e.sources || []).map((s) => label(s.node)).join(" | ") });
  });
})();`;

function parseArgs(argv) {
  const args = {
    url: "http://localhost:3000",
    label: "unlabelled",
    runs: 1,
    scenarios: DEFAULT_SCENARIOS,
    settle: 12000,
    out: true,
  };
  for (let i = 2; i < argv.length; i++) {
    const [key, inline] = argv[i].split("=");
    const value = () => inline ?? argv[++i];
    if (key === "--url") args.url = value().replace(/\/$/, "");
    else if (key === "--label") args.label = value();
    else if (key === "--runs") args.runs = Number(value());
    else if (key === "--scenarios") args.scenarios = value().split(",");
    else if (key === "--settle") args.settle = Number(value());
    else if (key === "--no-save") args.out = false;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  for (const id of args.scenarios) {
    if (!SCENARIOS[id]) throw new Error(`Unknown scenario: ${id}`);
  }
  return args;
}

const median = (values) => {
  const sorted = values
    .filter((v) => typeof v === "number")
    .sort((a, b) => a - b);
  if (!sorted.length) return undefined;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const round = (value, digits = 1) =>
  typeof value === "number" ? Number(value.toFixed(digits)) : value;

/** Frame pacing over `ms`, sampled with the rAF captured before page scripts. */
function sampleFrames(page, ms) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const raf =
          window.__origRAF || window.requestAnimationFrame.bind(window);
        const times = [];
        const start = performance.now();
        const tick = (now) => {
          times.push(now);
          if (now - start < duration) return raf(tick);
          const deltas = times.slice(1).map((t, i) => t - times[i]);
          resolve({
            fps:
              (times.length - 1) /
              ((times[times.length - 1] - times[0]) / 1000),
            framesOver20ms: deltas.filter((d) => d > 20).length,
            frames: deltas.length,
          });
        };
        raf(tick);
      }),
    ms,
  );
}

/** What is still animating: running animations, off-screen ones, live SMIL. */
function inventory(page) {
  return page.evaluate(() => {
    const margin = 200;
    const offscreen = (el) => {
      const r = el.getBoundingClientRect();
      return (
        r.bottom < -margin ||
        r.top > innerHeight + margin ||
        r.right < -margin ||
        r.left > innerWidth + margin ||
        (r.width === 0 && r.height === 0)
      );
    };
    const running = document
      .getAnimations()
      .filter((a) => a.playState === "running");
    const outermostSvg = (el) => {
      let svg = el.ownerSVGElement;
      while (svg && svg.ownerSVGElement) svg = svg.ownerSVGElement;
      return svg;
    };
    const smil = [
      ...document.querySelectorAll(
        "animate, animateTransform, animateMotion, set",
      ),
    ];
    const liveSmil = smil.filter((el) => {
      const svg = outermostSvg(el);
      return svg && !(svg.animationsPaused && svg.animationsPaused());
    });
    const label = (el) =>
      (
        el.tagName.toLowerCase() +
        (typeof el.className === "string" && el.className.trim()
          ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
          : "")
      ).slice(0, 70);
    const unseen = running.filter(
      (a) => a.effect && a.effect.target && offscreen(a.effect.target),
    );
    // What the off-screen ones are, grouped, so the next fix has a target.
    const unseenGroups = {};
    for (const a of unseen) {
      const key = `${a.animationName || a.transitionProperty || "js"} @ ${label(a.effect.target)}`;
      unseenGroups[key] = (unseenGroups[key] || 0) + 1;
    }
    return {
      runningAnimations: running.length,
      offscreenAnimations: unseen.length,
      offscreenSample: Object.entries(unseenGroups)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([key, count]) => `${count}x ${key}`),
      liveSmil: liveSmil.length,
      domNodes: document.getElementsByTagName("*").length,
      canvases: document.querySelectorAll("canvas").length,
      // Read where QualityProvider keeps it: a manual tier in localStorage,
      // an automatic one in sessionStorage.
      qualityMode:
        localStorage.getItem("quality-auto") === "false"
          ? localStorage.getItem("quality-mode")
          : sessionStorage.getItem("quality-mode"),
      dataQuality: document.documentElement.dataset.quality ?? null,
      // The startup check's verdict (lib/quality/probe.ts caches it here):
      // the reason it started an automatic tier at LOW, "capable" if none,
      // null if it did not run. S7 and S8 depend on it (docs/performance.md).
      probe: (() => {
        try {
          const verdict = JSON.parse(sessionStorage.getItem("quality-probe"));
          return verdict ? (verdict.reason ?? "capable") : null;
        } catch {
          return null;
        }
      })(),
    };
  });
}

/** Full-page scroll at 60 px per frame; how many frames miss 20 ms. */
function scrollJank(page) {
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const raf =
          window.__origRAF || window.requestAnimationFrame.bind(window);
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo(0, 0);
        const times = [];
        const step = (now) => {
          times.push(now);
          window.scrollBy(0, 60);
          const atEnd =
            window.scrollY + innerHeight >=
            document.documentElement.scrollHeight - 2;
          if (!atEnd && times.length < 2000) return raf(step);
          const deltas = times.slice(1).map((t, i) => t - times[i]);
          resolve({
            scrollFrames: deltas.length,
            scrollFramesOver20ms: deltas.filter((d) => d > 20).length,
            scrollFramesOver50ms: deltas.filter((d) => d > 50).length,
          });
        };
        raf(step);
      }),
  );
}

async function runChromium(baseUrl, scenario, settleMs) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: scenario.viewport ?? DESKTOP,
      deviceScaleFactor: scenario.pdf ? 2 : scenario.mobile ? 3 : 1,
      isMobile: Boolean(scenario.mobile),
      hasTouch: Boolean(scenario.mobile),
      // The worker registers after load and only caches images, fonts and
      // animations; blocking it keeps first-visit numbers comparable.
      serviceWorkers: "block",
    });
    // Measurement runs must not count as visits.
    await context.route(/\/_vercel\/(insights|speed-insights)\//, (route) =>
      route.abort(),
    );
    await context.addInitScript(INIT_SCRIPT);
    if (scenario.force) {
      await context.addInitScript((entries) => {
        for (const [key, value] of Object.entries(entries))
          localStorage.setItem(key, value);
      }, scenario.force);
    }
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error).slice(0, 160)));

    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    await cdp.send("Network.enable");
    if (scenario.throttle) {
      await cdp.send("Emulation.setCPUThrottlingRate", {
        rate: scenario.throttle,
      });
    }
    const responses = new Map();
    cdp.on("Network.responseReceived", (e) =>
      responses.set(e.requestId, { url: e.response.url, type: e.type }),
    );
    cdp.on("Network.loadingFinished", (e) => {
      const entry = responses.get(e.requestId);
      if (entry) entry.bytes = e.encodedDataLength;
    });
    const metrics = async () =>
      Object.fromEntries(
        (await cdp.send("Performance.getMetrics")).metrics.map((m) => [
          m.name,
          m.value,
        ]),
      );
    /** Main-thread share and style work over a quiet window with no input. */
    const quietWindow = async (ms) => {
      const before = await metrics();
      await page.waitForTimeout(ms);
      const after = await metrics();
      const seconds = after.Timestamp - before.Timestamp;
      const share = (key) => (100 * (after[key] - before[key])) / seconds;
      return {
        mainThreadPct: share("TaskDuration"),
        scriptPct: share("ScriptDuration"),
        stylePct: share("RecalcStyleDuration"),
        layoutPct: share("LayoutDuration"),
        styleRecalcsPerSec:
          (after.RecalcStyleCount - before.RecalcStyleCount) / seconds,
        heapMB: after.JSHeapUsedSize / 1048576,
      };
    };

    const result = { errors };
    const target = scenario.pdf
      ? `${baseUrl}/pdf/${scenario.pdf}`
      : `${baseUrl}/`;
    const response = await page.goto(target, {
      waitUntil: "load",
      timeout: 120000,
    });
    // Scripts named in the served HTML. Anything else fetched later is a lazy
    // chunk; the live DOM cannot tell them apart, because webpack inserts a
    // <script src> for every chunk it loads.
    const scriptsInHtml = [
      ...((await response?.text()) ?? "").matchAll(
        /<script[^>]*\ssrc="([^"]+)"/g,
      ),
    ].map((match) => new URL(match[1], target).pathname);

    if (scenario.splash) {
      // The splash plays for about 1.9 s after it mounts; measure that window.
      Object.assign(result, await quietWindow(2500));
      return result;
    }

    await page.waitForTimeout(settleMs);

    if (scenario.pdf) {
      Object.assign(
        result,
        await page.evaluate(() => {
          const canvases = [...document.querySelectorAll("canvas")];
          return {
            canvases: canvases.length,
            canvasBackingMB:
              canvases.reduce((sum, c) => sum + c.width * c.height * 4, 0) /
              1048576,
            textSpans: document.querySelectorAll(
              ".react-pdf__Page__textContent span",
            ).length,
            domNodes: document.getElementsByTagName("*").length,
          };
        }),
        { heapMB: (await metrics()).JSHeapUsedSize / 1048576 },
      );
      return result;
    }

    if (scenario.load) {
      const load = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const fcp = performance.getEntriesByName("first-contentful-paint")[0];
        const shifts = window.__perf.shifts;
        return {
          ttfbMs: Math.round(nav.responseStart),
          fcpMs: fcp ? Math.round(fcp.startTime) : null,
          lcpMs: window.__perf.lcp,
          cls: shifts.reduce((sum, s) => sum + s.v, 0),
          longTasks: window.__perf.longtasks.length,
          blockingMs: window.__perf.longtasks.reduce(
            (sum, d) => sum + Math.max(0, d - 50),
            0,
          ),
          topShifts: [...shifts]
            .sort((a, b) => b.v - a.v)
            .slice(0, 3)
            .map((s) => `${s.v.toFixed(4)} @${s.t}ms ${s.src}`),
        };
      });
      const fetched = [...responses.values()].filter((r) => r.bytes);
      const kb = (type) =>
        fetched
          .filter((r) => r.type === type)
          .reduce((sum, r) => sum + r.bytes, 0) / 1024;
      Object.assign(result, load, {
        scriptKB: kb("Script"),
        fontKB: kb("Font"),
        imageKB: kb("Image"),
        fetchKB: kb("Fetch"),
        totalKB: fetched.reduce((sum, r) => sum + r.bytes, 0) / 1024,
        lazyChunks: fetched
          .filter((r) => r.type === "Script")
          .map((r) => new URL(r.url).pathname)
          .filter((path) => !scriptsInHtml.includes(path))
          .map((path) => path.replace("/_next/static/chunks/", "")),
      });
    }

    if (scenario.section) {
      await page.evaluate((id) => {
        document.documentElement.style.scrollBehavior = "auto";
        document.getElementById(id)?.scrollIntoView();
      }, scenario.section);
      await page.waitForTimeout(3000);
    }

    if (scenario.open === "resume") {
      await page
        .getByRole("button", { name: /view resume/i })
        .first()
        .click();
      await page.waitForSelector(".react-pdf__Page__canvas", {
        timeout: 30000,
      });
      await page.waitForTimeout(5000);
    }

    Object.assign(result, await quietWindow(5000));
    Object.assign(result, await sampleFrames(page, 2000));
    Object.assign(result, await inventory(page));
    if (scenario.scroll) Object.assign(result, await scrollJank(page));
    return result;
  } finally {
    await browser.close();
  }
}

async function runWebKit(baseUrl, scenario, settleMs) {
  const browser = await webkit.launch();
  try {
    const context = await browser.newContext({ viewport: DESKTOP });
    await context.route(/\/_vercel\/(insights|speed-insights)\//, (route) =>
      route.abort(),
    );
    await context.addInitScript(INIT_SCRIPT);
    if (scenario.force) {
      await context.addInitScript((entries) => {
        for (const [key, value] of Object.entries(entries))
          localStorage.setItem(key, value);
      }, scenario.force);
    }
    const page = await context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(settleMs);
    return { ...(await sampleFrames(page, 3000)), ...(await inventory(page)) };
  } finally {
    await browser.close();
  }
}

const COLUMNS = [
  ["mainThreadPct", "main%"],
  ["styleRecalcsPerSec", "recalc/s"],
  ["fps", "fps"],
  ["framesOver20ms", ">20ms"],
  ["runningAnimations", "anims"],
  ["offscreenAnimations", "offscr"],
  ["liveSmil", "smil"],
  ["heapMB", "heapMB"],
  ["domNodes", "nodes"],
  ["cls", "CLS"],
  ["scriptKB", "jsKB"],
  ["scrollFramesOver20ms", "scroll>20"],
  ["canvasBackingMB", "canvasMB"],
];

function printTable(rows) {
  const header = ["id", ...COLUMNS.map(([, title]) => title)];
  const lines = rows.map((row) => [
    row.scenario,
    ...COLUMNS.map(([key]) => {
      const value = row[key];
      if (value === undefined || value === null) return "";
      return String(round(value, key === "cls" ? 3 : 1));
    }),
  ]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...lines.map((l) => l[i].length)),
  );
  const format = (cells) =>
    cells.map((c, i) => c.padStart(widths[i])).join("  ");
  console.log(format(header));
  for (const line of lines) console.log(format(line));
}

async function main() {
  const args = parseArgs(process.argv);
  const sha = execSync("git rev-parse --short HEAD").toString().trim();
  const date = new Date().toISOString().slice(0, 10);
  const summary = [];

  for (const id of args.scenarios) {
    const scenario = SCENARIOS[id];
    const runs = [];
    for (let run = 1; run <= args.runs; run++) {
      const measure = scenario.engine === "webkit" ? runWebKit : runChromium;
      const result = await measure(args.url, scenario, args.settle);
      runs.push(result);
      const record = {
        date,
        sha,
        label: args.label,
        scenario: id,
        run,
        ...result,
      };
      if (args.out) {
        mkdirSync("perf-results", { recursive: true });
        appendFileSync(
          `perf-results/${date}.jsonl`,
          JSON.stringify(record) + "\n",
        );
      }
      if (result.errors?.length)
        console.warn(`${id}: page errors`, result.errors);
    }
    // Median across runs for numbers; lists come from the first run.
    const merged = { scenario: id, title: scenario.title };
    for (const key of Object.keys(runs[0])) {
      const values = runs.map((r) => r[key]);
      merged[key] = typeof values[0] === "number" ? median(values) : values[0];
    }
    summary.push(merged);
    console.error(`done: ${id} (${scenario.title})`);
  }

  console.log(
    `\n${args.label} @ ${sha}, ${args.url}, median of ${args.runs} run(s)`,
  );
  printTable(summary);
  for (const row of summary) {
    if (row.topShifts?.length)
      console.log(`${row.scenario} shifts: ${row.topShifts.join("; ")}`);
    if (row.lazyChunks?.length)
      console.log(`${row.scenario} lazy chunks: ${row.lazyChunks.join(", ")}`);
    if (row.offscreenSample?.length)
      console.log(
        `${row.scenario} off-screen: ${row.offscreenSample.join("; ")}`,
      );
    if (!SCENARIOS[row.scenario].force && row.probe)
      console.log(`${row.scenario} startup check: ${row.probe}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
