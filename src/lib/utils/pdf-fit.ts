/**
 * Zoom arithmetic for the PDF reader.
 *
 * Scale 1.0 is the PDF's native point size, which means a document is sized by
 * how it happens to have been authored rather than by the space available. An
 * A4 page is 595pt and a viewer is around 1100px wide, so a paper, a thesis,
 * the CV and every A4 poster rendered at roughly half width, while an A0
 * poster overflowed. The reader now fits the document to the width either way,
 * which is what a browser's own PDF viewer does.
 *
 * Kept separate from the component because this is the part with actual logic,
 * and testing it there would mean driving react-pdf and canvas in jsdom.
 */

/** Never zoom out past this; below it the text stops being readable. */
export const MIN_SCALE = 0.25;

/**
 * Never zoom in past this.
 *
 * Shared with the reader's zoom-in button so auto-fit cannot land on a scale
 * the manual control refuses to return to. It also stops a very narrow page in
 * a very wide viewer being blown up past the point of looking deliberate.
 */
export const MAX_SCALE = 2.0;

/**
 * The scale at which `contentWidth` fits inside `availableWidth`.
 *
 * Grows as well as shrinks: a page narrower than the viewer is scaled up to
 * fill it, rather than left at native size with the slack going to waste.
 * Rounds down so the result never lands a fraction of a pixel too wide, and is
 * clamped to [MIN_SCALE, MAX_SCALE].
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

  const fitted =
    Math.floor((availableWidth / contentWidth) * currentScale * 100) / 100;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, fitted));
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
