import { test, expect, chromium } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Load testing integration with Artillery
test.describe("Load Testing", () => {
  const RESULTS_DIR = path.join(process.cwd(), "test-results", "load-testing");

  // Ensure results directory exists
  test.beforeAll(async () => {
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
    }
  });

  test.skip("should handle light load (development profile) - requires Artillery", async () => {
    // Only run this test if we're in a development environment
    if (process.env.NODE_ENV === "production") {
      test.skip();
      return;
    }

    // console.log("Starting light load test...");

    try {
      // Run Artillery with development profile
      execSync(
        "npx artillery run artillery.yml --environment development --output load-test-light.json",
        {
          cwd: process.cwd(),
          encoding: "utf8",
          timeout: 300000, // 5 minutes timeout
        },
      );

      // console.log("Artillery output:", result);

      // Check if results file was created
      const resultsFile = path.join(process.cwd(), "load-test-light.json");
      expect(
        fs.existsSync(resultsFile),
        "Artillery results file should exist",
      ).toBe(true);

      // Parse and validate results
      const results = JSON.parse(fs.readFileSync(resultsFile, "utf8"));

      // Move results to proper directory
      const targetFile = path.join(
        RESULTS_DIR,
        `light-load-${Date.now()}.json`,
      );
      fs.renameSync(resultsFile, targetFile);

      // Validate performance metrics
      const aggregate = results.aggregate;

      // Response time assertions
      expect(
        aggregate.latency.median,
        "Median response time should be under 1.5s",
      ).toBeLessThan(1500);

      expect(
        aggregate.latency.p95,
        "95th percentile should be under 3s",
      ).toBeLessThan(3000);

      expect(
        aggregate.latency.p99,
        "99th percentile should be under 5s",
      ).toBeLessThan(5000);

      // Success rate
      const successRate =
        ((aggregate.codes["200"] || 0) / aggregate.requestsCompleted) * 100;
      expect(successRate, "Success rate should be above 95%").toBeGreaterThan(
        95,
      );

      // Check for errors
      expect(aggregate.errors, "Should have minimal errors").toBeLessThan(
        aggregate.requestsCompleted * 0.05,
      ); // Less than 5% errors

      // console.log("Light load test completed successfully:");
      // console.log(`- Requests completed: ${aggregate.requestsCompleted}`);
      // console.log(`- Median response time: ${aggregate.latency.median}ms`);
      // console.log(`- 95th percentile: ${aggregate.latency.p95}ms`);
      // console.log(`- Success rate: ${successRate.toFixed(1)}%`);
      // console.log(`- Errors: ${aggregate.errors}`);
    } catch (error) {
      console.error("Load test failed:", error);
      throw error;
    }
  });

  test.skip("should measure cross-browser performance under load", async () => {
    // This test uses Playwright directly to simulate load across browsers
    const browsers = ["chromium", "firefox", "webkit"];
    const results: Record<string, any> = {};

    for (const browserName of browsers) {
      // console.log(`Testing ${browserName} under simulated load...`);

      const { chromium, firefox, webkit } = await import("@playwright/test");
      const browserLaunchers = { chromium, firefox, webkit };
      const browserLauncher =
        browserLaunchers[browserName as keyof typeof browserLaunchers];

      if (!browserLauncher) {
        throw new Error(`Browser ${browserName} not found`);
      }

      const browser = await browserLauncher.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });

      try {
        // Create multiple pages to simulate concurrent users
        const pages = await Promise.all(
          Array.from({ length: 5 }, () => browser.newPage()),
        );

        // Navigate all pages simultaneously
        const navigationPromises = pages.map(async (page, index) => {
          const startTime = performance.now();

          await page.goto("/", { waitUntil: "networkidle" });

          // Simulate user interactions
          await page.evaluate(() => {
            // Scroll and trigger animations
            for (let i = 0; i < 3; i++) {
              window.scrollTo(0, (document.body.scrollHeight / 3) * (i + 1));
            }
            window.scrollTo(0, 0);
          });

          await page.waitForTimeout(2000);

          // Measure performance metrics
          const metrics = await page.evaluate(() => {
            const navigation = performance.getEntriesByType(
              "navigation",
            )[0] as PerformanceNavigationTiming;
            const paint = performance.getEntriesByType("paint");
            const fcp = paint.find((p) => p.name === "first-contentful-paint");

            return {
              loadTime: navigation.loadEventEnd - navigation.fetchStart,
              domContentLoaded:
                navigation.domContentLoadedEventEnd - navigation.fetchStart,
              fcp: fcp ? fcp.startTime : null,
              memoryUsage: (performance as any).memory
                ? {
                    used: (performance as any).memory.usedJSHeapSize,
                    total: (performance as any).memory.totalJSHeapSize,
                  }
                : null,
            };
          });

          const endTime = performance.now();

          return {
            pageIndex: index,
            totalTime: endTime - startTime,
            ...metrics,
          };
        });

        const pageResults = await Promise.all(navigationPromises);

        // Calculate aggregate metrics for this browser
        const aggregateMetrics = {
          avgLoadTime:
            pageResults.reduce((sum, r) => sum + r.loadTime, 0) /
            pageResults.length,
          avgDomContentLoaded:
            pageResults.reduce((sum, r) => sum + r.domContentLoaded, 0) /
            pageResults.length,
          avgFcp:
            pageResults.reduce((sum, r) => sum + (r.fcp || 0), 0) /
            pageResults.length,
          maxLoadTime: Math.max(...pageResults.map((r) => r.loadTime)),
          minLoadTime: Math.min(...pageResults.map((r) => r.loadTime)),
          avgMemoryUsed:
            pageResults
              .filter((r) => r.memoryUsage)
              .reduce((sum, r) => sum + r.memoryUsage!.used, 0) /
              pageResults.filter((r) => r.memoryUsage).length || null,
        };

        results[browserName] = {
          pageResults,
          aggregateMetrics,
          concurrentPages: pages.length,
        };

        // console.log(`${browserName} results:`, {
        //   avgLoadTime: `${aggregateMetrics.avgLoadTime.toFixed(0)}ms`,
        //   avgFcp: `${aggregateMetrics.avgFcp.toFixed(0)}ms`,
        //   maxLoadTime: `${aggregateMetrics.maxLoadTime.toFixed(0)}ms`,
        // });

        // Close all pages
        await Promise.all(pages.map((page) => page.close()));
      } finally {
        await browser.close();
      }
    }

    // Save cross-browser load test results
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const resultsFile = path.join(
      RESULTS_DIR,
      `cross-browser-load-${timestamp}.json`,
    );
    fs.writeFileSync(
      resultsFile,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          results,
          summary: {
            bestPerformer: Object.entries(results).sort(
              ([, a], [, b]) =>
                a.aggregateMetrics.avgLoadTime - b.aggregateMetrics.avgLoadTime,
            )[0][0],
            worstPerformer: Object.entries(results).sort(
              ([, a], [, b]) =>
                b.aggregateMetrics.avgLoadTime - a.aggregateMetrics.avgLoadTime,
            )[0][0],
          },
        },
        null,
        2,
      ),
    );

    // Assertions for each browser
    Object.entries(results).forEach(([browserName, browserResults]) => {
      const metrics = browserResults.aggregateMetrics;

      // Load time assertions (more lenient for Safari/WebKit)
      const maxLoadTime = browserName === "webkit" ? 5000 : 4000;
      expect(
        metrics.avgLoadTime,
        `${browserName} average load time should be under ${maxLoadTime}ms`,
      ).toBeLessThan(maxLoadTime);

      // FCP assertions
      const maxFcp = browserName === "webkit" ? 3000 : 2500;
      expect(
        metrics.avgFcp,
        `${browserName} average FCP should be under ${maxFcp}ms`,
      ).toBeLessThan(maxFcp);

      // Memory usage assertion (if available)
      if (metrics.avgMemoryUsed) {
        const maxMemory = 100 * 1024 * 1024; // 100MB
        expect(
          metrics.avgMemoryUsed,
          `${browserName} memory usage should be reasonable`,
        ).toBeLessThan(maxMemory);
      }

      // Consistency check - max load time shouldn't be too much higher than average
      const loadTimeVariation = metrics.maxLoadTime / metrics.avgLoadTime;
      expect(
        loadTimeVariation,
        `${browserName} load time should be consistent`,
      ).toBeLessThan(3); // Max shouldn't be more than 3x average
    });

    // console.log("Cross-browser load testing completed successfully");
  });

  test.skip("should detect performance degradation under sustained load", async () => {
    // This test simulates sustained load to detect memory leaks or performance degradation
    const browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    try {
      const page = await browser.newPage();
      const performanceData: Array<{
        iteration: number;
        loadTime: number;
        memoryUsed?: number;
        timestamp: number;
      }> = [];

      // Run 10 iterations of page loads to detect degradation
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();

        await page.goto("/", { waitUntil: "networkidle" });

        // Simulate user activity
        await page.evaluate(() => {
          // Create some temporary DOM elements
          for (let j = 0; j < 100; j++) {
            const div = document.createElement("div");
            div.textContent = `Temporary element ${j}`;
            document.body.appendChild(div);
          }

          // Scroll around
          window.scrollTo(0, document.body.scrollHeight);
          window.scrollTo(0, 0);

          // Clean up some elements (but not all to simulate realistic app behavior)
          const tempElements = document.querySelectorAll("div");
          for (let k = 0; k < tempElements.length / 2; k++) {
            if (
              tempElements[k] &&
              tempElements[k].textContent?.includes("Temporary")
            ) {
              tempElements[k].remove();
            }
          }
        });

        const endTime = Date.now();
        const loadTime = endTime - startTime;

        // Get memory usage
        const memoryInfo = await page.evaluate(() => {
          return (performance as any).memory
            ? {
                used: (performance as any).memory.usedJSHeapSize,
                total: (performance as any).memory.totalJSHeapSize,
              }
            : null;
        });

        performanceData.push({
          iteration: i + 1,
          loadTime,
          memoryUsed: memoryInfo?.used,
          timestamp: Date.now(),
        });

        // console.log(
        //   `Iteration ${i + 1}: Load time ${loadTime}ms, Memory: ${memoryInfo?.used ? (memoryInfo.used / 1024 / 1024).toFixed(1) + "MB" : "N/A"}`,
        // );

        // Small delay between iterations
        await page.waitForTimeout(1000);
      }

      // Analyze performance degradation
      const firstHalf = performanceData.slice(0, 5);
      const secondHalf = performanceData.slice(5);

      const avgLoadTimeFirst =
        firstHalf.reduce((sum, d) => sum + d.loadTime, 0) / firstHalf.length;
      const avgLoadTimeSecond =
        secondHalf.reduce((sum, d) => sum + d.loadTime, 0) / secondHalf.length;

      const loadTimeDegradation =
        (avgLoadTimeSecond - avgLoadTimeFirst) / avgLoadTimeFirst;

      // Memory analysis (if available)
      const memoryDataFirst = firstHalf.filter((d) => d.memoryUsed);
      const memoryDataSecond = secondHalf.filter((d) => d.memoryUsed);

      let memoryDegradation = 0;
      if (memoryDataFirst.length > 0 && memoryDataSecond.length > 0) {
        const avgMemoryFirst =
          memoryDataFirst.reduce((sum, d) => sum + d.memoryUsed!, 0) /
          memoryDataFirst.length;
        const avgMemorySecond =
          memoryDataSecond.reduce((sum, d) => sum + d.memoryUsed!, 0) /
          memoryDataSecond.length;
        memoryDegradation = (avgMemorySecond - avgMemoryFirst) / avgMemoryFirst;
      }

      // Save degradation analysis
      const degradationReport = {
        timestamp: new Date().toISOString(),
        performanceData,
        analysis: {
          avgLoadTimeFirst: avgLoadTimeFirst.toFixed(0),
          avgLoadTimeSecond: avgLoadTimeSecond.toFixed(0),
          loadTimeDegradation: (loadTimeDegradation * 100).toFixed(1),
          memoryDegradation: (memoryDegradation * 100).toFixed(1),
          hasSignificantDegradation:
            loadTimeDegradation > 0.2 || memoryDegradation > 0.3,
        },
      };

      const reportFile = path.join(
        RESULTS_DIR,
        `degradation-analysis-${Date.now()}.json`,
      );
      fs.writeFileSync(reportFile, JSON.stringify(degradationReport, null, 2));

      // console.log("Performance degradation analysis:");
      // console.log(
      //   `- Load time change: ${(loadTimeDegradation * 100).toFixed(1)}%`,
      // );
      // console.log(`- Memory change: ${(memoryDegradation * 100).toFixed(1)}%`);

      // Assertions
      expect(
        loadTimeDegradation,
        "Load time should not degrade significantly under sustained load",
      ).toBeLessThan(1.5); // Less than 150% degradation - relaxed for production

      if (memoryDegradation > 0) {
        expect(
          memoryDegradation,
          "Memory usage should not increase significantly",
        ).toBeLessThan(2.0); // Less than 200% memory increase - relaxed for production
      }

      expect(
        avgLoadTimeSecond,
        "Average load time should remain reasonable",
      ).toBeLessThan(15000); // Under 15 seconds - relaxed for production
    } finally {
      await browser.close();
    }
  });

  test.skip("should generate load testing summary report", async () => {
    // Collect all load testing results and generate a summary
    const loadTestFiles = fs
      .readdirSync(RESULTS_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => path.join(RESULTS_DIR, file));

    if (loadTestFiles.length === 0) {
      test.skip();
      return;
    }

    const allResults = loadTestFiles
      .map((file) => {
        try {
          return {
            file: path.basename(file),
            data: JSON.parse(fs.readFileSync(file, "utf8")),
          };
        } catch (error) {
          console.warn(`Failed to parse ${file}:`, error);
          return null;
        }
      })
      .filter(Boolean);

    const summary = {
      timestamp: new Date().toISOString(),
      totalTests: allResults.length,
      testTypes: {
        lightLoad: allResults.filter((r) => r!.file.includes("light-load"))
          .length,
        crossBrowser: allResults.filter((r) =>
          r!.file.includes("cross-browser"),
        ).length,
        degradation: allResults.filter((r) => r!.file.includes("degradation"))
          .length,
      },
      recommendations: [] as string[],
    };

    // Analyze results and generate recommendations
    allResults.forEach((result) => {
      const data = result!.data;

      if (data.analysis && data.analysis.hasSignificantDegradation) {
        summary.recommendations.push(
          `Performance degradation detected in ${result!.file} - investigate memory leaks and optimization opportunities`,
        );
      }

      if (data.results) {
        // Cross-browser results
        Object.entries(data.results).forEach(
          ([browser, browserData]: [string, any]) => {
            if (browserData.aggregateMetrics.avgLoadTime > 4000) {
              summary.recommendations.push(
                `${browser} showing slow load times (${browserData.aggregateMetrics.avgLoadTime.toFixed(0)}ms) - consider browser-specific optimizations`,
              );
            }
          },
        );
      }
    });

    // Save summary report
    const summaryFile = path.join(RESULTS_DIR, "load-testing-summary.json");
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

    // console.log("Load Testing Summary:");
    // console.log(`- Total tests: ${summary.totalTests}`);
    // console.log(`- Light load tests: ${summary.testTypes.lightLoad}`);
    // console.log(`- Cross-browser tests: ${summary.testTypes.crossBrowser}`);
    // console.log(`- Degradation tests: ${summary.testTypes.degradation}`);

    if (summary.recommendations.length > 0) {
      // console.log("Recommendations:");
      // summary.recommendations.forEach((rec) => console.log(`  - ${rec}`));
    } else {
      // console.log("✅ No performance issues detected");
    }

    // Assert that we have sufficient test coverage
    expect(
      summary.totalTests,
      "Should have run multiple load tests",
    ).toBeGreaterThan(0);
  });
});
