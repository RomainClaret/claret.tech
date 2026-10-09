/**
 * A lazily loaded module, fetched once, when it is first wanted.
 *
 * `load` is for the code that renders the module (a next/dynamic loader) and
 * returns the one shared promise. `preload` is for intent handlers
 * (pointerenter, focus) and starts the fetch without waiting for it. A failed
 * fetch is forgotten, so the next call tries again instead of replaying the
 * failure. `loaded` gives the module synchronously once any load or preload
 * has delivered it, for a renderer that must not wait a frame to find out.
 */
export function loadOnIntent<T>(importer: () => Promise<T>): {
  load: () => Promise<T>;
  preload: () => void;
  loaded: () => T | undefined;
} {
  let pending: Promise<T> | null = null;
  let value: T | undefined;

  const load = () => {
    if (!pending) {
      pending = importer().then(
        (module) => {
          value = module;
          return module;
        },
        (error: unknown) => {
          pending = null;
          throw error;
        },
      );
    }
    return pending;
  };

  return {
    load,
    preload: () => {
      // Not the visitor's concern yet: whoever renders the module calls
      // load() again, which retries and reports.
      load().catch(() => {});
    },
    loaded: () => value,
  };
}
