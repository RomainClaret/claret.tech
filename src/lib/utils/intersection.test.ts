import { describe, it, expect } from "vitest";
import { latestEntry } from "./intersection";

const entry = (isIntersecting: boolean, time: number) =>
  ({ isIntersecting, time }) as IntersectionObserverEntry;

describe("latestEntry", () => {
  it("returns the newest of the entries delivered together", () => {
    const entries = [entry(true, 10), entry(false, 20)];

    expect(latestEntry(entries)).toBe(entries[1]);
  });

  it("returns the only entry of a single delivery", () => {
    const only = entry(true, 10);

    expect(latestEntry([only])).toBe(only);
  });
});
