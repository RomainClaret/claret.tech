"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { usePageShown } from "@/contexts/page-shown-context";
import { NAV_OFFSET, scrollToSection } from "@/lib/utils/scroll-to-section";

/**
 * Deep-links cards by URL hash (#<card id>, the BibTeX-style keys).
 *
 * When the hash matches one of `targetIds`, the hook scrolls to the element
 * carrying that id (offset for the 64px fixed nav), pulses a highlight
 * (`highlightedId`, ~2.6s from when the page is shown, so not under the
 * splash; pair with the `.deep-link-highlight` class), and
 * holds `deepLinkedId` (pair with HolographicCard's `forceHover` and any
 * auto-expand behavior) until the first real user interaction: scrolling via
 * wheel or touch, or a pointerdown outside the linked element. Listening to
 * wheel/touchmove/pointerdown rather than scroll means the hook's own smooth
 * scroll never cancels its own highlight. A hash that is not one of the
 * targets (e.g. #papers), or no hash at all (Back to the bare URL), is left to
 * the browser, but releases this hook's deep link and stops its scroll, so a
 * card the visitor has left no longer pulls the page back.
 *
 * With `onOpen`, #<card id>-full is a link to the card's details: it points
 * at the card as #<card id> does (the ids returned are the card's), then asks
 * to open them, once per arrival of the link. Not again when the targets
 * change under the same link (sections whose cards arrive in batches), so a
 * dialog the visitor closed stays closed.
 */
/** The suffix of a card's link that also opens its details. */
export const DETAILS_SUFFIX = "-full";

export function useCardDeepLink(
  targetIds: string[],
  options?: {
    onMatch?: (id: string) => void;
    onOpen?: (id: string) => void;
  },
) {
  const pathname = usePathname();
  const pageShown = usePageShown();
  const [deepLinkedId, setDeepLinkedId] = useState<string | null>(null);
  // Each arrival of a link asks for a pulse of the highlight (a new object,
  // so the same link twice pulses twice), whose 2.6 s run from when the
  // page is shown. They ran from the link, and on a page opened at one the
  // splash covered about 2 of them (a production build, 2026-10-21).
  const [pulse, setPulse] = useState<{ id: string } | null>(null);
  const [pulseOver, setPulseOver] = useState<{ id: string } | null>(null);

  // The latest callbacks, without retriggering the hash effect.
  const onMatch = useEffectEvent((id: string) => options?.onMatch?.(id));
  const onOpen = useEffectEvent((id: string) => options?.onOpen?.(id));
  const opens = Boolean(options?.onOpen);
  // The -full link already opened, with its route: one arrival, one open.
  const openedLink = useRef<string | null>(null);

  // Key the effect on content, not array identity: callers rebuild the array
  // every render (ids never contain a newline).
  const targetsKey = targetIds.join("\n");

  useEffect(() => {
    // One scroll at a time. A newer hash or an unmount aborts the running
    // one, whose two-second supervision would otherwise keep snapping the
    // page back to a card that is no longer the target.
    let scroll: AbortController | undefined;

    const applyHash = () => {
      const rawHash = window.location.hash.slice(1);
      let hash: string;
      try {
        hash = decodeURIComponent(rawHash);
      } catch {
        // Malformed percent-escapes (e.g. "#%") throw; use the raw hash.
        hash = rawHash;
      }
      const targets = targetsKey ? targetsKey.split("\n") : [];
      // An exact target wins; else #<target>-full, when this hook opens.
      const base = hash.endsWith(DETAILS_SUFFIX)
        ? hash.slice(0, -DETAILS_SUFFIX.length)
        : null;
      const card = targets.includes(hash)
        ? hash
        : opens && base && targets.includes(base)
          ? base
          : null;
      if (!hash || !card) {
        // No hash at all (Back to the bare URL, or a link to "#"), another
        // section's card, or a section itself. Each section runs its own
        // instance, so release this one: its scroll supervision and settle
        // loop would otherwise keep pulling the page back to its own card.
        // Keyboard and Back/Forward navigation fire no wheel or pointerdown,
        // so nothing else would release it. On a mount with no hash this is a
        // no-op: there is no scroll yet, and React bails out of setting null
        // to null.
        scroll?.abort();
        setDeepLinkedId(null);
        openedLink.current = null;
        return;
      }

      onMatch(card);
      setDeepLinkedId(card);
      setPulse({ id: card });

      // scrollToSection rather than a bare smooth scrollTo: Chrome drops a
      // smooth scroll when layout shifts under it, which is routine here while
      // the page loads, and the target may be thousands of pixels away. If the
      // element is not mounted yet the settle loop below picks it up.
      scroll?.abort();
      scroll = new AbortController();
      const { signal } = scroll;
      requestAnimationFrame(() => scrollToSection(card, { signal }));

      const link = `${pathname}#${hash}`;
      if (card !== hash && openedLink.current !== link) {
        openedLink.current = link;
        onOpen(card);
      }
    };

    // A hashchange is a new arrival, even of a link opened before. Not one
    // that tells of a URL the page has already left: two changes in a row
    // queue two events, and the first one, delivered late, would open the
    // newer link twice. (Events dispatched by code carry no URL.)
    const onHashChange = (event: HashChangeEvent) => {
      if (event.newURL && event.newURL !== window.location.href) return;
      openedLink.current = null;
      applyHash();
    };

    applyHash();
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      scroll?.abort();
    };
    // pathname is a dependency because Next navigates client-side with
    // history.pushState, which fires no hashchange event. Without it, arriving
    // from another route, e.g. the nav on /pdf/<slug> linking back to
    // /#research, landed at the top of the homepage rather than the section
    // that was clicked.
  }, [targetsKey, pathname, opens]);

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

      const top = element.getBoundingClientRect().top + currentY - NAV_OFFSET;
      const maxTop = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const target = Math.min(Math.max(top, 0), maxTop);
      if (Math.abs(currentY - target) > 4) {
        // "instant", not "auto": globals.css sets html { scroll-behavior:
        // smooth }, and "auto" defers to that, so this correction was itself
        // an animated scroll and Chrome dropped it. The loop ran and moved
        // nothing, which is why entering the site at #papers stayed at the top.
        window.scrollTo({ top: target, behavior: "instant" });
      }
    };

    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [deepLinkedId]);

  // While a deep link is active, the first real user interaction releases it:
  // scrolling via wheel or touch, or a click outside the linked card (clicks
  // on the card itself, e.g. Read more, keep it). Not while a modal dialog is
  // open: what the visitor does in it, or on its backdrop, is not done to the
  // page (a dialog's portal lies outside every card).
  useEffect(() => {
    if (!deepLinkedId) return;

    const underDialog = () =>
      document.querySelector('[aria-modal="true"]') !== null;
    const release = () => {
      if (!underDialog()) setDeepLinkedId(null);
    };
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

  // The pulse's 2.6 s, once the page is shown.
  useEffect(() => {
    if (!pulse || !pageShown) return;
    const timer = setTimeout(() => setPulseOver(pulse), 2600);
    return () => clearTimeout(timer);
  }, [pulse, pageShown]);
  const highlightedId =
    pulse && pageShown && pulseOver !== pulse ? pulse.id : null;

  return { deepLinkedId, highlightedId };
}
