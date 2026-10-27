/**
 * Only same-origin paths and https URLs may reach the PDF viewer and its
 * raw-DOM download anchor: pdfUrl can originate from external APIs (Semantic
 * Scholar / Crossref via a manual refresh), so schemes like javascript: or
 * data: must never make it into an href.
 *
 * Lives in its own module (not in usePDFViewer) so the lazily-loaded
 * pdf-viewer chunk does not depend on a module bundled with the page chunk.
 */
export function isSafePdfUrl(url: string): boolean {
  try {
    if (url.startsWith("/")) {
      // Decided on the URL the browser will resolve, not on the text: the
      // parser reads "/\\host" and "/<tab>/host" as "//host", another site.
      return new URL(url, SELF).origin === SELF;
    }
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/** A stand-in for the page's own origin, which no real URL has. */
const SELF = "https://same-origin.invalid";
