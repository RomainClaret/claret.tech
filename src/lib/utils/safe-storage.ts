/**
 * localStorage and sessionStorage calls that cannot throw.
 *
 * Where the browser blocks storage (Chrome's "block all cookies", some
 * webviews), even reading the `localStorage` property throws a
 * SecurityError, and setItem throws when the quota is full. Called during a
 * render, that takes the provider tree down. A blocked read counts as
 * nothing stored; a blocked write is dropped, so the value lasts for this
 * page view only.
 */
type Area = "local" | "session";

const area = (which: Area): Storage =>
  which === "local" ? localStorage : sessionStorage;

export function readStorage(which: Area, key: string): string | null {
  try {
    return area(which).getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(which: Area, key: string, value: string): void {
  try {
    area(which).setItem(key, value);
  } catch {
    // Blocked or full: kept for this page view only.
  }
}

export function removeStorage(which: Area, key: string): void {
  try {
    area(which).removeItem(key);
  } catch {
    // Blocked: there is nothing stored to remove.
  }
}
