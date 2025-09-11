/**
 * Lighthouse Configuration with Performance Budgets
 * Defines thresholds for cross-browser performance testing
 */

module.exports = {
  extends: "lighthouse:default",

  settings: {
    // Performance budget configuration
    budgets: [
      {
        // Resource count budget
        resourceCounts: [
          { resourceType: "script", budget: 20 },
          { resourceType: "stylesheet", budget: 10 },
          { resourceType: "font", budget: 8 },
          { resourceType: "image", budget: 30 },
          { resourceType: "third-party", budget: 15 },
          { resourceType: "total", budget: 60 },
        ],

        // Resource size budget (in KB)
        resourceSizes: [
          { resourceType: "script", budget: 500 },
          { resourceType: "stylesheet", budget: 200 },
          { resourceType: "font", budget: 150 },
          { resourceType: "image", budget: 2000 },
          { resourceType: "third-party", budget: 300 },
          { resourceType: "total", budget: 3000 },
        ],

        // Timing budget (in milliseconds)
        timings: [
          { metric: "first-contentful-paint", budget: 1800 },
          { metric: "largest-contentful-paint", budget: 2500 },
          { metric: "first-meaningful-paint", budget: 2000 },
          { metric: "speed-index", budget: 3000 },
          { metric: "interactive", budget: 3800 },
          { metric: "max-potential-fid", budget: 100 },
          { metric: "cumulative-layout-shift", budget: 0.1 },
        ],
      },
    ],

    // Test conditions
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
    },

    // Chrome flags for consistent testing
    chromeFlags: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],

    // Skip some audits that might not be relevant for our testing
    skipAudits: ["uses-http2", "canonical"],
  },
};
