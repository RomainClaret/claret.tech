import { test, expect } from "./utils/fixtures";
import { gotoWithoutScripts } from "./utils/no-script";

test.describe("Performance", () => {
  // Load timings and input delay are Lighthouse's (lighthouse.spec.ts), under
  // throttling and against real budgets: FCP 1.5 s, LCP 2 s, TBT 1 s, TTI
  // 3 s. This file had them too, at 8, 7 and 25 s in CI, and an input delay
  // read after a synthetic click, which records no first input, so 0 every
  // time. First Input Delay is not a Core Web Vital since 2024 either.
  //
  // Layout shift is Lighthouse's too. This file measured it for 3 s after
  // load, and it stayed under 0.1 even with the hero's placeholder at no
  // height, which the brains then push open (most likely because they arrive
  // while the splash covers the page), so it caught nothing a visitor sees.
  test("should optimize images", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const imageOptimization = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll("img"));

      return {
        totalImages: images.length,
        lazyLoaded: images.filter(
          (img) =>
            img.loading === "lazy" ||
            img.dataset.src ||
            img.classList.toString().includes("lazy"),
        ).length,
        withAlt: images.filter((img) => img.alt).length,
        modernFormats: images.filter(
          (img) =>
            img.src.includes(".webp") ||
            img.src.includes(".avif") ||
            img.srcset?.includes(".webp") ||
            img.srcset?.includes(".avif"),
        ).length,
        responsive: images.filter(
          (img) =>
            img.srcset ||
            img.sizes ||
            window.getComputedStyle(img).maxWidth === "100%",
        ).length,
      };
    });

    // Most images should be optimized
    if (imageOptimization.totalImages > 0) {
      const lazyLoadRatio =
        imageOptimization.lazyLoaded / imageOptimization.totalImages;
      const altTextRatio =
        imageOptimization.withAlt / imageOptimization.totalImages;
      const responsiveRatio =
        imageOptimization.responsive / imageOptimization.totalImages;

      // At least 30% of images should be lazy loaded (hero images may not be)
      expect(lazyLoadRatio).toBeGreaterThan(0.3);
      // Most images should have alt text (90% is acceptable)
      expect(altTextRatio).toBeGreaterThan(0.9);
      // Most images should be responsive
      expect(responsiveRatio).toBeGreaterThan(0.7);
    }
  });

  test("should have efficient JavaScript bundles", async ({
    page,
    browserName,
  }) => {
    // Coverage API is only available in Chromium
    if (browserName !== "chromium") {
      test.skip();
      return;
    }

    await page.coverage.startJSCoverage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Interact with the page to execute more code
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await page.waitForTimeout(1000);

    const jsCoverage = await page.coverage.stopJSCoverage();

    // The bytes that ran. V8 lists each function's ranges with a run count,
    // nested, and unused code too (count 0): summed as they came, the "used"
    // share read 3.54 on 2026-10-17. A byte takes its innermost range's
    // count, so outer ranges are applied first.
    let totalBytes = 0;
    let usedBytes = 0;
    for (const entry of jsCoverage) {
      const length = entry.source?.length ?? 0;
      totalBytes += length;
      const counts = new Uint32Array(length);
      const ranges = entry.functions
        .flatMap((fn) => fn.ranges)
        .sort(
          (a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset,
        );
      for (const range of ranges) {
        counts.fill(
          range.count,
          range.startOffset,
          Math.min(range.endOffset, length),
        );
      }
      usedBytes += counts.filter((count) => count > 0).length;
    }

    // Production build: 1,290 KB of JavaScript on 2026-10-17, 0.59 to 0.60
    // of it run, and 1,321 KB on 2026-10-20 (three runs). The limit was
    // 2,000 KB, room for the whole terminal (xterm alone is 334 KB) to load
    // with the page unnoticed; 1,500 is 14% above the measure.
    expect(usedBytes / totalBytes).toBeGreaterThan(0.5);
    expect(totalBytes / 1024).toBeLessThan(1500);
  });

  test("should have efficient CSS", async ({ page, browserName, isMobile }) => {
    // Coverage API is only available in Chromium, skip on mobile due to different performance characteristics
    if (browserName !== "chromium" || isMobile) {
      test.skip();
      return;
    }

    await page.coverage.startCSSCoverage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Scroll to trigger more CSS usage
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(1000);

    const cssCoverage = await page.coverage.stopCSSCoverage();

    // Analyze CSS coverage
    let totalBytes = 0;
    let usedBytes = 0;

    for (const entry of cssCoverage) {
      // Use the source length if text is not available
      const textLength = (entry as any).text?.length || 1000;
      totalBytes += textLength;

      // CSS coverage should have ranges
      if ((entry as any).ranges) {
        for (const range of (entry as any).ranges) {
          usedBytes += range.end - range.start;
        }
      }
    }

    const usageRatio = totalBytes > 0 ? usedBytes / totalBytes : 1;
    const totalKB = totalBytes / 1024;

    // Production build, 2026-10-20, five runs: 157 KB in four stylesheets,
    // 0.934 of it used, every run. The limits were 600 KB and 0.25 ("the
    // production baseline: ~30%"), which a stylesheet three times larger and
    // mostly unused passed. These are the highest run plus 15%, and a used
    // share Tailwind's generated CSS stays well above.
    expect(usageRatio).toBeGreaterThan(0.8);
    expect(totalKB).toBeLessThan(181);
  });

  test("should minimize network requests", async ({ page }) => {
    const requests: { url: string; method: string; resourceType: string }[] =
      [];

    page.on("request", (request) => {
      requests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
      });
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Analyze requests
    const requestsByType = requests.reduce(
      (acc, req) => {
        acc[req.resourceType] = (acc[req.resourceType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Measured on 2026-10-20: 31 scripts, 2 stylesheets, 2 fonts and 46
    // requests in all on a desktop (30 scripts on a phone, which skips the
    // constellation's chunk). Round 25 fetched 23 scripts: this round moved
    // code the page needs only after hydration into chunks of their own,
    // fetched then, for 31 KB less JavaScript before it. Highest measured
    // plus 15%; the limits were 30, 15, 15 and 100.
    expect(requestsByType.script || 0).toBeLessThan(36);
    expect(requestsByType.stylesheet || 0).toBeLessThanOrEqual(3);
    expect(requestsByType.font || 0).toBeLessThanOrEqual(3);
    expect(requests.length).toBeLessThan(53);
  });

  test("should cache static assets", async ({ page, request }) => {
    // It counted the cached responses as `>= 0`, so no header at all passed.
    // The rules in next.config.mjs's headers(), and Next's own for chunks.
    const cacheControl = async (path: string) =>
      (await request.get(path)).headers()["cache-control"];
    const year = "public, max-age=31536000, immutable";

    for (const path of [
      "/images/ucd_logo.webp",
      "/fonts/Montserrat-Regular.woff2",
      "/animations/graphNetworkBlueAnimation.v2.json",
    ]) {
      expect(await cacheControl(path), path).toBe(year);
    }
    // Replaced under the same name at times: a day, then revalidated.
    expect(await cacheControl("/pdfs/CV_RomainClaret.pdf")).toBe(
      "public, max-age=86400, stale-while-revalidate=2592000",
    );

    const chunk = page.waitForResponse((response) =>
      /^\/_next\/static\/chunks\/.+\.js$/.test(
        new URL(response.url()).pathname,
      ),
    );
    await page.goto("/");
    expect((await chunk).headers()["cache-control"]).toContain("immutable");
  });

  test("should have fast Time to First Byte", async ({ page }) => {
    const startTime = Date.now();
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    const ttfb = Date.now() - startTime;

    // TTFB should be reasonable for production
    // CI environments are naturally slower, so we use a more lenient threshold (increased based on actual performance)
    const ttfbThreshold = process.env.CI ? 5000 : 2000;
    expect(ttfb).toBeLessThan(ttfbThreshold); // TTFB < 5s for CI, < 2s for local

    // Check response status
    expect(response?.status()).toBe(200);
  });

  test("should handle slow network gracefully", async ({
    browser,
    browserName,
  }) => {
    // Create a new context
    const context = await browser.newContext();
    const slowPage = await context.newPage();

    // Use Chrome DevTools Protocol for network throttling if available (Chromium only)
    if (browserName === "chromium") {
      try {
        const client = await context.newCDPSession(slowPage);
        // Emulate slow 3G network conditions
        await client.send("Network.emulateNetworkConditions", {
          offline: false,
          downloadThroughput: (500 * 1024) / 8, // 500 kbps
          uploadThroughput: (500 * 1024) / 8,
          latency: 400,
        });
      } catch {
        // CDP not available, continue without network throttling
        console.log("Network throttling not available");
      }
    }

    const startTime = Date.now();
    await slowPage.goto("/", { waitUntil: "domcontentloaded" });
    const loadTime = Date.now() - startTime;

    // Even on slow network, initial content should load within reasonable time (increased for CI stability)
    const slowNetworkThreshold = process.env.CI ? 15000 : 10000;
    expect(loadTime).toBeLessThan(slowNetworkThreshold);

    // Check that critical content is visible
    const heading = slowPage.locator("h1");
    await expect(heading).toBeVisible({ timeout: 5000 });

    await context.close();
  });

  test("should not have console errors", async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Wait a bit for any async errors
    await page.waitForTimeout(2000);

    // Filter out acceptable warnings and expected test environment errors
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes("hydration") &&
        !error.includes("DevTools") &&
        !error.includes("[HMR]") &&
        !error.includes("hot update") &&
        // API errors are expected in test environment without mock backend
        !error.includes("Failed to load resource") &&
        !error.includes("404") &&
        !error.includes("500") &&
        !error.includes("fetch-github") &&
        !error.includes("fetch-all-repos") &&
        !error.includes("fetchPinnedProjects") &&
        !error.includes("Unexpected token '<'") && // HTML responses instead of JSON
        !error.includes("is not valid JSON"),
    );

    expect(criticalErrors).toHaveLength(0);
  });

  /**
   * This test guards the deletion of src/app/loading.tsx. Do not add that file
   * back without reading this.
   *
   * A `loading.tsx` in a route segment is not just a fallback UI: its mere
   * existence makes Next wrap the segment in a Suspense boundary
   * (next/dist/client/components/layout-router.js, the boundary is created only
   * when a loading module is present). The homepage subtree does not fill that
   * boundary before the shell flushes, so the whole page shipped inside
   * `<div hidden id="S:1">` with an inline `$RC("B:1","S:1")` script to unhide
   * it. With JS that is invisible. With JS off nothing ran the script, so
   * `[hidden]:where(:not([hidden="until-found"])) => display: none` kept every
   * section collapsed and the page was blank, not degraded.
   *
   * The old file returned `null` and its own comment said the real loading UI
   * is SplashScreen, so it bought nothing and cost the whole no-JS render.
   *
   * The five BAILOUT_TO_CLIENT_SIDE_RENDERING markers in the HTML are NOT the
   * cause and are still there today. next/dist/shared/lib/lazy-dynamic/
   * loadable.js wraps every `ssr:false` import in its own Suspense, so those
   * bailouts are always local, and app-wrapper.tsx renders `{children}` as a
   * sibling of them, not a descendant.
   *
   * Cost of the deletion, measured 2026-08-04 on two clean production builds
   * (`npm run build` + `npm start`), 7 navigations each, medians:
   *
   *              TTFB     FCP     LCP
   *   with     21.6ms   120ms   120ms
   *   without  21.4ms   116ms   132ms
   *
   * First load is unchanged. Giving up the streaming boundary was expected to
   * cost TTFB, because the server can no longer flush a shell before the page
   * is rendered; it does not here, because the homepage does no server-side
   * data fetching, so there was never a slow render for streaming to hide.
   *
   * Measure against `npm start`, never `npm run dev`. A reading of TTFB 336ms
   * / FCP 436ms taken here during this work came from a dev server, which
   * compiles on demand; it says nothing about production and does not
   * reproduce on a build.
   *
   * Isolating the server alone with an A-B-A benchmark (60 samples per state,
   * no browser, swapping the built .next under one `next start`) puts the
   * drift between two identical runs at 1.59ms, wider than the gap between
   * the two states. The wire cost is +1,493 gzipped bytes (+2.5%), one extra
   * TCP segment, which is the only first-load regression that survives.
   *
   * Soft navigation is the part that visibly changes, and it changes for the
   * better. The only one this site performs is back to `/` from a /pdf/<slug>
   * page via the nav bar: nothing anywhere renders a Link or a router.push
   * INTO /pdf/*, so that direction is always a fresh document load.
   *
   * At 1200ms emulated RTT, the old behavior committed the route switch in
   * 42ms - to 689 characters of body text. That frame is the nav bar with the
   * footer collapsed directly beneath it and nothing in between, held for
   * ~2.9s, which reads as a broken page rather than a loading one. With the
   * boundary gone the router waits for the RSC payload, so the document the
   * reader was already looking at stays fully painted for the same ~2.9s and
   * the homepage then appears complete. Same time to content, no broken frame.
   *
   * So do not re-add this file to "fix" navigation latency; the latency was
   * always there, the old version just rendered something misleading during it.
   *
   * Mutation-proven: restore src/app/loading.tsx, rebuild, and this test fails
   * on chromium and webkit with `unexpected value "hidden"`.
   */
  test("should support progressive enhancement", async ({ browser }) => {
    // Create a new context with JavaScript disabled
    const context = await browser.newContext({
      javaScriptEnabled: false,
    });
    const page = await context.newPage();

    await gotoWithoutScripts(page);

    // Core content should still be visible without JavaScript
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();

    // Navigation should still exist
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();

    // Main sections should be present
    const sections = page.locator("section");
    const sectionCount = await sections.count();
    expect(sectionCount).toBeGreaterThan(3); // > 3 sections is acceptable

    // Close the context when done
    await context.close();
  });

  test("should optimize web fonts", async ({ page }) => {
    // A face without font-display only logged a warning, and "prefer WOFF2"
    // checked that a .woff2 URL contained ".woff2".
    const fonts: { url: string; status: number }[] = [];
    page.on("response", (response) => {
      if (/\.(woff2?|ttf|otf)$/.test(new URL(response.url()).pathname)) {
        fonts.push({ url: response.url(), status: response.status() });
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const faces = await page.evaluate(() =>
      Array.from(document.styleSheets)
        .flatMap((sheet) => {
          try {
            return Array.from(sheet.cssRules);
          } catch {
            return [];
          }
        })
        .filter((rule) => rule instanceof CSSFontFaceRule)
        .map((rule) => {
          const style = (rule as CSSFontFaceRule).style;
          return {
            src: style.getPropertyValue("src"),
            display: style.getPropertyValue("font-display"),
          };
        }),
    );

    // Montserrat's two faces (layout.tsx): text shows in the fallback font
    // until each arrives. The fallback's own face, local("Arial") with
    // next/font's metric overrides, downloads nothing and declares none.
    const downloaded = faces.filter((face) => face.src.includes("url("));
    expect(downloaded.length).toBeGreaterThanOrEqual(2);
    for (const face of downloaded) {
      expect(face.display, face.src).toBe("swap");
    }
    expect(fonts.length).toBeGreaterThan(0);
    for (const font of fonts) {
      expect(font.status, font.url).toBe(200);
      expect(font.url, font.url).toMatch(/\.woff2$/);
    }
  });

  test("should have reasonable memory usage", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Interact with the page
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(500);
    }

    // Check memory usage (if available)
    const metrics = await page.evaluate(() => {
      if ("memory" in performance) {
        return (
          performance as {
            memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
          }
        ).memory;
      }
      return null;
    });

    if (metrics) {
      const usedMB = metrics.usedJSHeapSize / 1024 / 1024;
      const totalMB = metrics.totalJSHeapSize / 1024 / 1024;

      // Reasonable memory usage (less than 100MB used)
      // Skip if metrics are not available (NaN)
      if (!isNaN(usedMB)) {
        expect(usedMB).toBeLessThan(200); // < 200MB is acceptable
      }

      // Not too much memory allocated (less than 200MB total)
      if (!isNaN(totalMB)) {
        expect(totalMB).toBeLessThan(400); // < 400MB is acceptable
      }
    }
  });

  /**
   * This used to open with `if (process.env.CI) { test.skip(); return; }`,
   * commented "CI environments have limited GPU capabilities", so the only
   * animation budget in the suite had never run on the only machine that gates
   * merges. The excuse does not survive measurement.
   *
   * Control run (headless Chromium, same machine, same 60-sample rAF probe,
   * 3 samples each, 2026-08-03):
   *
   *   about:blank                    121 fps,  0/60 frames over 20ms
   *   static 5000px-tall page        121 fps,  0/60
   *   claret.tech /                48-62 fps, 14-24/60
   *   ... with the two <canvas> removed        69-85 fps,  4-12/60
   *   ... with prefers-reduced-motion: reduce  79-112 fps, 1-9/60
   *
   * The browser renders an empty page at 120 fps with zero long frames, so the
   * 23-40% figure the site produces is the site's own cost, not headless
   * jitter or a missing GPU. Removing the canvases or honoring reduced motion
   * recovers most of it.
   *
   * The animations did get cheaper (see the perf commit that scoped the grid
   * transition, dropped a pointless 64px blur and gave the canvases a repaint
   * budget): locally this went from 33-48 fps with 20-37 long frames to
   * 103-120 fps with 0-1, mutation-controlled against the unfixed build.
   *
   * It still cannot pass on a GitHub-hosted runner. First run there, same
   * commit: 13 fps with 60/60 frames over 20ms, and 25 fps with 56/60. Those
   * boxes are 2 vCPU with llvmpipe software rendering and no GPU.
   *
   * So it is skipped on CI again - which the previous version of this comment
   * told you not to do, and that instruction was written before anyone had a
   * number from the runner. Be aware of what is NOT established: the control
   * that proves this is the runner rather than the site (empty page at 120 fps,
   * 0 long frames) was measured on a developer laptop. Nobody has measured what
   * a GitHub runner does with an empty page, so "the runner cannot do it" is
   * inference, not measurement.
   *
   * The real fix is to stop asserting an absolute frame rate on unspecified
   * hardware. Measure about:blank in the same browser first and assert the site
   * is within a factor of that, and the test becomes portable and keeps its
   * teeth. Until then it guards local runs, where it caught a genuine 2.5x
   * regression, and CI does not gate on it.
   */
  test("should handle animations efficiently", async ({ page }) => {
    test.skip(
      !!process.env.CI,
      "absolute fps gate, and a GitHub runner is 2 vCPU with software rendering: measured 13 fps / 60-of-60 long frames there against 103-120 fps / 0-of-60 on a laptop, same commit. See the comment above before removing this.",
    );

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Measure animation performance
    const animationMetrics = await page.evaluate(() => {
      return new Promise<{
        avgFps: number;
        droppedFrames: number;
        totalFrames: number;
      }>((resolve) => {
        const frames: number[] = [];
        let lastTime = performance.now();

        const measureFrame = () => {
          const currentTime = performance.now();
          const delta = currentTime - lastTime;
          frames.push(delta);
          lastTime = currentTime;

          if (frames.length < 60) {
            requestAnimationFrame(measureFrame);
          } else {
            // Calculate FPS statistics
            const avgDelta = frames.reduce((a, b) => a + b, 0) / frames.length;
            const fps = 1000 / avgDelta;
            const droppedFrames = frames.filter((d) => d > 20).length; // Frames taking > 20ms

            resolve({
              avgFps: Math.round(fps),
              droppedFrames,
              totalFrames: frames.length,
            });
          }
        };

        // Trigger some animations by scrolling
        window.scrollTo({ top: 500, behavior: "smooth" });
        requestAnimationFrame(measureFrame);
      });
    });

    const droppedRatio =
      animationMetrics.droppedFrames / animationMetrics.totalFrames;
    const measured = `measured ${animationMetrics.avgFps} fps, ${animationMetrics.droppedFrames}/${animationMetrics.totalFrames} frames over 20ms`;

    // Should maintain close to 60 FPS
    expect(animationMetrics.avgFps, measured).toBeGreaterThan(24); // > 24 FPS is acceptable

    // Should have minimal dropped frames
    expect(droppedRatio, measured).toBeLessThanOrEqual(0.2); // Less than or equal to 20% dropped frames
  });
});
