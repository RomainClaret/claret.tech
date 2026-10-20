import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { reportClientError } from "@/lib/client-error/report";
import { useErrorReport } from "./useErrorReport";

vi.mock("@/lib/client-error/report", () => ({
  reportClientError: vi.fn(),
}));

/** A report whose answer the test gives, when it chooses. */
function pendingReport() {
  let answer!: (onRecord: boolean) => void;
  vi.mocked(reportClientError).mockReturnValueOnce(
    new Promise<boolean>((resolve) => {
      answer = resolve;
    }),
  );
  return (onRecord: boolean) => act(async () => answer(onRecord));
}

describe("useErrorReport", () => {
  beforeEach(() => {
    vi.mocked(reportClientError).mockReset();
  });

  it("is false until the report is on record, then true", async () => {
    const answer = pendingReport();
    const error = new Error("boom");

    const { result } = renderHook(() => useErrorReport(error));

    expect(reportClientError).toHaveBeenCalledWith(error);
    expect(result.current).toBe(false);
    await answer(true);
    expect(result.current).toBe(true);
  });

  it("stays false when nothing was filed", async () => {
    const answer = pendingReport();
    const error = new Error("boom");

    const { result } = renderHook(() => useErrorReport(error));

    await answer(false);
    expect(result.current).toBe(false);
  });

  it("starts a new error unreported, and reports it", async () => {
    const first = pendingReport();
    const second = pendingReport();
    const one = new Error("one");
    const two = new Error("two");

    const { result, rerender } = renderHook(
      ({ error }) => useErrorReport(error),
      {
        initialProps: { error: one },
      },
    );
    await first(true);
    expect(result.current).toBe(true);

    rerender({ error: two });
    expect(result.current).toBe(false);
    expect(reportClientError).toHaveBeenLastCalledWith(two);
    await second(true);
    expect(result.current).toBe(true);
  });

  it("keeps a newer error's answer when an older one arrives late", async () => {
    // What the hook's guard is for. The test it replaces ("an answer after
    // the page is gone") passed without the guard: React 19 warns of no
    // update after unmount.
    const first = pendingReport();
    const second = pendingReport();
    const one = new Error("one");
    const two = new Error("two");

    const { result, rerender } = renderHook(
      ({ error }) => useErrorReport(error),
      { initialProps: { error: one } },
    );
    rerender({ error: two });
    await second(true);
    await first(false);

    expect(result.current).toBe(true);
  });
});
