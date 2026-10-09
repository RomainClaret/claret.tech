/**
 * Reload the page: the way out when a lazily loaded chunk keeps failing.
 *
 * The PDF reader, the terminal and the legal texts download on first use,
 * which can be long after the page loaded. If a deploy has replaced their
 * chunks in the meantime, the old names are gone and trying again cannot
 * work; only a reload brings the new names. Its own module so tests can
 * stand in for it (jsdom does not navigate).
 */
export function reloadPage(): void {
  window.location.reload();
}
