import { describe, expect, it } from "vitest";

/**
 * The browser stand-ins src/test/setup.ts installs must still work inside a
 * test. vitest.config.ts resets every mock before each test (mockReset), and
 * a stand-in written as vi.fn().mockImplementation(...) loses its body to
 * that reset: the global ResizeObserver then built objects without
 * observe(), and a component that observed outside its own test's mock
 * threw "observer?.observe is not a function" (cookie-notice.test.tsx, 1 of
 * 3 batch-1 runs). One passed to vi.fn(...) keeps it.
 */
describe("the test setup's browser stand-ins", () => {
  it("builds a ResizeObserver that can observe", () => {
    const observer = new ResizeObserver(() => {});
    expect(typeof observer.observe).toBe("function");
    expect(typeof observer.disconnect).toBe("function");
  });

  it("builds an IntersectionObserver that can observe", () => {
    const observer = new IntersectionObserver(() => {});
    expect(typeof observer.observe).toBe("function");
    expect(typeof observer.disconnect).toBe("function");
  });
});
