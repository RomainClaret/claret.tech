import { describe, it, expect, vi, afterEach } from "vitest";
import { singleFlight } from "./single-flight";

describe("singleFlight", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives every caller during a load that one load's result", async () => {
    let resolve!: (value: string) => void;
    const load = vi.fn(() => new Promise<string>((done) => (resolve = done)));
    const flight = singleFlight<string>(60_000);

    const answers = Promise.all([1, 2, 3, 4, 5].map(() => flight.run(load)));
    resolve("repositories");

    expect(await answers).toEqual(Array(5).fill("repositories"));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("loads again once a load has settled", async () => {
    const flight = singleFlight<number>(60_000);
    const load = vi.fn(async () => 1);

    await flight.run(load);
    await flight.run(load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("remembers a failure for its time, and only for its time", async () => {
    vi.useFakeTimers();
    const flight = singleFlight<number>(60_000);

    await expect(
      flight.run(() => Promise.reject(new Error("rate limited"))),
    ).rejects.toThrow("rate limited");
    expect(flight.recentlyFailed()).toBe(true);

    vi.advanceTimersByTime(60_000);
    expect(flight.recentlyFailed()).toBe(false);
  });

  it("forgets a failure once a load succeeds", async () => {
    const flight = singleFlight<number>(60_000);
    await flight.run(() => Promise.reject(new Error("down"))).catch(() => {});

    await flight.run(async () => 1);

    expect(flight.recentlyFailed()).toBe(false);
  });
});
