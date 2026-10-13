"use client";

import { LazyMotion } from "framer-motion";
import { logError } from "@/lib/utils/dev-logger";

/**
 * Says on <html> whether framer's features arrived: data-motion-features is
 * "ready" or "failed" (and then the returned promise never settles). Until it is "ready", globals.css shows what framer
 * would have animated in, at once on "failed" and 6 s after the first paint
 * without either (the bundle never ran): the `m` elements' initial state is
 * opacity 0 for most of the page's text.
 */
export function trackMotionFeatures<T>(load: Promise<T>): Promise<T> {
  return load.then(
    (features) => {
      document.documentElement.setAttribute("data-motion-features", "ready");
      return features;
    },
    (error: unknown) => {
      document.documentElement.setAttribute("data-motion-features", "failed");
      // dev-logger: error-logger's logError returns at once in a browser.
      logError(error, "Motion features chunk");
      // Not rethrown: LazyMotion calls features().then(...) with no catch,
      // so a rejection surfaced as an "Uncaught (in promise)" on every such
      // visit. framer waits for good instead, and the stylesheet shows what
      // it would have animated in.
      return new Promise<T>(() => {});
    },
  );
}

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
 * splash. If they never land, trackMotionFeatures lets the stylesheet show
 * that state's content instead.
 */
const loadFeatures = () =>
  trackMotionFeatures(
    retryOnce(
      () => import("./motion-features").then((module) => module.default),
      1000,
    ),
  );

/**
 * `load`, asked for once more `delayMs` after a failure. A transient one (a
 * dropped connection, one bad response) then still ends with the features,
 * and the page animates as on any visit; webpack forgets a failed chunk, so
 * the second import requests it again. Only a second failure reaches
 * trackMotionFeatures as one, and the stylesheet's fallback.
 */
export function retryOnce<T>(
  load: () => Promise<T>,
  delayMs: number,
): Promise<T> {
  return load().catch(
    () =>
      new Promise<T>((resolve, reject) => {
        setTimeout(() => load().then(resolve, reject), delayMs);
      }),
  );
}

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
}
