import { test, expect, chromium } from "./utils/fixtures";
import { playAudit } from "playwright-lighthouse";
import fs from "fs";
import path from "path";

interface LighthouseResult {
  browserName: string;
  timestamp: string;
  scores: {
    performance: number;
    accessibility: number;
    bestPractices: number;
    seo: number;
  };
  metrics: {
    fcp: number;
    lcp: number;
    cls: number;
    tbt: number;
    si: number;
    tti: number;
  };
}

/** One audit: its scores, its metrics, and Lighthouse's CPU benchmark. */
type Audit = Pick<LighthouseResult, "scores" | "metrics"> & {
  benchmarkIndex: number;
};

// CI's runners scored one commit 69, then 87 on a retry: the gate reads the
// median of three audits, so one slow run cannot fail it alone.
const AUDITS = 3;

interface Lhr {
  categories: Record<string, { score: number | null } | undefined>;
  audits: Record<string, { numericValue?: number } | undefined>;
  environment?: { benchmarkIndex?: number };
}

function readAudit(lhr: Lhr): Audit {
  const score = (id: string) =>
    Math.round((lhr.categories[id]?.score ?? 0) * 100);
  const metric = (id: string) => lhr.audits[id]?.numericValue ?? 0;
  return {
    scores: {
      performance: score("performance"),
      accessibility: score("accessibility"),
      bestPractices: score("best-practices"),
      seo: score("seo"),
    },
    metrics: {
      fcp: metric("first-contentful-paint"),
      lcp: metric("largest-contentful-paint"),
      cls: metric("cumulative-layout-shift"),
      tbt: metric("total-blocking-time"),
      si: metric("speed-index"),
      tti: metric("interactive"),
    },
    benchmarkIndex: lhr.environment?.benchmarkIndex ?? 0,
  };
}

const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[(values.length - 1) >> 1];

/** Each score and each metric, the median over the audits (odd count). */
function medianAudit(audits: Audit[]): Audit {
  const of = (pick: (audit: Audit) => number) => median(audits.map(pick));
  return {
    scores: {
      performance: of((a) => a.scores.performance),
      accessibility: of((a) => a.scores.accessibility),
      bestPractices: of((a) => a.scores.bestPractices),
      seo: of((a) => a.scores.seo),
    },
    metrics: {
      fcp: of((a) => a.metrics.fcp),
      lcp: of((a) => a.metrics.lcp),
      cls: of((a) => a.metrics.cls),
      tbt: of((a) => a.metrics.tbt),
      si: of((a) => a.metrics.si),
      tti: of((a) => a.metrics.tti),
    },
    benchmarkIndex: of((a) => a.benchmarkIndex),
  };
}

const describeAudit = ({ scores, metrics, benchmarkIndex }: Audit) =>
  `performance ${scores.performance}, FCP ${Math.round(metrics.fcp)} ms, ` +
  `LCP ${Math.round(metrics.lcp)} ms, TBT ${Math.round(metrics.tbt)} ms, ` +
  `SI ${Math.round(metrics.si)} ms, TTI ${Math.round(metrics.tti)} ms, ` +
  `CLS ${metrics.cls.toFixed(3)}, CPU benchmark ${Math.round(benchmarkIndex)}`;

// Performance thresholds for different browsers
const PERFORMANCE_THRESHOLDS = {
  // For CI's runners, calibrated on 2026-10-18 (docs/performance.md, round
  // 20). In the Playwright container, d8da49f scored what CI gave it on
  // 2026-10-04 (81 to 83) at 3.3 to 4.2 times an idle M4 Max's CPU time:
  // CI runs about 3.7 times slower. HEAD at that speed: performance 89 to
  // 91, FCP 450 to 460 ms, LCP 610 to 960 ms, TBT 370 to 440 ms, TTI 2.1
  // to 2.3 s, CLS 0.016. The medians passed at 1.7 to 1.8 times CI's
  // slowness (performance 81 and 82) and failed from 2.2 times, round 19's
  // 8x CPU (performance 74). Round 19 had set performance 90, TBT 300 ms
  // and TTI 2.5 s from the container alone, which HEAD's TBT at CI's speed
  // already exceeds.
  chromium: {
    performance: 80,
    fcp: 1500,
    lcp: 2000,
    cls: 0.1,
    tbt: 1000,
    tti: 3000,
  },
  webkit: {
    performance: 85, // Slightly lower for Safari due to known limitations
    fcp: 2000,
    lcp: 3000,
    cls: 0.15,
    tbt: 400,
    tti: 4000,
  },
  firefox: {
    performance: 88,
    fcp: 1900,
    lcp: 2700,
    cls: 0.1,
    tbt: 350,
    tti: 3900,
  },
};

// Ensure performance results directory exists
const RESULTS_DIR = path.join(process.cwd(), "test-results", "lighthouse");
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Helper function to save lighthouse results
function saveLighthouseResults(result: LighthouseResult) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `lighthouse-${result.browserName}-${timestamp}.json`;
  const filepath = path.join(RESULTS_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
  // console.log(`Lighthouse results saved to: ${filepath}`);
}

// Helper function to load performance history
function loadPerformanceHistory(): LighthouseResult[] {
  const historyFile = path.join(RESULTS_DIR, "performance-history.json");

  if (!fs.existsSync(historyFile)) {
    return [];
  }

  try {
    const data = fs.readFileSync(historyFile, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.warn("Failed to load performance history:", error);
    return [];
  }
}

/**
 * Block until the audit test has written a result for `browserName`.
 *
 * The comparison test used to call loadPerformanceHistory() once, immediately,
 * and skip on the empty array it got back - which it always got back, because
 * Playwright clears test-results/ at the start of a run and the audit takes
 * ~40s to write anything. describe.serial now guarantees the audit has
 * finished first, so in practice this returns on its first poll; the loop is
 * what makes that a guarantee rather than an assumption about scheduling.
 */
function waitForPerformanceHistory(
  browserName: string,
  timeoutMs: number,
): LighthouseResult[] {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const history = loadPerformanceHistory();
    if (history.some((r) => r.browserName === browserName)) return history;
    if (Date.now() >= deadline) return history;
    // Synchronous sleep: this runs in the test body, not in an async hot path,
    // and busy-waiting on a file that another test writes is the whole job.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
}

// Helper function to update performance history
function updatePerformanceHistory(result: LighthouseResult) {
  const historyFile = path.join(RESULTS_DIR, "performance-history.json");
  const history = loadPerformanceHistory();

  // Add new result
  history.push(result);

  // Keep only last 100 results per browser
  const filteredHistory = history
    .filter((r) => r.browserName === result.browserName)
    .slice(-100)
    .concat(history.filter((r) => r.browserName !== result.browserName));

  try {
    fs.writeFileSync(historyFile, JSON.stringify(filteredHistory, null, 2));
  } catch (error) {
    console.warn("Failed to update performance history:", error);
  }
}

// Helper function to check for performance regression
function checkPerformanceRegression(currentResult: LighthouseResult): {
  hasRegression: boolean;
  regressions: Array<{
    metric: string;
    current: number;
    baseline: number;
    change: number;
  }>;
} {
  const history = loadPerformanceHistory()
    .filter((r) => r.browserName === currentResult.browserName)
    .slice(-10); // Look at last 10 results

  if (history.length === 0) {
    return { hasRegression: false, regressions: [] };
  }

  // Calculate baseline from recent history
  const baseline = {
    performance:
      history.reduce((sum, r) => sum + r.scores.performance, 0) /
      history.length,
    fcp: history.reduce((sum, r) => sum + r.metrics.fcp, 0) / history.length,
    lcp: history.reduce((sum, r) => sum + r.metrics.lcp, 0) / history.length,
    cls: history.reduce((sum, r) => sum + r.metrics.cls, 0) / history.length,
    tbt: history.reduce((sum, r) => sum + r.metrics.tbt, 0) / history.length,
  };

  const regressions = [];
  const REGRESSION_THRESHOLD = 0.1; // 10% regression threshold

  // Check performance score regression
  const perfChange =
    (baseline.performance - currentResult.scores.performance) /
    baseline.performance;
  if (perfChange > REGRESSION_THRESHOLD) {
    regressions.push({
      metric: "Performance Score",
      current: currentResult.scores.performance,
      baseline: baseline.performance,
      change: perfChange * 100,
    });
  }

  // Check Core Web Vitals regressions
  const fcpChange = (currentResult.metrics.fcp - baseline.fcp) / baseline.fcp;
  if (fcpChange > REGRESSION_THRESHOLD) {
    regressions.push({
      metric: "First Contentful Paint",
      current: currentResult.metrics.fcp,
      baseline: baseline.fcp,
      change: fcpChange * 100,
    });
  }

  const lcpChange = (currentResult.metrics.lcp - baseline.lcp) / baseline.lcp;
  if (lcpChange > REGRESSION_THRESHOLD) {
    regressions.push({
      metric: "Largest Contentful Paint",
      current: currentResult.metrics.lcp,
      baseline: baseline.lcp,
      change: lcpChange * 100,
    });
  }

  const clsChange = (currentResult.metrics.cls - baseline.cls) / baseline.cls;
  if (clsChange > REGRESSION_THRESHOLD && baseline.cls > 0) {
    regressions.push({
      metric: "Cumulative Layout Shift",
      current: currentResult.metrics.cls,
      baseline: baseline.cls,
      change: clsChange * 100,
    });
  }

  const tbtChange = (currentResult.metrics.tbt - baseline.tbt) / baseline.tbt;
  if (tbtChange > REGRESSION_THRESHOLD) {
    regressions.push({
      metric: "Total Blocking Time",
      current: currentResult.metrics.tbt,
      baseline: baseline.tbt,
      change: tbtChange * 100,
    });
  }

  return {
    hasRegression: regressions.length > 0,
    regressions,
  };
}

// Lighthouse testing. Serial because the comparison test reads the history
// file the audit test writes; run in parallel they race, and the comparison
// test loses that race every time.
test.describe.serial("Cross-Browser Lighthouse Performance", () => {
  // Only test with Chromium since Lighthouse requires Chrome DevTools Protocol
  const browsers = [{ name: "chromium", launcher: chromium }];

  for (const browserInfo of browsers) {
    test(`should meet performance standards in ${browserInfo.name}`, async ({
      page: _page,
      browserName: _browserName,
    }, testInfo) => {
      // Skip Lighthouse tests for mobile browsers as they're not supported
      const projectName = testInfo.project.name || "";

      if (
        projectName.includes("Mobile") ||
        (projectName.includes("Safari") && projectName.includes("Mobile"))
      ) {
        test.skip(
          true,
          `Lighthouse tests are not supported on mobile browsers (project: ${projectName})`,
        );
        return;
      }

      // Only run on Chromium projects
      if (
        !projectName.toLowerCase().includes("chromium") &&
        projectName !== "chromium"
      ) {
        test.skip(
          true,
          `Lighthouse tests only work with Chromium-based browsers (current project: ${projectName})`,
        );
        return;
      }

      // Three audits of up to a minute each on CI's runners.
      test.setTimeout(300000);

      // Two properties of this test that cost debugging time, recorded here
      // rather than rediscovered:
      //
      // 1. It launches a *second* browser, so it does not use the `page`
      //    fixture, and 9222 is hardcoded because playAudit attaches to that
      //    port. If anything else already holds 9222, Chromium silently binds
      //    a different port and playAudit ends up auditing the wrong target.
      // 2. Run alongside the rest of the suite (4 workers against `next dev`)
      //    it is unreliable: observed 2026-08-03 as a 180s test timeout and, on
      //    retry, `LighthouseError: PROTOCOL_TIMEOUT`. Run on its own, an
      //    audit takes about 30 s. Its CI job (.github/workflows/playwright.yml
      //    "lighthouse-performance") runs this file alone against `npm start`,
      //    the environment the thresholds are calibrated for; a local
      //    full-suite run is not.
      const browser = await browserInfo.launcher.launch({
        args: [
          "--remote-debugging-port=9222", // Enable Chrome DevTools Protocol
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ],
      });

      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
      });

      const page = await context.newPage();

      try {
        // `page.goto("/")` on a manually launched browser does resolve against
        // baseURL: the runner installs it via playwright._defaultContextOptions,
        // which browser.newContext() merges. See the note at the bottom of this
        // file. The trace logs `navigating to "http://localhost:3000/"`.
        await page.goto("/", { waitUntil: "networkidle" });

        // Run Lighthouse audit (only works with Chromium)
        const config = await import("../../lighthouse.config.js");
        // A projection of CI's score sets a CPU multiplier; its log says so,
        // so that it cannot pass for CI's (lighthouse.config.js).
        const multiplier =
          config.default.settings.throttling.cpuSlowdownMultiplier;
        const projected =
          multiplier === 1 ? "" : `, CPU multiplier ${multiplier}`;
        const audits: Audit[] = [];
        for (let run = 1; run <= AUDITS; run++) {
          const lighthouseReport = await playAudit({
            page: page,
            config: config.default,
            port: 9222, // Required port for Chrome DevTools Protocol
            // playwright-lighthouse runs only the categories named here, and
            // Lighthouse 13 rejects an unknown one, such as the PWA category
            // that Lighthouse 12 removed. It logs each run against these;
            // the assertions below read the median instead of one run.
            thresholds: {
              performance: PERFORMANCE_THRESHOLDS.chromium.performance,
              accessibility: 85,
              "best-practices": 75,
              seo: 80,
            },
            ignoreError: true,
            opts: {
              // A first visit each time. playwright-lighthouse keeps the
              // cache between audits (disableStorageReset: true), so the
              // second and third measured a repeat visit: FCP 449 then 192
              // ms. The first audit was cold either way: all its scripts
              // came over the network despite the warm-up visit above.
              disableStorageReset: false,
            },
          });
          const audit = readAudit(lighthouseReport.lhr as unknown as Lhr);
          audits.push(audit);
          // The job log keeps every run's numbers: CI recorded only the
          // four scores, so a passing run could not calibrate anything.
          console.log(
            `Lighthouse run ${run}/${AUDITS}: ${describeAudit(audit)}${projected}`,
          );
        }
        const { scores, metrics, benchmarkIndex } = medianAudit(audits);
        console.log(
          `Lighthouse median: ${describeAudit({ scores, metrics, benchmarkIndex })}${projected}`,
        );
        await testInfo.attach("lighthouse-audits.json", {
          body: JSON.stringify(
            { audits, median: { scores, metrics } },
            null,
            2,
          ),
          contentType: "application/json",
        });

        // Create result object
        const result: LighthouseResult = {
          browserName: browserInfo.name,
          timestamp: new Date().toISOString(),
          scores,
          metrics,
        };

        // Save results and update history
        saveLighthouseResults(result);
        updatePerformanceHistory(result);

        // Check for performance regression
        const regressionCheck = checkPerformanceRegression(result);
        if (regressionCheck.hasRegression) {
          console.warn(
            `Performance regression detected in ${browserInfo.name}:`,
          );
          regressionCheck.regressions.forEach((regression) => {
            console.warn(
              `- ${regression.metric}: ${regression.current.toFixed(2)} (was ${regression.baseline.toFixed(2)}, +${regression.change.toFixed(1)}%)`,
            );
          });
        }

        // Get browser-specific thresholds
        const thresholds =
          PERFORMANCE_THRESHOLDS[
            browserInfo.name as keyof typeof PERFORMANCE_THRESHOLDS
          ];

        // Performance assertions
        expect(
          scores.performance,
          `Performance score should be >= ${thresholds.performance} in ${browserInfo.name}`,
        ).toBeGreaterThanOrEqual(thresholds.performance);

        // Core Web Vitals assertions
        expect(
          metrics.fcp,
          `FCP should be < ${thresholds.fcp}ms in ${browserInfo.name}`,
        ).toBeLessThan(thresholds.fcp);

        expect(
          metrics.lcp,
          `LCP should be < ${thresholds.lcp}ms in ${browserInfo.name}`,
        ).toBeLessThan(thresholds.lcp);

        expect(
          metrics.cls,
          `CLS should be < ${thresholds.cls} in ${browserInfo.name}`,
        ).toBeLessThan(thresholds.cls);

        expect(
          metrics.tbt,
          `TBT should be < ${thresholds.tbt}ms in ${browserInfo.name}`,
        ).toBeLessThan(thresholds.tbt);

        expect(
          metrics.tti,
          `TTI should be < ${thresholds.tti}ms in ${browserInfo.name}`,
        ).toBeLessThan(thresholds.tti);

        // Accessibility should be high across all browsers
        expect(
          scores.accessibility,
          `Accessibility score should be >= 85 in ${browserInfo.name}`,
        ).toBeGreaterThanOrEqual(85); // 100 on 2026-10-18

        // Best practices should be high
        expect(
          scores.bestPractices,
          `Best practices score should be >= 75 in ${browserInfo.name}`,
        ).toBeGreaterThanOrEqual(75); // 96 on 2026-10-18: console errors, no GitHub data

        // SEO should be good
        expect(
          scores.seo,
          `SEO score should be >= 80 in ${browserInfo.name}`,
        ).toBeGreaterThanOrEqual(80); // 100 on 2026-10-18

        // Fail test if regression detected (optional - can be configured)
        if (
          process.env.FAIL_ON_REGRESSION === "true" &&
          regressionCheck.hasRegression
        ) {
          throw new Error(
            `Performance regression detected: ${regressionCheck.regressions.map((r) => r.metric).join(", ")}`,
          );
        }
      } finally {
        await context.close();
        await browser.close();
      }
    });
  }

  /**
   * DEFUSED 2026-08-03. What this was, and what changed:
   *
   * It reads `test-results/lighthouse/performance-history.json`, which only the
   * audit test above ever writes, and which Playwright deletes at the start of
   * every run along with the rest of `test-results`. In a normal run it started
   * before the ~40s audit had written anything, found an empty history, and
   * skipped. That race was the only reason it was green. Forced to see data
   * (`--workers=1`) it failed immediately:
   *
   *   Critical performance issues detected: chromium: Performance score
   *   below 80 (76)
   *
   * Three fixes, none of which relax what is actually being measured:
   *
   *   1. The describe block is now `serial`, and the history is read through
   *      waitForPerformanceHistory(), so this test observes the audit's output
   *      instead of racing it.
   *   2. The score gates read PERFORMANCE_THRESHOLDS at the top of this file
   *      rather than carrying their own 80 and 85. The file used to contradict
   *      itself: chromium's declared threshold is 60, annotated "Production
   *      baseline (actual: 62)", while this test demanded 80 and an 85 average.
   *      One source of truth now; changing the bar means editing
   *      PERFORMANCE_THRESHOLDS, where the annotations live.
   *   3. The title said "cross-browser". `browsers` above is `[chromium]`, so
   *      the history only ever holds chromium and the "average across browsers"
   *      was an average of one number. The title and the summary field names
   *      now say what it measures. The webkit/firefox lookups stay: they cost
   *      nothing, and if `browsers` grows the report grows with it.
   *
   * The LCP and CLS critical-issue checks below read the table too. They were
   * hardcoded at 4000 and 0.25 while the table said 4000 and 0.35; since the
   * 2026-10-17 limits (2000 and 0.1) the table is the stricter of the two.
   */
  test("should report Lighthouse scores for every audited browser", async ({}, testInfo) => {
    // The audit test only runs on the chromium project (Lighthouse needs CDP),
    // so only there is there anything to wait for. Gate on the project before
    // waiting, or the firefox/webkit/mobile projects would each sit out the
    // full wait for data that is never coming - and blow the 60s local test
    // timeout doing it. Without the gate they would also read chromium's
    // numbers out of the shared test-results directory and assert on them as
    // if they were their own.
    const projectName = testInfo.project.name || "";
    if (!projectName.toLowerCase().includes("chromium")) {
      test.skip(
        true,
        `Lighthouse history is written only by the chromium project (current project: ${projectName})`,
      );
      return;
    }

    const audited = browsers.map((b) => b.name);
    // Generous but bounded: the audit takes ~40s and describe.serial means it
    // has already finished, so this returns on the first poll in practice.
    const history = waitForPerformanceHistory(audited[0], 60000);

    if (history.length === 0) {
      test.skip(
        true,
        `no lighthouse history: the audit test above did not write test-results/lighthouse/performance-history.json within 60s (audited: ${audited.join(", ")})`,
      );
      return;
    }

    // Get latest results for each browser
    const latestResults = Object.fromEntries(
      ["chromium", "webkit", "firefox"].map((browser) => [
        browser,
        history
          .filter((r) => r.browserName === browser)
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          )[0],
      ]),
    );

    // Generate comparison report
    const comparisonReport = {
      timestamp: new Date().toISOString(),
      browsers: latestResults,
      summary: {
        bestPerformance: "",
        worstPerformance: "",
        avgPerformanceScore: 0,
        criticalIssues: [] as string[],
      },
    };

    // Calculate summary
    const validResults = Object.values(latestResults).filter(Boolean);
    if (validResults.length > 0) {
      comparisonReport.summary.avgPerformanceScore =
        validResults.reduce((sum, r) => sum + r.scores.performance, 0) /
        validResults.length;

      const sortedByPerf = validResults.sort(
        (a, b) => b.scores.performance - a.scores.performance,
      );
      comparisonReport.summary.bestPerformance =
        sortedByPerf[0]?.browserName || "unknown";
      comparisonReport.summary.worstPerformance =
        sortedByPerf[sortedByPerf.length - 1]?.browserName || "unknown";

      // Identify critical issues. The bar is whatever PERFORMANCE_THRESHOLDS
      // declares for that browser, not a second number kept in this test.
      validResults.forEach((result) => {
        const limits =
          PERFORMANCE_THRESHOLDS[
            result.browserName as keyof typeof PERFORMANCE_THRESHOLDS
          ];
        const minPerformance = limits.performance;
        if (result.scores.performance < minPerformance) {
          comparisonReport.summary.criticalIssues.push(
            `${result.browserName}: Performance score below ${minPerformance} (${result.scores.performance})`,
          );
        }
        if (result.metrics.lcp > limits.lcp) {
          comparisonReport.summary.criticalIssues.push(
            `${result.browserName}: LCP above ${limits.lcp}ms (${result.metrics.lcp.toFixed(0)}ms)`,
          );
        }
        if (result.metrics.cls > limits.cls) {
          comparisonReport.summary.criticalIssues.push(
            `${result.browserName}: CLS above ${limits.cls} (${result.metrics.cls.toFixed(3)})`,
          );
        }
      });
    }

    // Save comparison report
    const reportPath = path.join(RESULTS_DIR, "cross-browser-comparison.json");
    fs.writeFileSync(reportPath, JSON.stringify(comparisonReport, null, 2));
    // console.log(`Cross-browser comparison saved to: ${reportPath}`);

    // Assert no critical issues
    expect(
      comparisonReport.summary.criticalIssues,
      `Critical performance issues detected: ${comparisonReport.summary.criticalIssues.join("; ")}`,
    ).toHaveLength(0);

    // Assert average performance is acceptable. The expected average is built
    // from the same PERFORMANCE_THRESHOLDS entries as the browsers that
    // actually reported, so adding a browser to `browsers` moves this bar
    // automatically instead of silently making it unreachable.
    const expectedAvg =
      Object.values(latestResults)
        .filter(Boolean)
        .reduce(
          (sum, r) =>
            sum +
            PERFORMANCE_THRESHOLDS[
              r.browserName as keyof typeof PERFORMANCE_THRESHOLDS
            ].performance,
          0,
        ) / Object.values(latestResults).filter(Boolean).length;

    expect(
      comparisonReport.summary.avgPerformanceScore,
      `Average performance score across audited browsers (${Object.values(
        latestResults,
      )
        .filter(Boolean)
        .map((r) => r.browserName)
        .join(", ")}) should be >= ${expectedAvg}`,
    ).toBeGreaterThanOrEqual(expectedAvg);
  });
});

// The "Safari-Specific Performance" describe block that used to sit here was
// deleted rather than re-enabled.
//
// CORRECTION (2026-08-03). The note left here previously gave as its first
// reason that "`baseURL` is a fixture option and is not applied to a manually
// launched browser, so the relative navigation threw". That is wrong, and it
// matters, because the same reasoning was applied to the audit test above.
// Under the Playwright test runner, `browser.newContext()` merges
// `playwright._defaultContextOptions` (node_modules/playwright-core/lib/client/
// browser.js:67), which the runner populates from the project's `use` block
// including baseURL (node_modules/playwright/lib/index.js:222 and :208). A
// manually launched browser therefore *does* resolve `page.goto("/")` against
// baseURL. Proof: the trace for the audit test above logs
// `navigating to "http://localhost:3000/"` for its `page.goto("/")`, and the
// audit completes with real scores. Only a bare `chromium.launch()` outside
// the runner throws "Cannot navigate to invalid URL".
//
// What does hold: `page.goto("/", { waitUntil: "networkidle" })` times out in
// WebKit against `next dev` (the same failure mode takes out nine
// performance.spec.ts tests on the Mobile Safari project), and both deleted
// tests were hardware-dependent micro-benchmarks whose assertions had drifted
// away from their own titles - the "55+ FPS" test asserted `averageFps > 30`
// with the comment "actual: ~31 FPS" and `minFps > 1`, and the
// "backdrop-filter performance" test measured how long the browser took to
// schedule the next animation frame after appending ten divs, which is rAF
// scheduling latency rather than the cost of the filter. Safari is exercised
// for real by the desktop `webkit` project across the navigation,
// accessibility and terminal specs.
