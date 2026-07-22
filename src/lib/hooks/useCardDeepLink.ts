"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Deep-links cards by URL hash (#<card id>, the BibTeX-style keys).
 *
 * When the hash matches one of `targetIds`, the hook scrolls to the element
 * carrying that id (offset for the 64px fixed nav), pulses a highlight
 * (`highlightedId`, ~2.6s, pair with the `.deep-link-highlight` class), and
 * holds `deepLinkedId` (pair with HolographicCard's `forceHover` and any
 * auto-expand behavior) until the first real user interaction: scrolling via
 * wheel or touch, or a pointerdown outside the linked element. Listening to
 * wheel/touchmove/pointerdown rather than scroll means the hook's own smooth
 * scroll never cancels its own highlight. Non-matching hashes (e.g. #papers)
 * are ignored and left to the browser.
 */
export function useCardDeepLink(
  targetIds: string[],
  options?: { onMatch?: (id: string) => void },
) {
  const [deepLinkedId, setDeepLinkedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Track the latest onMatch without retriggering the hash effect.
  const onMatchRef = useRef(options?.onMatch);
  onMatchRef.current = options?.onMatch;

  // Key the effect on content, not array identity: callers rebuild the array
  // every render (ids never contain a newline).
  const targetsKey = targetIds.join("\n");

  useEffect(() => {
    let highlightTimer: ReturnType<typeof setTimeout> | undefined;

    const applyHash = () => {
      const rawHash = window.location.hash.slice(1);
      let hash: string;
      try {
        hash = decodeURIComponent(rawHash);
      } catch {
        // Malformed percent-escapes (e.g. "#%") throw; use the raw hash.
        hash = rawHash;
      }
      if (!hash) return;
      const targets = targetsKey ? targetsKey.split("\n") : [];
      if (!targets.includes(hash)) return;

      onMatchRef.current?.(hash);
      setDeepLinkedId(hash);
      setHighlightedId(hash);
      if (highlightTimer) clearTimeout(highlightTimer);
      highlightTimer = setTimeout(() => setHighlightedId(null), 2600);

      requestAnimationFrame(() => {
        const element = document.getElementById(hash);
        if (element) {
          // Same offset math as useScrollSection: clear the 64px fixed nav.
          const top =
            element.getBoundingClientRect().top + window.pageYOffset - 64;
          window.scrollTo({ top, behavior: "smooth" });
        }
      });
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      if (highlightTimer) clearTimeout(highlightTimer);
    };
  }, [targetsKey]);

  // Keep the deep-linked card aligned while the page settles: sections above
  // it (publications, projects, blog content) keep loading after our first
  // scroll and push the target further down, leaving the viewport stranded
  // above it. While the deep link is active (up to 15s), a settle loop checks
  // every 250ms: when the viewport is stationary but no longer aligned with
  // the card, snap to it. A moving viewport skips the tick, so an in-flight
  // smooth scroll is never interrupted, and the release listeners below stop
  // the loop the moment the user actually interacts.
  useEffect(() => {
    if (!deepLinkedId) return;

    const startedAt = Date.now();
    let lastY = -1;

    const tick = () => {
      if (Date.now() - startedAt > 15000) {
        clearInterval(interval);
        return;
      }
      const element = document.getElementById(deepLinkedId);
      if (!element) return;

      const currentY = window.pageYOffset;
      const moving = lastY >= 0 && Math.abs(currentY - lastY) > 1;
      lastY = currentY;
      if (moving) return;

      const top = element.getBoundingClientRect().top + currentY - 64;
      const maxTop = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const target = Math.min(Math.max(top, 0), maxTop);
      if (Math.abs(currentY - target) > 4) {
        window.scrollTo({ top: target, behavior: "auto" });
      }
    };

    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [deepLinkedId]);

  // While a deep link is active, the first real user interaction releases it:
  // scrolling via wheel or touch, or a click outside the linked card (clicks
  // on the card itself, e.g. Read more, keep it).
  useEffect(() => {
    if (!deepLinkedId) return;

    const release = () => setDeepLinkedId(null);
    const onPointerDown = (event: Event) => {
      const card = document.getElementById(deepLinkedId);
      if (card && event.target instanceof Node && card.contains(event.target)) {
        return;
      }
      release();
    };

    window.addEventListener("wheel", release, {
      capture: true,
      passive: true,
    });
    window.addEventListener("touchmove", release, {
      capture: true,
      passive: true,
    });
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("wheel", release, true);
      window.removeEventListener("touchmove", release, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [deepLinkedId]);

  return { deepLinkedId, highlightedId };
}
