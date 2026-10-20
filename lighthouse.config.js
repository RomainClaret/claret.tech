// @ts-check
/**
 * Lighthouse settings for tests/e2e/lighthouse.spec.ts, which holds the
 * thresholds. Only settings Lighthouse reads: it removed `budgets` in
 * version 12 (they were never checked here), and `chromeFlags` is for its
 * command line; the spec launches Chromium with its flags itself.
 */

module.exports = {
  extends: "lighthouse:default",

  settings: {
    // Test conditions
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
    },

    // The e2e server speaks HTTP/1.1 on localhost, while production serves
    // HTTP/2, and the page's canonical URL is https://claret.tech. (Lighthouse
    // 13 renamed uses-http2 and ignores an unknown id here without a word.)
    skipAudits: ["modern-http-insight", "canonical"],
  },
};
