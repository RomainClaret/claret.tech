import { describe, it, expect, afterEach } from "vitest";
import { lockPageScroll } from "./scroll-lock";

/**
 * The page's one scroll lock, counted across everything that covers the
 * page: each of them used to write its own value back as it closed.
 */
describe("lockPageScroll", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("locks the page until the last release, in any order", () => {
    const reader = lockPageScroll();
    const dashboard = lockPageScroll();
    expect(document.body.style.overflow).toBe("hidden");

    reader();
    expect(document.body.style.overflow).toBe("hidden");

    dashboard();
    expect(document.body.style.overflow).toBe("");
  });

  it("puts back the value the page had", () => {
    document.body.style.overflow = "scroll";

    const release = lockPageScroll();
    expect(document.body.style.overflow).toBe("hidden");
    release();

    expect(document.body.style.overflow).toBe("scroll");
  });

  it("counts each release once", () => {
    const first = lockPageScroll();
    const second = lockPageScroll();

    first();
    first();
    expect(document.body.style.overflow).toBe("hidden");

    second();
    expect(document.body.style.overflow).toBe("");
  });
});
