/**
 * Zoom arithmetic for the PDF reader.
 *
 * Scale 1.0 is the PDF's native point size, which fits an A4 portrait page in
 * the viewer but overflows it for wider pages: 16:9 presentation slides, and
 * the landscape pages that show up partway through an otherwise portrait
 * thesis. The reader zooms out once on open so the document fits.
 *
 * Kept separate from the component because this is the part with actual logic,
 * and testing it there would mean driving react-pdf and canvas in jsdom.
 */

/** Never zoom out past this; below it the text stops being readable. */
export const MIN_SCALE = 0.25;

/**
 * The scale at which `contentWidth` fits inside `availableWidth`.
 *
 * Returns `currentScale` unchanged when it already fits, so opening a normal
 * portrait document does not shrink it. Rounds down so the result never lands
 * a fraction of a pixel too wide.
 *
 * @param contentWidth   Rendered width of the widest page, at `currentScale`.
 * @param availableWidth Space the viewer has, already minus its padding.
 */
export function fitScale(
  contentWidth: number,
  availableWidth: number,
  currentScale: number,
): number {
  if (
    !Number.isFinite(contentWidth) ||
    !Number.isFinite(availableWidth) ||
    contentWidth <= 0 ||
    availableWidth <= 0
  ) {
    return currentScale;
  }

  if (contentWidth <= availableWidth) return currentScale;

  const fitted =
    Math.floor((availableWidth / contentWidth) * currentScale * 100) / 100;
  return Math.max(MIN_SCALE, fitted);
}

/**
 * The widest page in the document, in points.
 *
 * Fitting only the first page is not enough: a thesis opens on a portrait
 * title page and turns landscape 55 pages later, and fitting page one leaves
 * those later pages overflowing sideways. Page size comes from the document
 * metadata rather than from a rendered canvas, so this does not depend on
 * render timing.
 *
 * Resolves to 0 if the document cannot be measured, which callers should read
 * as "do not adjust the zoom".
 */
export async function widestPageWidth(pdf: {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (p: { scale: number }) => { width: number };
  }>;
}): Promise<number> {
  try {
    const widths = await Promise.all(
      Array.from({ length: pdf.numPages }, (_, i) =>
        pdf
          .getPage(i + 1)
          .then((page) => page.getViewport({ scale: 1 }).width)
          .catch(() => 0),
      ),
    );
    return widths.reduce((max, w) => (w > max ? w : max), 0);
  } catch {
    return 0;
  }
}
