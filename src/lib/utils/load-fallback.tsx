"use client";

import { useCallback, useEffect, useState, type ComponentType } from "react";

/**
 * A next/dynamic loader that cannot take the page down.
 *
 * `load` resolves to the component. When it rejects (offline, a flaky
 * network, a deploy that renamed the chunk under an open tab, a blocker),
 * React.lazy throws while rendering and the nearest error boundary takes
 * over: for the providers in the root layout that is global-error, which
 * replaces the whole site. This loader resolves to a stand-in instead, which
 * loads again each time it mounts and shows `Failed`, with a retry, while
 * the load keeps failing. The retrying lives in the stand-in because
 * next/dynamic keeps whatever its first load resolved to.
 *
 * `Failed` stays up while a retry is in flight, told so by `retrying`, so it
 * can disable its button. Rendering nothing meanwhile dropped the PDF
 * reader's dialog with its backdrop and Escape handler, and the legal text's
 * height, until the request settled: on a stalled connection, for good.
 *
 * `load` must itself be able to try again after a failure (loadOnIntent's
 * loaders forget a rejection).
 */
export function withLoadFallback<P extends object>(
  load: () => Promise<ComponentType<P>>,
  Failed: ComponentType<P & { retry: () => void; retrying: boolean }>,
  {
    onError,
    peek,
  }: {
    /** Told of every failed load, the first and each retry's. */
    onError?: (error: unknown) => void;
    /**
     * The component if something else has loaded it since (a hover or focus
     * preload), synchronously. Checked as the stand-in mounts: otherwise it
     * showed the failure for a frame before its own load settled, and a
     * dialog's overlay lock, focus and scroll restore cycled with it.
     */
    peek?: () => ComponentType<P> | undefined;
  } = {},
): () => Promise<ComponentType<P>> {
  // A success outlives the instance that got it. next/dynamic resolves to
  // this stand-in for the rest of the session, so each later mount (every
  // time the reader or a legal text opens again) started from the failure
  // and showed it, "Trying again", until its own load settled.
  let resolved: ComponentType<P> | null = null;

  function Retrying(props: P) {
    const [Loaded, setLoaded] = useState<ComponentType<P> | null>(
      () => resolved ?? peek?.() ?? null,
    );
    // Until something loads: this stand-in exists because a load failed,
    // and it tries again as it mounts.
    const [retrying, setRetrying] = useState(Loaded === null);
    const retry = useCallback(() => {
      setRetrying(true);
      load().then(
        (component) => {
          resolved = component;
          setLoaded(() => component);
        },
        (error: unknown) => {
          onError?.(error);
          setRetrying(false);
        },
      );
    }, []);
    useEffect(() => {
      // Asked again here, not taken from the render: a preload or another
      // instance's retry can land in between, and skipping the retry for it
      // without showing it left "Trying again" up with nothing in flight.
      const ready = resolved ?? peek?.();
      if (ready) setLoaded(() => ready);
      else retry();
    }, [retry]);

    if (Loaded) return <Loaded {...props} />;
    return <Failed {...props} retry={retry} retrying={retrying} />;
  }

  return () =>
    load().catch((error: unknown) => {
      onError?.(error);
      return Retrying;
    });
}
