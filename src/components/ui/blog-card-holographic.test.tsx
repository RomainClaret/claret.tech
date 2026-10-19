import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

/**
 * A blog card with no color from the server takes it from its image:
 * colorthief, the full-size image and the extraction on the main thread.
 * Done at load, every visit paid for it, including the ones that never
 * reached the blog.
 */

const extraction = vi.hoisted(() => ({ sources: [] as string[] }));
vi.mock("@/lib/hooks/useColorExtraction", () => ({
  useColorExtraction: (source: string, fallback: string) => {
    extraction.sources.push(source);
    return { color: fallback, isLoading: false };
  },
}));
vi.mock("@/components/ui/holographic-card", () => ({
  HolographicCard: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

import { BlogCardHolographic } from "./blog-card-holographic";

// IntersectionObservers a test reports through (the setup's mock loses its
// methods to mockReset).
let observers: {
  callback: (entries: Partial<IntersectionObserverEntry>[]) => void;
  options?: IntersectionObserverInit;
}[] = [];

beforeEach(() => {
  extraction.sources = [];
  observers = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(
        callback: (entries: Partial<IntersectionObserverEntry>[]) => void,
        options?: IntersectionObserverInit,
      ) {
        observers.push({ callback, options });
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const IMAGE = "https://images.unsplash.com/photo-kudos.jpg";

describe("BlogCardHolographic color", () => {
  it("extracts from the image only once the card is within reach", () => {
    render(
      <BlogCardHolographic
        title="Kudos article"
        description="An article"
        url="https://example.com/kudos"
        date="2026-01-01"
        image={IMAGE}
        index={0}
      />,
    );
    // Far down the page: nothing extracted yet.
    expect(extraction.sources.at(-1)).toBe("");

    const near = observers.find(({ options }) => options?.rootMargin);
    expect(near?.options?.rootMargin).toBe("300% 0px");
    act(() => near!.callback([{ isIntersecting: true }]));

    expect(extraction.sources.at(-1)).toBe(IMAGE);
  });

  it("uses the server's color and extracts nothing", () => {
    render(
      <BlogCardHolographic
        title="Medium article"
        description="An article"
        url="https://example.com/medium"
        date="2026-01-01"
        image={IMAGE}
        index={0}
        color="12, 34, 56"
      />,
    );

    expect(extraction.sources.every((source) => source === "")).toBe(true);
    expect(observers).toHaveLength(0);
  });
});

describe("BlogCardHolographic links", () => {
  it("names the Medium profile link after where it goes", () => {
    // It read "More", on every card: Lighthouse flagged it as a vague link
    // text, and it opened the profile, not more of the post.
    render(
      <BlogCardHolographic
        title="An article"
        description="An article"
        url="https://example.com/article"
        date="2026-01-01"
        image={IMAGE}
        index={0}
        color="12, 34, 56"
      />,
    );

    const profile = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.includes("medium.com/@"));
    expect(profile).toHaveLength(1);
    expect(profile[0]).toHaveAccessibleName("Medium");
  });
});

describe("BlogCardHolographic description", () => {
  it("says whether its long description is open", () => {
    render(
      <BlogCardHolographic
        title="Long article"
        description={"A long description. ".repeat(10)}
        url="https://example.com/long"
        date="2026-01-01"
        image={IMAGE}
        index={0}
        color="12, 34, 56"
      />,
    );
    const toggle = screen.getByRole("button", {
      name: "Read more description",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);

    expect(toggle).toHaveAccessibleName("Show less description");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});

describe("BlogCardHolographic share", () => {
  const card = (
    <BlogCardHolographic
      title="Shared article"
      description="An article"
      url="https://example.com/shared"
      date="2026-01-01"
      image={IMAGE}
      index={0}
      color="12, 34, 56"
    />
  );
  const toasts: string[] = [];
  const onToast = (event: Event) =>
    toasts.push((event as CustomEvent<{ message: string }>).detail.message);

  beforeEach(() => {
    toasts.length = 0;
    window.addEventListener("showToast", onToast);
  });
  afterEach(() => {
    window.removeEventListener("showToast", onToast);
  });

  it("copies the link, and says so, where there is no share sheet", async () => {
    // Firefox on a computer has no navigator.share: the button did nothing.
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", {
      ...navigator,
      share: undefined,
      clipboard: { writeText },
    });
    render(card);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Share blog post" }));
    });

    expect(writeText).toHaveBeenCalledWith("https://example.com/shared");
    expect(toasts).toEqual(["Link copied to the clipboard"]);
  });

  it("takes a share sheet closed without sharing as the visitor's choice", async () => {
    // The sheet's promise rejects then, and nothing handled it: a page error
    // (src/test/setup.ts swallows unhandled rejections, so the test asks the
    // promise whether a handler came).
    const writeText = vi.fn(async () => {});
    let handled = false;
    const share = vi.fn(() => ({
      then(_: unknown, onRejected?: (reason: unknown) => void) {
        handled = typeof onRejected === "function";
        onRejected?.(new DOMException("Share canceled", "AbortError"));
      },
    }));
    vi.stubGlobal("navigator", {
      ...navigator,
      share,
      clipboard: { writeText },
    });
    render(card);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Share blog post" }));
    });

    expect(share).toHaveBeenCalledWith({
      title: "Shared article",
      text: "An article",
      url: "https://example.com/shared",
    });
    expect(handled).toBe(true);
    expect(writeText).not.toHaveBeenCalled();
    expect(toasts).toEqual([]);
  });
});
