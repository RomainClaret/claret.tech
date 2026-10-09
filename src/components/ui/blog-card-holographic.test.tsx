import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
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
  // eslint-disable-next-line @next/next/no-img-element
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
