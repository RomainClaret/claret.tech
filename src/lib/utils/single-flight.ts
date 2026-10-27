/**
 * One upstream load at a time, and a pause after a failure.
 *
 * The GitHub routes' caches fill only once a load returns, so five cold
 * requests at once made five GitHub calls, and a failing GitHub (rate
 * limited, say) was asked again on every request (security audit run 1,
 * hardening). Callers during a load share its promise; after a failure,
 * `recentlyFailed()` holds for `failureTtlMs` so the route can answer at
 * once without asking GitHub again.
 */
export function singleFlight<T>(failureTtlMs: number) {
  let pending: Promise<T> | null = null;
  let failedAt: number | null = null;

  return {
    run(load: () => Promise<T>): Promise<T> {
      pending ??= load()
        .then(
          (value) => {
            failedAt = null;
            return value;
          },
          (error: unknown) => {
            failedAt = Date.now();
            throw error;
          },
        )
        .finally(() => {
          pending = null;
        });
      return pending;
    },
    recentlyFailed(): boolean {
      return failedAt !== null && Date.now() - failedAt < failureTtlMs;
    },
  };
}
