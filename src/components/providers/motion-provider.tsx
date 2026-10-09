"use client";

import { LazyMotion } from "framer-motion";

/**
 * framer-motion's animation features, loaded once for the whole app.
 *
 * Components render the slim `m` instead of `motion`: `motion` carries every
 * feature (drag, layout animations) into each chunk that uses it, while `m`
 * takes them from here. domAnimation covers what the site uses: animate,
 * exit, variants, hover, tap, focus and in-view. `strict` makes a leftover
 * `motion` component throw in development. The performance modal, the one
 * draggable element, loads drag (domMax) itself when it opens.
 *
 * The features come in their own chunk, after hydration: in the layout's
 * chunk they were about 45 KB of script (17 KB compressed) to fetch and run
 * before the page could hydrate. Until they land, `m` elements render their
 * initial state, which is what the server sent; that happens under the
 * splash.
 */
const loadFeatures = () =>
  import("./motion-features").then((module) => module.default);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
}
