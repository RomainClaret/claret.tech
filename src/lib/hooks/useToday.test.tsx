import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import type { ReactElement } from "react";
import { buildDay, useToday } from "./useToday";

/** The year in UTC: what the server and every browser agree on. */
const yearOf = (today: Date) => today.getUTCFullYear();

function Probe() {
  return <p>{useToday(yearOf)}</p>;
}

/** The mistake useToday exists for: today's value read during render. */
function ClockProbe() {
  return <p>{yearOf(new Date())}</p>;
}

/**
 * Renders the server's HTML on the commit's day, then hydrates it on a visit
 * a year later, as the static homepage is. Returns what the browser shows
 * and the errors React reported.
 */
async function serveThenVisit(element: () => ReactElement) {
  vi.setSystemTime(new Date("2026-11-05T09:00:00Z")); // the build
  const html = renderToString(element());

  vi.setSystemTime(new Date("2027-12-15T09:00:00Z")); // the visit
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  const recoverable: unknown[] = [];
  const consoleErrors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await act(async () => {
      hydrateRoot(container, element(), {
        onRecoverableError: (error) => recoverable.push(error),
      });
    });
    return {
      html,
      shown: container.textContent,
      recoverable,
      consoleErrors: consoleErrors.mock.calls.length,
    };
  } finally {
    consoleErrors.mockRestore();
    container.remove();
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.stubEnv("BUILD_DATE", "2026-11-04"); // the built commit's day
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("useToday", () => {
  it("hydrates with the commit day's value and shows today's after", async () => {
    const visit = await serveThenVisit(() => <Probe />);

    expect(visit.html).toContain("2026");
    expect(visit.recoverable).toEqual([]); // no hydration mismatch
    expect(visit.consoleErrors).toBe(0);
    expect(visit.shown).toBe("2027");
  });

  it("is what the harness above catches without it", async () => {
    // The control: if this stopped reporting a mismatch, the test above
    // would pass whatever useToday did.
    const visit = await serveThenVisit(() => <ClockProbe />);

    expect(visit.html).toContain("2026");
    expect(visit.recoverable).toHaveLength(1);
    expect(String(visit.recoverable[0])).toMatch(/[Hh]ydrat/);
  });

  it("is today's value from the first render of a component mounted later", () => {
    vi.setSystemTime(new Date("2027-12-15T09:00:00Z"));
    const renders: number[] = [];
    function Recorder() {
      renders.push(useToday(yearOf));
      return null;
    }
    render(<Recorder />);

    expect(renders).toEqual([2027]);
  });
});

describe("buildDay", () => {
  it("is 00:00 UTC on BUILD_DATE, whatever the clock says", () => {
    vi.setSystemTime(new Date("2027-12-15T09:00:00Z"));

    expect(buildDay().toISOString()).toBe("2026-11-04T00:00:00.000Z");
  });

  it("is today where no build set BUILD_DATE", () => {
    vi.stubEnv("BUILD_DATE", undefined);
    vi.setSystemTime(new Date("2027-12-15T09:00:00Z"));

    expect(buildDay().toISOString()).toBe("2027-12-15T09:00:00.000Z");
  });
});
