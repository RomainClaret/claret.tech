/**
 * Reloads the page: after a deploy, the only way a tab gets code that
 * matches the server's (a ChunkLoadError, say). A module of its own so
 * tests can stand in for it: jsdom cannot reload.
 */
export function reloadPage(): void {
  window.location.reload();
}
