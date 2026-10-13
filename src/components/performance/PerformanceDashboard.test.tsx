import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PerformanceModal } from "./PerformanceModal";

vi.mock("@/lib/hooks/usePerformanceMonitor", () => ({
  usePerformanceMonitor: () => ({
    fps: 60,
    fcp: 1200,
    lcp: 1800,
    cls: 0.01,
    cpuUsage: 12,
    browserInfo: "Chrome",
    shouldReduceAnimations: false,
    getPerformanceGrade: () => "A",
    getWebVitalsScore: () => 95,
    getCpuStatus: () => "Low",
    getRecommendations: () => [],
  }),
}));

// The dashboard watches its own visibility; the global mock is reset
// between tests, so this file brings an inert observer of its own.
class InertObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
const OriginalIntersectionObserver = globalThis.IntersectionObserver;

describe("The performance dashboard's headings", () => {
  beforeEach(() => {
    globalThis.IntersectionObserver =
      InertObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = OriginalIntersectionObserver;
  });

  it("names the dialog once", () => {
    // The dashboard repeated the dialog's own title as a second h2.
    render(<PerformanceModal isOpen={true} onClose={vi.fn()} />);

    const titles = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual(["Performance Dashboard"]);
  });
});
