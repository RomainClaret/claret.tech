// @ts-check
/**
 * Lighthouse settings for tests/e2e/lighthouse.spec.ts, which holds the
 * thresholds. Only settings Lighthouse reads: it removed `budgets` in
 * version 12 (they were never checked here), and `chromeFlags` is for its
 * command line; the spec launches Chromium with its flags itself.
 */

// CI's runners are the slow machine, so CI audits with no CPU slowdown. A
// projection of CI's score on a faster machine sets this
// (docs/TESTING_INFRASTRUCTURE.md, "Lighthouse before a push"). A value that
// is not a positive number fails here: a decimal comma would otherwise audit
// unthrottled under a projection's name.
const multiplier = process.env.LIGHTHOUSE_CPU_MULTIPLIER;
const cpuSlowdownMultiplier = multiplier === undefined ? 1 : Number(multiplier);
if (!(cpuSlowdownMultiplier > 0)) {
  throw new Error(
    `LIGHTHOUSE_CPU_MULTIPLIER must be a positive number, not "${multiplier}"`,
  );
}

module.exports = {
  extends: "lighthouse:default",

  settings: {
    // Test conditions
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier,
    },

    // The e2e server speaks HTTP/1.1 on localhost, while production serves
    // HTTP/2, and the page's canonical URL is https://claret.tech. (Lighthouse
    // 13 renamed uses-http2 and ignores an unknown id here without a word.)
    skipAudits: ["modern-http-insight", "canonical"],
  },
};
