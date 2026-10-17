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

/** A page's size at scale 1, in the units react-pdf lays pages out in. */
export interface PageSize {
  width: number;
  height: number;
}

interface MeasurablePdf {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (p: { scale: number }) => { width: number; height?: number };
  }>;
}

/**
 * Every page's size at scale 1, from the document metadata.
 *
 * The reader gives each page a box of this size times the zoom before
 * anything is drawn, so a page far from the viewport can go without its
 * canvas and still hold its place: the scroll length, the page counter and
 * the scroll position do not depend on which pages are drawn. A page that
 * cannot be read gets 0x0 rather than failing the whole scan.
 *
 * Resolves to [] if the document cannot be measured at all.
 */
export async function pageSizes(pdf: MeasurablePdf): Promise<PageSize[]> {
  try {
    return await Promise.all(
      Array.from({ length: pdf.numPages }, (_, i) =>
        pdf
          .getPage(i + 1)
          .then((page) => {
            const viewport = page.getViewport({ scale: 1 });
            return { width: viewport.width, height: viewport.height ?? 0 };
          })
          .catch(() => ({ width: 0, height: 0 })),
      ),
    );
  } catch {
    return [];
  }
}

/** The widest of `sizes`, or 0 when there is none to go by. */
export function widestOf(sizes: PageSize[]): number {
  return sizes.reduce((max, size) => (size.width > max ? size.width : max), 0);
}
