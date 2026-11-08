"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

/**
 * The day the static HTML describes: 00:00 UTC on the built commit's day,
 * BUILD_DATE, which next.config.mjs inlines into the server's bundle and the
 * browser's alike, so both compute the same value from it. Today where no
 * Next build set it, as in unit tests.
 */
export function buildDay(): Date {
  const day = new Date(`${process.env.BUILD_DATE}T00:00:00Z`);
  return Number.isNaN(day.getTime()) ? new Date() : day;
}

/**
 * A value computed from today's date, on a page generated once at build
 * time. The server's HTML and the render that hydrates it compute it for the
 * built commit's day (buildDay), so they agree, and a rebuild of the same
 * commit gives the same HTML; React then renders it again for the visitor's
 * today, as the footer's year does. Computed from the browser's clock while
 * hydrating, "10.9 Years of Research" met the HTML's "10.8" the day after a
 * 2026-11-04 build (that figure steps every 36.5 days), and React threw away
 * and rebuilt most of the page (error #418).
 *
 * `compute` returns a string or a number (snapshots are compared with
 * Object.is) and must not depend on the timezone: the commit day's value is
 * computed on the server and again in every visitor's browser.
 */
export function useToday<T extends string | number>(
  compute: (today: Date) => T,
): T {
  return useSyncExternalStore(
    subscribeNever,
    () => compute(new Date()),
    () => compute(buildDay()),
  );
}
