import { loadOnIntent } from "@/lib/utils/load-on-intent";

/**
 * The legal texts and DOMPurify (about 29 KB of script) load when a visitor
 * reaches for a legal link, not with every page: LegalModalsProvider renders
 * them through next/dynamic, and the footer and cookie-notice links spread
 * legalTextsIntent, so pointing at a link or focusing it starts the download
 * before the click.
 */
const legalTexts = loadOnIntent(() => import("./legal-texts"));

export const loadLegalTexts = legalTexts.load;
/** The module, once anything (a load or a preload) has fetched it. */
export const loadedLegalTexts = legalTexts.loaded;

export const legalTextsIntent = {
  onPointerEnter: legalTexts.preload,
  onFocus: legalTexts.preload,
} as const;
