import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * CI's Lighthouse job audits with no CPU slowdown: its runners are the slow
 * machine. A projection of CI's score on a faster one sets
 * LIGHTHOUSE_CPU_MULTIPLIER (docs/TESTING_INFRASTRUCTURE.md, "Lighthouse
 * before a push"). A value it cannot read must not fall back to 1: a
 * decimal comma would then audit unthrottled under a projection's name.
 */

const set = process.env.LIGHTHOUSE_CPU_MULTIPLIER;

async function loadMultiplier(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) delete process.env.LIGHTHOUSE_CPU_MULTIPLIER;
  else process.env.LIGHTHOUSE_CPU_MULTIPLIER = value;
  const config = (await import("../../lighthouse.config.js")).default;
  return config.settings.throttling.cpuSlowdownMultiplier;
}

afterEach(() => {
  if (set === undefined) delete process.env.LIGHTHOUSE_CPU_MULTIPLIER;
  else process.env.LIGHTHOUSE_CPU_MULTIPLIER = set;
});

describe("Lighthouse's CPU multiplier", () => {
  it("is 1 when nothing sets it, as on CI", async () => {
    expect(await loadMultiplier(undefined)).toBe(1);
  });

  it("takes the environment's value for a projection", async () => {
    expect(await loadMultiplier("3.7")).toBe(3.7);
  });

  it("refuses a value it cannot read", async () => {
    await expect(loadMultiplier("3,7")).rejects.toThrow(
      "LIGHTHOUSE_CPU_MULTIPLIER",
    );
  });
});
