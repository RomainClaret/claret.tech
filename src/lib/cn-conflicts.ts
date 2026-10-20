import { twMerge } from "tailwind-merge";

/**
 * Classes in one cn() call that set the same thing, such as `px-2 p-4`.
 * cn() joins classes as written, so both reach the page and the browser
 * applies whichever the stylesheet defines last; tailwind-merge, which cn()
 * ran until round 26, kept only the later one. Reported outside production
 * against that rule, so each is settled where it is written
 * (cn-conflicts.test.ts scans every call's written classes; this catches
 * the ones that come from props). tailwind-merge is a dev dependency.
 */

type Handler = (message: string) => void;

// On globalThis rather than in this module: a test that resets its modules
// gets a fresh copy of this file, which still finds the setup's handler.
const HANDLER = Symbol.for("cn-conflict-handler");
const store = globalThis as typeof globalThis & { [HANDLER]?: Handler };

/**
 * Sends the reports to `handler` instead of the console: the unit tests'
 * setup fails the test that caused one. Returns a function that puts the
 * previous handler back.
 */
export function onConflict(handler: Handler) {
  const previous = store[HANDLER];
  store[HANDLER] = handler;
  return () => {
    store[HANDLER] = previous;
  };
}

export function reportConflicts(classes: string) {
  const kept = new Set(twMerge(classes).split(" "));
  const lost = classes.split(/\s+/).filter((name) => name && !kept.has(name));
  if (lost.length > 0) {
    const handle = store[HANDLER] ?? ((message) => console.warn(message));
    handle(
      `[cn-conflict] ${lost.join(" ")} overridden by a later class in "${classes.trim()}"\n${new Error().stack}`,
    );
  }
}
