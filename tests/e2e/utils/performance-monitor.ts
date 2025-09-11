import { Page, TestInfo } from "@playwright/test";

interface LayoutShift {
  hadRecentInput: boolean;
  value: number;
}

export interface PerformanceMetrics {
  navigationStart: number;
  loadComplete: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay?: number;
  cumulativeLayoutShift: number;
  totalLoadTime: number;
}

export interface PerformanceThresholds {
  totalLoadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
}

/**
 * Browser-specific performance thresholds (in milliseconds)
 */
export const PERFORMANCE_THRESHOLDS: Record<string, PerformanceThresholds> = {
  chromium: {
    totalLoadTime: 5000,
    firstContentfulPaint: 2000,
    largestContentfulPaint: 3000,
    cumulativeLayoutShift: 0.1,
  },
  firefox: {
    totalLoadTime: 8000, // Firefox is typically slower in CI
    firstContentfulPaint: 3000,
    largestContentfulPaint: 4500,
    cumulativeLayoutShift: 0.15,
  },
  webkit: {
    totalLoadTime: 6500,
    firstContentfulPaint: 2500,
    largestContentfulPaint: 3500,
    cumulativeLayoutShift: 0.1,
  },
};

/**
 * Collect performance metrics from the page
 */
export async function collectPerformanceMetrics(
  page: Page,
): Promise<PerformanceMetrics> {
  return await page.evaluate(() => {
    const perfEntries = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming;

    // Get paint timing
    const paintEntries = performance.getEntriesByType("paint");
    const fcp =
      paintEntries.find((entry) => entry.name === "first-contentful-paint")
        ?.startTime || 0;

    // Get layout shift (if available)
    let cls = 0;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (
            entry.entryType === "layout-shift" &&
            !(entry as unknown as LayoutShift).hadRecentInput
          ) {
            cls += (entry as unknown as LayoutShift).value;
          }
        }
      });
      observer.observe({ entryTypes: ["layout-shift"] });
    } catch {
      // Layout shift not supported in this browser
    }

    const navigationStart = perfEntries.fetchStart || performance.timeOrigin;
    const loadComplete = perfEntries.loadEventEnd || performance.now();

    return {
      navigationStart,
      loadComplete,
      firstContentfulPaint: fcp,
      largestContentfulPaint: 0, // Will be updated by separate observer
      cumulativeLayoutShift: cls,
      totalLoadTime: loadComplete - navigationStart,
    };
  });
}

/**
 * Monitor Core Web Vitals during page load
 */
export async function monitorCoreWebVitals(
  page: Page,
): Promise<Partial<PerformanceMetrics>> {
  return await page.evaluate(() => {
    return new Promise((resolve) => {
      const metrics: Partial<PerformanceMetrics> = {};
      let metricsCollected = 0;
      const totalMetrics = 3; // FCP, LCP, CLS

      // Collect FCP
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") {
            metrics.firstContentfulPaint = entry.startTime;
            metricsCollected++;
          }
        }
        if (metricsCollected >= totalMetrics) resolve(metrics);
      });
      paintObserver.observe({ entryTypes: ["paint"] });

      // Collect LCP
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        metrics.largestContentfulPaint = lastEntry.startTime;
        metricsCollected++;
        if (metricsCollected >= totalMetrics) resolve(metrics);
      });
      lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });

      // Collect CLS
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as unknown as LayoutShift;
          if (!layoutShift.hadRecentInput) {
            clsValue += layoutShift.value;
          }
        }
        metrics.cumulativeLayoutShift = clsValue;
        metricsCollected++;
        if (metricsCollected >= totalMetrics) resolve(metrics);
      });
      clsObserver.observe({ entryTypes: ["layout-shift"] });

      // Fallback timeout
      setTimeout(() => {
        resolve(metrics);
      }, 10000);
    });
  });
}

/**
 * Check if performance metrics meet thresholds for given browser
 */
export function checkPerformanceThresholds(
  metrics: PerformanceMetrics,
  browserName: string,
  _testInfo?: TestInfo,
): { passed: boolean; violations: string[] } {
  const thresholds =
    PERFORMANCE_THRESHOLDS[browserName] || PERFORMANCE_THRESHOLDS.chromium;
  const violations: string[] = [];

  // Adjust thresholds for CI environment
  const ciMultiplier = process.env.CI ? 2 : 1;

  if (metrics.totalLoadTime > thresholds.totalLoadTime * ciMultiplier) {
    violations.push(
      `Total load time: ${metrics.totalLoadTime}ms > ${thresholds.totalLoadTime * ciMultiplier}ms`,
    );
  }

  if (
    metrics.firstContentfulPaint >
    thresholds.firstContentfulPaint * ciMultiplier
  ) {
    violations.push(
      `FCP: ${metrics.firstContentfulPaint}ms > ${thresholds.firstContentfulPaint * ciMultiplier}ms`,
    );
  }

  if (
    metrics.largestContentfulPaint >
    thresholds.largestContentfulPaint * ciMultiplier
  ) {
    violations.push(
      `LCP: ${metrics.largestContentfulPaint}ms > ${thresholds.largestContentfulPaint * ciMultiplier}ms`,
    );
  }

  if (metrics.cumulativeLayoutShift > thresholds.cumulativeLayoutShift) {
    violations.push(
      `CLS: ${metrics.cumulativeLayoutShift} > ${thresholds.cumulativeLayoutShift}`,
    );
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Log performance metrics for debugging
 */
export function logPerformanceMetrics(
  metrics: PerformanceMetrics,
  browserName: string,
  _testInfo?: TestInfo,
): void {
  if (!process.env.CI) {
    return; // Only log in CI to avoid cluttering local runs
  }

  console.log(`\n🔍 Performance Metrics (${browserName}):`);
  console.log(`  Total Load Time: ${metrics.totalLoadTime}ms`);
  console.log(`  First Contentful Paint: ${metrics.firstContentfulPaint}ms`);
  console.log(
    `  Largest Contentful Paint: ${metrics.largestContentfulPaint}ms`,
  );
  console.log(`  Cumulative Layout Shift: ${metrics.cumulativeLayoutShift}`);

  const check = checkPerformanceThresholds(metrics, browserName, _testInfo);
  if (!check.passed) {
    console.log(`  ⚠️  Performance violations:`);
    check.violations.forEach((violation) => console.log(`    - ${violation}`));
  } else {
    console.log(`  ✅ All performance thresholds met`);
  }
}
