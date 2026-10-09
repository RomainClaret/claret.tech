import { loadOnIntent } from "@/lib/utils/load-on-intent";

/**
 * The PDF reader (react-pdf and pdf.js, about 365 KB of script) loads when a
 * visitor is about to open a document, not with the page.
 *
 * The sections mount <PDFModal> only while it is open, through a next/dynamic
 * loader that calls loadPdfReader(). Every control that opens the reader
 * spreads pdfReaderIntent, so pointing at it or focusing it starts the
 * download, and by the click the chunk is usually in hand.
 */
const pdfReader = loadOnIntent(() => import("@/components/ui/pdf-modal"));

export const loadPdfReader = pdfReader.load;
/** The module, once anything (a load or a preload) has fetched it. */
export const loadedPdfReader = pdfReader.loaded;

/**
 * Spread onto every control that opens a PDF. pointerenter covers mouse, pen
 * and touch (a touch fires it just before pointerdown); focus covers the
 * keyboard.
 */
export const pdfReaderIntent = {
  onPointerEnter: pdfReader.preload,
  onFocus: pdfReader.preload,
} as const;
