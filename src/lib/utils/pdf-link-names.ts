/**
 * Names for the links within a PDF, from the text printed under them.
 *
 * pdf.js draws each link as an empty `<a>` over the page, so a screen reader
 * announced every citation, cross-reference and contents entry as "link":
 * 3,400 of the 3,590 links in the site's PDFs. Their text is printed under
 * them, in the page's text content, in PDF user space like the link's
 * rectangle. pdf.js merges a printed line into one text item, so each item is
 * split into characters, weighted by their width in the text layer's
 * fallback font, and a character belongs to the link when its centre is in
 * the rectangle; words are kept whole. A bare number ("5", "3.2") gets a type
 * word from the link's target ("cite." gives Reference) or from the word
 * before it ("Fig."): a citation reads "Reference 5", a contents entry reads
 * as printed. Measured against the glyph boxes of all 28 PDFs, the text under
 * a link matches what is printed there for about 98.6% of links.
 *
 * Free of imports, so node can run it as is (the accuracy check does).
 */

/** A character's width in a font family, in any unit: only ratios count. */
export type MeasureChar = (char: string, family: string) => number;

/** A text item of pdf.js's text content (the fields used here). */
export interface LinkTextItem {
  str: string;
  transform: readonly number[];
  width: number;
  height: number;
  fontName: string;
}

/** pdf.js's text content: items (marked-content entries have a `type`). */
export interface LinkTextContent {
  items: ReadonlyArray<LinkTextItem | { type: string }>;
  styles: Readonly<Record<string, { fontFamily: string; vertical?: boolean }>>;
}

/** A pdf.js annotation (the fields used here). */
export interface LinkAnnotationData {
  id: string;
  subtype?: string;
  rect: readonly number[];
  url?: string;
  dest?: string | readonly unknown[] | null;
  contentsObj?: { str?: string } | null;
}

let sharedMeasure: MeasureChar | null = null;

/**
 * Character widths in the text layer's fallback fonts ("serif",
 * "sans-serif", "monospace"), measured on a canvas once per character. With
 * no 2D canvas (jsdom), every character weighs the same.
 */
export function canvasMeasure(): MeasureChar {
  if (sharedMeasure) return sharedMeasure;
  type Context = { font: string; measureText(text: string): { width: number } };
  let context: Context | null = null;
  try {
    const canvas =
      typeof OffscreenCanvas === "undefined"
        ? document.createElement("canvas")
        : new OffscreenCanvas(1, 1);
    context = (canvas.getContext("2d") as Context | null) ?? null;
  } catch {
    context = null;
  }
  const widths = new Map<string, number>();
  sharedMeasure = (char, family) => {
    if (!context) return 1;
    const key = `${family}\u0000${char}`;
    let width = widths.get(key);
    if (width === undefined) {
      context.font = `100px ${family}`;
      width = context.measureText(char).width;
      if (!(width > 0)) width = 0;
      widths.set(key, width);
    }
    return width;
  };
  return sharedMeasure;
}

/** A link to a place in the same document, the only kind named here. */
function isInternal(annotation: LinkAnnotationData): boolean {
  return (
    (annotation.subtype === undefined || annotation.subtype === "Link") &&
    !annotation.url &&
    (typeof annotation.dest === "string" || Array.isArray(annotation.dest))
  );
}

/** A text item placed in user space, its characters located lazily. */
interface Placed {
  index: number;
  str: string;
  family: string;
  width: number;
  ox: number;
  oy: number;
  ux: number;
  uy: number;
  vx: number;
  vy: number;
  h: number;
  /** The origin along the text direction, and across it (its line). */
  along: number;
  across: number;
  box: readonly [number, number, number, number];
  chars?: string[];
  starts?: number[];
  ends?: number[];
  word?: boolean[];
}

function place(
  item: LinkTextItem,
  index: number,
  family: string,
): Placed | null {
  const [a, b, c, d, e, f] = item.transform;
  const su = Math.hypot(a, b);
  const sv = Math.hypot(c, d);
  if (!(su > 0) || !(sv > 0) || !(item.width > 0) || !item.str.trim()) {
    return null;
  }
  const ux = a / su;
  const uy = b / su;
  const vx = c / sv;
  const vy = d / sv;
  const h = item.height > 0 ? item.height : sv;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const s of [0, item.width]) {
    for (const t of [-0.25 * h, 0.75 * h]) {
      xs.push(e + s * ux + t * vx);
      ys.push(f + s * uy + t * vy);
    }
  }
  return {
    index,
    str: item.str,
    family,
    width: item.width,
    ox: e,
    oy: f,
    ux,
    uy,
    vx,
    vy,
    h,
    along: e * ux + f * uy,
    across: e * vx + f * vy,
    box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
  };
}

/** Each character's start and end along the item, by its share of width,
 *  and which characters make words: once per item, for all its links. */
function locate(item: Placed, measure: MeasureChar) {
  if (item.chars) return;
  const chars = Array.from(item.str);
  const weights = chars.map((char) => measure(char, item.family));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const starts: number[] = [];
  const ends: number[] = [];
  let run = 0;
  for (let i = 0; i < chars.length; i++) {
    const share = total > 0 ? weights[i] / total : 1 / chars.length;
    starts.push(run * item.width);
    run += share;
    ends.push(run * item.width);
  }
  item.chars = chars;
  item.starts = starts;
  item.ends = ends;
  item.word = wordChars(chars);
}

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const JOINER = /[.\-'’]/;

/** The characters that belong to a word: letters and digits, and the
 *  joiners `.` `-` `'` `’` between two of them. */
function wordChars(chars: string[]): boolean[] {
  return chars.map(
    (char, i) =>
      LETTER_OR_DIGIT.test(char) ||
      (JOINER.test(char) &&
        LETTER_OR_DIGIT.test(chars[i - 1] ?? "") &&
        LETTER_OR_DIGIT.test(chars[i + 1] ?? "")),
  );
}

interface Under {
  text: string;
  horizontal: boolean;
  /** Where the text starts: its first item, and its first character. */
  start: { item: Placed; first: number } | null;
}

/** The text printed under `rect`: characters whose centre is inside it,
 *  snapped to whole words, in content order. */
function textUnder(
  rect: readonly number[],
  items: readonly Placed[],
  measure: MeasureChar,
): Under {
  const x1 = Math.min(rect[0], rect[2]);
  const x2 = Math.max(rect[0], rect[2]);
  const y1 = Math.min(rect[1], rect[3]);
  const y2 = Math.max(rect[1], rect[3]);
  const pieces: { item: Placed; first: number; last: number }[] = [];
  for (const item of items) {
    const [bx1, by1, bx2, by2] = item.box;
    if (bx2 < x1 || bx1 > x2 || by2 < y1 || by1 > y2) continue;
    locate(item, measure);
    const chars = item.chars!;
    const kept = chars.map((char, i) => {
      if (/\s/.test(char)) return false;
      const c = (item.starts![i] + item.ends![i]) / 2;
      const x = item.ox + c * item.ux + 0.25 * item.h * item.vx;
      const y = item.oy + c * item.uy + 0.25 * item.h * item.vy;
      return x >= x1 && x <= x2 && y >= y1 && y <= y2;
    });
    if (!kept.some(Boolean)) continue;
    // Whole words: a word with any character kept is kept.
    const word = item.word!;
    for (let i = 0; i < chars.length; ) {
      if (!word[i]) {
        i++;
        continue;
      }
      let j = i;
      let any = false;
      for (; j < chars.length && word[j]; j++) any = any || kept[j];
      if (any) kept.fill(true, i, j);
      i = j;
    }
    pieces.push({
      item,
      first: kept.indexOf(true),
      last: kept.lastIndexOf(true),
    });
  }
  if (pieces.length === 0) {
    return { text: "", horizontal: true, start: null };
  }
  let text = "";
  for (let k = 0; k < pieces.length; k++) {
    const { item, first, last } = pieces[k];
    const piece = item.chars!.slice(first, last + 1).join("");
    if (k > 0) {
      const previous = pieces[k - 1];
      const sameLine =
        Math.abs(item.across - previous.item.across) < 0.5 * item.h;
      const gap =
        item.along +
        item.starts![first] -
        (previous.item.along + previous.item.ends![previous.last]);
      if (!sameLine || gap > 0.15 * item.h) text += " ";
    }
    text += piece;
  }
  const { item, first } = pieces[0];
  return {
    text,
    horizontal: Math.abs(item.ux) >= Math.abs(item.uy),
    start: { item, first },
  };
}

/** What is printed before a link on its line, up to 40 characters: earlier
 *  items on the line, then its first item's own characters before it. Read
 *  only for the links whose type word depends on it. */
function lineBefore(items: readonly Placed[], start: Under["start"]): string {
  if (!start) return "";
  const { item, first } = start;
  const line = items
    .filter(
      (other) =>
        other.index < item.index &&
        Math.abs(other.across - item.across) < 0.5 * item.h,
    )
    .map((other) => other.str)
    .join(" ");
  return `${line} ${item.chars!.slice(0, first).join("")}`.slice(-40);
}

const EDGE_PUNCTUATION = /^[,;:.]+|[,;:.]+$/g;
const DASHES = "-–—";

/** Brackets at an edge with no partner inside, at either edge ("(6.7",
 *  "6.7 (", "6.7)"). */
function trimUnbalanced(text: string): string {
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  let out = text;
  for (const [open, close] of Object.entries(pairs)) {
    const opens = out.split(open).length - 1;
    const closes = out.split(close).length - 1;
    const extra = opens > closes ? open : closes > opens ? close : null;
    if (extra && out.startsWith(extra)) out = out.slice(1);
    else if (extra && out.endsWith(extra)) out = out.slice(0, -1);
  }
  return out;
}

/** Drop dot leaders, edge punctuation, unmatched brackets and dashes at a
 *  number's edge ("–6"); punctuation alone ("–") is no text. A trailing
 *  hyphen after a letter is kept: it may join a word broken across two
 *  links. */
function clean(raw: string): string {
  let text = raw
    .replace(/[­​-‍﻿]/g, "")
    .replace(/(?:\s*[.·…]){3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (let previous = ""; previous !== text; ) {
    previous = text;
    text = trimUnbalanced(text.replace(EDGE_PUNCTUATION, "").trim()).trim();
    if (DASHES.includes(text[0] ?? "") && /\d/.test(text[1] ?? "")) {
      text = text.slice(1);
    }
    if (DASHES.includes(text.at(-1) ?? "") && /\d/.test(text.at(-2) ?? "")) {
      text = text.slice(0, -1);
    }
  }
  return LETTER_OR_DIGIT.test(text) ? text : "";
}

/** Text that reads as words (a contents entry, an author), as opposed to a
 *  bare token ("5", "3.2", "B", "IV-F", "2026b"). */
function isWords(text: string): boolean {
  return (
    /\p{Ll}{2,}/u.test(text) || (/\s/.test(text) && /\p{L}{2,}/u.test(text))
  );
}

/** A bare token, maybe after a section sign ("4.7", "B", "IV-F", "§4.7"). */
function isToken(text: string): boolean {
  return /^§*[\p{N}\p{Lu}]\S*$/u.test(text) && !isWords(text);
}

/** Type words by a target's prefix (hyperref's names). */
const PREFIX_TYPES: Record<string, string> = {
  cite: "Reference",
  chapter: "Chapter",
  appendix: "Appendix",
  part: "Part",
  section: "Section",
  subsection: "Section",
  subsubsection: "Section",
  paragraph: "Paragraph",
  figure: "Figure",
  subfigure: "Figure",
  table: "Table",
  subtable: "Table",
  equation: "Equation",
  AMS: "Equation",
  algorithm: "Algorithm",
  algocf: "Algorithm",
  lstlisting: "Listing",
  theorem: "Theorem",
  proposition: "Proposition",
  definition: "Definition",
  lemma: "Lemma",
  corollary: "Corollary",
  Hfootnote: "Footnote",
  page: "Page",
  Item: "Item",
};

/** Type words by the label printed before a link. */
const LABEL_TYPES: Record<string, string> = {
  ch: "Chapter",
  chap: "Chapter",
  chapter: "Chapter",
  chapters: "Chapter",
  app: "Appendix",
  appendix: "Appendix",
  appendices: "Appendix",
  sec: "Section",
  sect: "Section",
  section: "Section",
  sections: "Section",
  "§": "Section",
  "§§": "Section",
  fig: "Figure",
  figs: "Figure",
  figure: "Figure",
  figures: "Figure",
  tab: "Table",
  table: "Table",
  tables: "Table",
  eq: "Equation",
  eqs: "Equation",
  eqn: "Equation",
  equation: "Equation",
  equations: "Equation",
  alg: "Algorithm",
  algorithm: "Algorithm",
  algorithms: "Algorithm",
  thm: "Theorem",
  theorem: "Theorem",
  prop: "Proposition",
  proposition: "Proposition",
  def: "Definition",
  definition: "Definition",
  lemma: "Lemma",
  corollary: "Corollary",
  listing: "Listing",
  footnote: "Footnote",
  part: "Part",
  p: "Page",
  pp: "Page",
  page: "Page",
  pages: "Page",
};

/** The label right before a link, past a list ("Tables 4–", "Sec. 3, "). */
const LABEL_BEFORE =
  /(§§?|[A-Za-z]+\.?)\s*(?:(?:[A-Z]|\d+)(?:\.\d+)*[a-z]?\s*(?:,|;|–|—|-|and|or|&|to)\s*)*$/;

function typeFromDest(dest: LinkAnnotationData["dest"]): string | null {
  if (typeof dest !== "string") return null;
  const prefix = /^([A-Za-z]+)\./.exec(dest)?.[1];
  return prefix ? (PREFIX_TYPES[prefix] ?? null) : null;
}

function typeFromBefore(before: string): string | null {
  const label = LABEL_BEFORE.exec(before.trimEnd())?.[1];
  if (!label) return null;
  return LABEL_TYPES[label.replace(/\.$/, "").toLowerCase()] ?? null;
}

/**
 * The text under a cross-reference without a word the widths shifted
 * there: after its number ("4.7 discusses" gives "4.7"), or in its place
 * ("traces", or its own label "Chapter", give no text).
 */
function withoutNeighbour(text: string, type: string): string {
  const [first, next, ...rest] = text.split(" ");
  if (next && !rest.length && isToken(first) && /^\p{Ll}/u.test(next)) {
    return first;
  }
  const label = text.toLowerCase();
  if (
    /^\p{Ll}+$/u.test(text) ||
    label === type.toLowerCase() ||
    LABEL_TYPES[label] === type
  ) {
    return "";
  }
  return text;
}

/** Targets named by the number printed for them ("chapter.7" is Chapter
 *  7), as on every such link in the site's PDFs. Not sections, figures,
 *  tables or algorithms: their targets can count on their own (arXiv's). */
const NUMBERED_DEST =
  /^(?:chapter|appendix|equation|theorem|proposition|definition)\.(.+)$/;

function numberFromDest(dest: LinkAnnotationData["dest"]): string {
  return typeof dest === "string" ? (NUMBERED_DEST.exec(dest)?.[1] ?? "") : "";
}

function sameDest(a: LinkAnnotationData, b: LinkAnnotationData): boolean {
  if (typeof a.dest === "string" || typeof b.dest === "string") {
    return a.dest === b.dest;
  }
  return JSON.stringify(a.dest) === JSON.stringify(b.dest);
}

/** Whether two links sit on the same printed line. */
function sameLine(
  a: LinkAnnotationData,
  b: LinkAnnotationData,
  horizontal: boolean,
): boolean {
  const [lo, hi] = horizontal ? [1, 3] : [0, 2];
  const aLow = Math.min(a.rect[lo], a.rect[hi]);
  const aHigh = Math.max(a.rect[lo], a.rect[hi]);
  const bLow = Math.min(b.rect[lo], b.rect[hi]);
  const bHigh = Math.max(b.rect[lo], b.rect[hi]);
  const overlap = Math.min(aHigh, bHigh) - Math.max(aLow, bLow);
  return overlap >= 0.5 * Math.min(aHigh - aLow, bHigh - bLow);
}

/** The gap between two links' rectangles along their line. */
function gapBetween(
  a: LinkAnnotationData,
  b: LinkAnnotationData,
  horizontal: boolean,
): number {
  const [lo, hi] = horizontal ? [0, 2] : [1, 3];
  const aEnd = Math.max(a.rect[lo], a.rect[hi]);
  const bStart = Math.min(b.rect[lo], b.rect[hi]);
  return bStart - aEnd;
}

/**
 * Names for a page's links within the document, by annotation id. A link
 * with nothing recoverable printed under it gets its type word alone, or no
 * entry. Links to an address are left to the address (pdf-links.ts).
 */
export function nameLinks(
  annotations: readonly LinkAnnotationData[],
  text: LinkTextContent,
  measure: MeasureChar = canvasMeasure(),
): Map<string, string> {
  const names = new Map<string, string>();
  const links = annotations.filter(isInternal);
  if (links.length === 0) return names;

  const items: Placed[] = [];
  text.items.forEach((entry, index) => {
    if (!("str" in entry)) return;
    const style = text.styles[entry.fontName];
    if (style?.vertical) return;
    const placed = place(entry, index, style?.fontFamily ?? "sans-serif");
    if (placed) items.push(placed);
  });

  const read = links.map((link) => {
    const under = textUnder(link.rect, items, measure);
    return { link, ...under, text: clean(under.text) };
  });

  // Wrapped links: two annotations with one target, on two lines, where a
  // word is broken across them ("Stan-" + "ley") or words continue words.
  for (let i = 0; i + 1 < read.length; i++) {
    const a = read[i];
    const b = read[i + 1];
    if (!sameDest(a.link, b.link) || sameLine(a.link, b.link, a.horizontal)) {
      continue;
    }
    let merged: string | null = null;
    if (/\p{L}-$/u.test(a.text) && /^\p{Ll}/u.test(b.text)) {
      merged = a.text.slice(0, -1) + b.text;
    } else if (isWords(a.text) && isWords(b.text)) {
      merged = `${a.text} ${b.text}`;
    }
    if (merged) {
      // A chain shares the merged text: earlier links on it take it too.
      for (let k = i; k >= 0 && read[k].text === a.text; k--) {
        read[k].text = merged;
      }
      b.text = merged;
    }
  }
  for (const entry of read) entry.text = entry.text.replace(/-$/, "");

  read.forEach((entry, i) => {
    const { link, horizontal } = entry;
    let printed = entry.text;
    let before: string | undefined;
    const printedBefore = () => (before ??= lineBefore(items, entry.start));
    const contents = link.contentsObj?.str?.trim();
    if (contents) {
      names.set(link.id, contents);
      return;
    }
    // The widths can put a neighbouring word under a link: the word before
    // a citation's bracket ("Sybil[44"), or one at a cross-reference.
    const destType = typeFromDest(link.dest);
    let cited = false;
    const glued = /^\p{L}+\[(\S+)$/u.exec(printed);
    if (glued && isToken(glued[1])) {
      printed = glued[1];
      cited = true;
    } else if (destType && destType !== "Reference") {
      printed = withoutNeighbour(printed, destType);
    }
    if (printed && isWords(printed)) {
      names.set(link.id, printed);
      return;
    }
    const previous = read[i - 1];
    let type: string | null = null;
    // A contents page: an entry's title, then its page number, one target.
    if (
      previous &&
      typeof link.dest === "string" &&
      !link.dest.startsWith("cite.") &&
      sameDest(previous.link, link) &&
      sameLine(previous.link, link, horizontal) &&
      isWords(previous.text) &&
      (/(?:[.·…]\s*){3,}$/.test(printedBefore()) ||
        gapBetween(previous.link, link, horizontal) >
          2 *
            Math.abs(
              (horizontal ? link.rect[3] : link.rect[2]) -
                (horizontal ? link.rect[1] : link.rect[0]),
            ))
    ) {
      type = "Page";
    }
    // An explicit target says nothing of what it is: a number on the line
    // of words that point to the same place is their page.
    if (
      !type &&
      previous &&
      Array.isArray(link.dest) &&
      sameDest(previous.link, link) &&
      sameLine(previous.link, link, horizontal) &&
      isWords(previous.text)
    ) {
      type = "Page";
    }
    type ??= destType ?? typeFromBefore(printedBefore());
    // The label printed inside the link: "§5.5.2", "[5]".
    if (!type && printed.startsWith("§")) type = "Section";
    if (
      !type &&
      (cited ||
        printed.startsWith("[") ||
        /\[\s*(?:[\w.:-]+\s*[,;]\s*)*$/.test(printedBefore()))
    ) {
      type = "Reference";
    }
    const token = printed
      .replace(/^§+\s*/, "")
      .replace(/^[[(](.*)[\])]$/, "$1");
    // A number the widths lost: some targets are named by it.
    const bare =
      token.replace(/['’]s$/, "") ||
      (type === destType ? numberFromDest(link.dest) : "");
    if (!bare) {
      if (type) names.set(link.id, type);
      return;
    }
    names.set(link.id, type ? `${type} ${bare}` : bare);
  });

  // Author and year: an author's name and their year, two links to one
  // reference, read together ("Izhikevich, 2003"), also when the citation
  // wraps between them.
  read.forEach((entry, i) => {
    const previous = read[i - 1];
    if (
      previous &&
      typeof entry.link.dest === "string" &&
      entry.link.dest.startsWith("cite.") &&
      /^\d{4}[a-z]?$/.test(entry.text) &&
      sameDest(previous.link, entry.link) &&
      isWords(previous.text)
    ) {
      const both = `${previous.text}, ${entry.text}`;
      names.set(previous.link.id, both);
      names.set(entry.link.id, both);
    }
  });

  return names;
}

/** The callbacks one page gives react-pdf's `<Page>`. */
export interface PageLinkCallbacks {
  onGetAnnotationsSuccess: (annotations: readonly LinkAnnotationData[]) => void;
  onGetTextSuccess: (text: LinkTextContent) => void;
  /** For when the text layer is off (fallback fonts): fetch the text. */
  onLoadSuccess: (page: {
    getTextContent: () => Promise<LinkTextContent>;
  }) => void;
}

export interface LinkNameBook {
  /** A link's name by its annotation id, once its page is named. */
  nameOf: (id: string) => string | null;
  /** The same callbacks object for a page, always (stable props). */
  pageCallbacks: (pageNumber: number) => PageLinkCallbacks;
  /** Forget every name: a different document. */
  reset: () => void;
}

interface PageState {
  annotations?: readonly LinkAnnotationData[];
  text?: LinkTextContent;
  done: boolean;
  fetching?: boolean;
}

/**
 * Names a document's links page by page, once each: react-pdf hands every
 * page's annotations and text over again on each zoom, and those come back
 * at once. `onNamed` runs when a page's names are known, for the links
 * already on screen; links added later look their name up.
 */
export function createLinkNameBook({
  onNamed,
  measure,
}: {
  onNamed: (pageNumber: number, nameOf: (id: string) => string | null) => void;
  measure?: MeasureChar;
}): LinkNameBook {
  const names = new Map<string, string>();
  let pages = new Map<number, PageState>();
  const callbacks = new Map<number, PageLinkCallbacks>();
  let generation = 0;

  const nameOf = (id: string) => names.get(id) ?? null;
  const stateOf = (pageNumber: number) => {
    let state = pages.get(pageNumber);
    if (!state) {
      state = { done: false };
      pages.set(pageNumber, state);
    }
    return state;
  };
  const settle = (pageNumber: number) => {
    const state = stateOf(pageNumber);
    if (state.done || !state.annotations || !state.text) return;
    state.done = true;
    const named = nameLinks(state.annotations, state.text, measure);
    state.annotations = undefined;
    state.text = undefined;
    named.forEach((name, id) => names.set(id, name));
    if (named.size > 0) onNamed(pageNumber, nameOf);
  };

  const pageCallbacks = (pageNumber: number): PageLinkCallbacks => {
    const known = callbacks.get(pageNumber);
    if (known) return known;
    const made: PageLinkCallbacks = {
      onGetAnnotationsSuccess: (annotations) => {
        const state = stateOf(pageNumber);
        if (state.done) return;
        if (!annotations.some(isInternal)) {
          // Nothing to name here: never wait for its text.
          state.done = true;
          state.text = undefined;
          return;
        }
        state.annotations = annotations;
        settle(pageNumber);
      },
      onGetTextSuccess: (text) => {
        const state = stateOf(pageNumber);
        if (state.done) return;
        state.text = text;
        settle(pageNumber);
      },
      onLoadSuccess: (page) => {
        const state = stateOf(pageNumber);
        if (state.done || state.text || state.fetching) return;
        state.fetching = true;
        const at = generation;
        page.getTextContent().then(
          (text) => {
            if (at !== generation) return;
            state.fetching = false;
            made.onGetTextSuccess(text);
          },
          () => {
            state.fetching = false;
          },
        );
      },
    };
    callbacks.set(pageNumber, made);
    return made;
  };

  const reset = () => {
    names.clear();
    pages = new Map();
    generation++;
  };

  return { nameOf, pageCallbacks, reset };
}
