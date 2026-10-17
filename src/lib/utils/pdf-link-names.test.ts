import { describe, it, expect, vi, afterEach } from "vitest";
import { TIMES_ROMAN } from "./pdf-font-widths";
import {
  coreFontMeasure,
  createLinkNameBook,
  nameLinks,
  type LinkAnnotationData,
  type LinkTextContent,
  type LinkTextItem,
  type MeasureChar,
} from "./pdf-link-names";

/**
 * pdf.js draws a PDF's links as empty <a>s, so a screen reader announced the
 * 3,400 links within the site's PDFs (citations, cross-references, contents
 * entries) as "link". Their names come from the text printed under them.
 */

// Character widths roughly as Helvetica's, per 1,000 units of a 1 pt font:
// the fixtures' geometry and the module read the same table.
const WIDTH: Record<string, number> = {
  " ": 278,
  ".": 278,
  ",": 278,
  ":": 278,
  ";": 278,
  "[": 278,
  "]": 278,
  "(": 333,
  ")": 333,
  "-": 333,
  "–": 556,
  "§": 556,
};
const measure: MeasureChar = (char) =>
  WIDTH[char] ?? (/\d/.test(char) ? 556 : /[A-Z]/.test(char) ? 667 : 500);
const advance = (text: string, size: number) =>
  (Array.from(text).reduce((sum, char) => sum + measure(char, ""), 0) * size) /
  1000;

/** A text item printed left to right from (x, y), as pdf.js gives it. */
function item(str: string, x: number, y: number, size = 9): LinkTextItem {
  return {
    str,
    transform: [size, 0, 0, size, x, y],
    width: advance(str, size),
    height: size,
    fontName: "f1",
  };
}

/** The rectangle hyperref draws over `part` of a line. */
function over(line: LinkTextItem, part: string): number[] {
  const at = line.str.indexOf(part);
  const [size, , , , x, y] = line.transform;
  const start = x + advance(line.str.slice(0, at), size);
  const end = start + advance(part, size);
  return [start - 0.3, y - 0.2 * size, end + 0.3, y + 0.75 * size];
}

const content = (...items: LinkTextItem[]): LinkTextContent => ({
  items,
  styles: { f1: { fontFamily: "sans-serif" } },
});

const link = (
  id: string,
  rect: number[],
  dest: LinkAnnotationData["dest"],
  extra: Partial<LinkAnnotationData> = {},
): LinkAnnotationData => ({ id, subtype: "Link", rect, dest, ...extra });

const name = (annotations: LinkAnnotationData[], text: LinkTextContent) =>
  Object.fromEntries(nameLinks(annotations, text, measure));

/** An explicit destination, as some PDFs (and their excerpts) have. */
const PAGE_12 = [{ num: 40, gen: 0 }, { name: "XYZ" }, 72, 720, null];

describe("nameLinks", () => {
  it("names a citation inside a long printed line", () => {
    // pdf.js merges the whole line into one item.
    const line = item("connection. ES-HyperNEAT [5] automatically", 72, 500);

    expect(
      name(
        [link("98R", over(line, "5"), "cite.risi2012enhanced")],
        content(line),
      ),
    ).toEqual({ "98R": "Reference 5" });
  });

  it("types a figure and a section by the target's prefix", () => {
    const figure = item("budget (Figure 1). This performs", 72, 500);
    const section = item("parallel cores (Section 3).", 72, 480);

    expect(
      name(
        [
          link("104R", over(figure, "1"), "figure.caption.5"),
          link("105R", over(section, "3"), "section.3"),
        ],
        content(figure, section),
      ),
    ).toEqual({ "104R": "Figure 1", "105R": "Section 3" });
  });

  it("keeps the printed number when the target's counter differs", () => {
    // arXiv's anchors are counters of their own: section.42 is printed "4".
    const line = item("as shown in Section 4 below", 72, 500);
    const roman = item("see Table I for", 72, 480);

    expect(
      name(
        [
          link("1R", over(line, "4"), "section.42"),
          link("2R", over(roman, "I"), "table.1"),
        ],
        content(line, roman),
      ),
    ).toEqual({ "1R": "Section 4", "2R": "Table I" });
  });

  it("types a link by the word printed before it", () => {
    // An explicit destination says nothing of what it points to.
    const line = item("the architecture (Ch. 4), the", 72, 500);

    expect(
      name([link("28R", over(line, "4"), PAGE_12)], content(line)),
    ).toEqual({ "28R": "Chapter 4" });
  });

  it("reads a contents entry as printed, and its page as a page", () => {
    const title = item(
      "1.1 The Case for Evolved Neural Architectures",
      72,
      600,
    );
    const leaders = item(". . . . . . . . . . . .", 300, 600);
    const page = item("5", 500, 600);

    expect(
      name(
        [
          link("1407R", over(title, title.str), PAGE_12),
          link("1408R", over(page, "5"), PAGE_12),
        ],
        content(title, leaders, page),
      ),
    ).toEqual({
      "1407R": "1.1 The Case for Evolved Neural Architectures",
      "1408R": "Page 5",
    });
  });

  it("joins a link broken across two lines", () => {
    const first = item("results were reported by (Stan-", 72, 500);
    const second = item("ley et al., 2009) for the", 72, 488);

    expect(
      name(
        [
          link("51R", over(first, "Stan-"), "cite.stanley2009"),
          link("52R", over(second, "ley et al"), "cite.stanley2009"),
        ],
        content(first, second),
      ),
    ).toEqual({ "51R": "Stanley et al", "52R": "Stanley et al" });
  });

  it("reads an author and their year together, also across a line break", () => {
    // Author-year citations are two links to one reference.
    const line = item("spiking (Izhikevich, 2003) and in", 72, 500);
    const first = item("plasticity (Markram et al.,", 72, 488);
    const second = item("2004) that the", 72, 476);

    expect(
      name(
        [
          link("10R", over(line, "Izhikevich"), "cite.izhikevich2003"),
          link("11R", over(line, "2003"), "cite.izhikevich2003"),
          link("94R", over(first, "Markram et al"), "cite.markram2004"),
          link("95R", over(second, "2004"), "cite.markram2004"),
        ],
        content(line, first, second),
      ),
    ).toEqual({
      "10R": "Izhikevich, 2003",
      "11R": "Izhikevich, 2003",
      "94R": "Markram et al, 2004",
      "95R": "Markram et al, 2004",
    });
  });

  it("names each end of a range", () => {
    const line = item("were reported (Tables 4–7) in", 72, 500);

    expect(
      name(
        [
          link("120R", over(line, "4"), "table.4"),
          link("121R", over(line, "7"), "table.7"),
        ],
        content(line),
      ),
    ).toEqual({ "120R": "Table 4", "121R": "Table 7" });
  });

  it("reads a section sign as a section", () => {
    const line = item("as described in §5.5.2, the", 72, 500);

    expect(
      name(
        [link("9R", over(line, "§5.5.2"), "subsection.5.5.2")],
        content(line),
      ),
    ).toEqual({ "9R": "Section 5.5.2" });
  });

  it("reads a section sign as a section, whatever the target", () => {
    // Explicit destinations (the thesis excerpt) give no type of their own.
    const line = item("as shown in §7.6.2, the", 72, 500);

    expect(
      name([link("305R", over(line, "§7.6.2"), PAGE_12)], content(line)),
    ).toEqual({ "305R": "Section 7.6.2" });
  });

  it("drops a bracket left open at either end", () => {
    const line = item("see Table 6.7 (left) for", 72, 500);

    expect(
      name([link("6733R", over(line, "6.7 ("), "table.6.7")], content(line)),
    ).toEqual({ "6733R": "Table 6.7" });
  });

  it("names a link over punctuation alone by its type word", () => {
    // Where the widths put a range's dash, not its number, under the link.
    const line = item("in Tables 2–3 the", 72, 500);

    expect(
      name([link("390R", over(line, "–"), "table.52")], content(line)),
    ).toEqual({ "390R": "Table" });
  });

  it("falls back to the type word, or no name, when nothing is printed", () => {
    const line = item("an unrelated line", 72, 500);
    const nowhere = [300, 100, 310, 110];

    expect(
      name(
        [link("1R", nowhere, PAGE_12), link("2R", nowhere, "Hfootnote.1")],
        content(line),
      ),
    ).toEqual({ "2R": "Footnote" });
  });

  it("drops a word the widths put after a number", () => {
    // Where the widths put the next word's first letter under the link.
    const line = item("re-tuning. As §4.7 discusses, the", 72, 500);
    const title = item("4.2 Mean test accuracy", 72, 488);
    const lower = item("4.3 k-means clusters by layer", 72, 476);

    expect(
      name(
        [
          link("4265R", over(line, "4.7 d"), "section.4.7"),
          link("1880R", over(title, title.str), "table.caption.12"),
          link("1881R", over(lower, lower.str), "table.caption.13"),
        ],
        content(line, title, lower),
      ),
    ).toEqual({
      "4265R": "Section 4.7",
      "1880R": "4.2 Mean test accuracy",
      "1881R": "4.3 k-means clusters by layer",
    });
  });

  it("reads a citation glued to the word before its bracket", () => {
    // Where the widths put the word before the bracket under the link.
    const line = item("consensus PoS avoids a Sybil[44] attack", 72, 500);

    expect(
      name([link("211R", over(line, "l[44"), PAGE_12)], content(line)),
    ).toEqual({ "211R": "Reference 44" });
  });

  it("takes a chapter's number from its target when a word took its place", () => {
    // Where the widths put the next word, or the label, under the link. A
    // wrapped entry's last word is read with its first line.
    const line = item("this thesis. Chapter 7 traces the research", 72, 500);
    const entry = item("3.25 Summary of Chapter 3 results", 72, 488);
    const first = item("2.7 Substrate built by quadtree decom-", 72, 476);
    const second = item("position", 90, 464);

    expect(
      name(
        [
          link("2417R", over(line, "tr"), "chapter.7"),
          link("1999R", over(entry, "Chap"), "chapter.3"),
          link("1806R", over(first, first.str), "figure.2.7"),
          link("1807R", over(second, "position"), "figure.2.7"),
        ],
        content(line, entry, first, second),
      ),
    ).toEqual({
      "2417R": "Chapter 7",
      "1999R": "Chapter 3",
      "1806R": "2.7 Substrate built by quadtree decomposition",
      "1807R": "2.7 Substrate built by quadtree decomposition",
    });
  });

  it("takes a chapter's number from its target when none is under the link", () => {
    // Where the widths put the comma after the number under the link: a
    // chapter's target ends in its number. Not a section's (arXiv's), and
    // not a contents entry's page.
    const chapter = item("the architecture in Chapter 4, which", 72, 500);
    const section = item("the protocol in Section 3.2, which", 72, 488);
    const title = item("7 Conclusion", 72, 476);
    const leaders = item(". . . . . . . . . . . .", 300, 476);

    expect(
      name(
        [
          link("2988R", over(chapter, ","), "chapter.4"),
          link("2989R", over(section, ","), "section.3.2"),
          link("1450R", over(title, title.str), "chapter.7"),
          link("1451R", over(leaders, ". . ."), "chapter.7"),
        ],
        content(chapter, section, title, leaders),
      ),
    ).toEqual({
      "2988R": "Chapter 4",
      "2989R": "Section",
      "1450R": "7 Conclusion",
      "1451R": "Page",
    });
  });

  it("reads text turned on its side", () => {
    // Landscape pages: the text runs up the page.
    const size = 9;
    const x = 300;
    const y = 100;
    const str = "see [7] for details";
    const rotated: LinkTextItem = {
      str,
      transform: [0, size, -size, 0, x, y],
      width: advance(str, size),
      height: size,
      fontName: "f1",
    };
    const start = y + advance("see [", size);
    const end = start + advance("7", size);
    const rect = [x - 0.75 * size, start - 0.3, x + 0.2 * size, end + 0.3];

    expect(name([link("7R", rect, "cite.x")], content(rotated))).toEqual({
      "7R": "Reference 7",
    });
  });

  it("prefers the PDF's own description of a link", () => {
    const line = item("back to the contents", 72, 500);

    expect(
      name(
        [
          link("1R", over(line, "contents"), PAGE_12, {
            contentsObj: { str: "Table of contents" },
          }),
        ],
        content(line),
      ),
    ).toEqual({ "1R": "Table of contents" });
  });

  it("leaves a link to an address to the address", () => {
    const line = item("doi.org/10.1145/1", 72, 500);

    expect(
      name(
        [
          link("3R", over(line, line.str), null, {
            url: "https://doi.org/10.1145/1",
          }),
        ],
        content(line),
      ),
    ).toEqual({});
  });

  it("reads split items with no width data", () => {
    // Some PDFs split a line at the link; with uniform widths (jsdom), the
    // item boundaries still place the text.
    const head = item("ES-HyperNEAT [", 72, 500);
    const five = item("5", 72 + head.width, 500);
    const tail = item("] automatically", 72 + head.width + five.width, 500);

    expect(
      Object.fromEntries(
        nameLinks(
          [link("98R", over(five, "5"), "cite.risi2012enhanced")],
          content(head, five, tail),
          () => 1,
        ),
      ),
    ).toEqual({ "98R": "Reference 5" });
  });
});

describe("nameLinks' own widths", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("are the same on every system", async () => {
    // They were a canvas's, in the generic family pdf.js names ("serif"),
    // which each system resolves to a font of its own: on Linux, links read
    // "Section" where the page prints "Section 4.2". Here a canvas measures
    // every character alike, as a font far from the PDF's would.
    const alike = { font: "", measureText: () => ({ width: 50 }) };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      alike as unknown as ReturnType<HTMLCanvasElement["getContext"]>,
    );
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        getContext() {
          return alike;
        }
      },
    );
    vi.resetModules();
    const fresh = await import("./pdf-link-names");

    // Printed in Times at 10 pt, the link over "4.2" alone.
    const size = 10;
    const advance = (text: string) =>
      (Array.from(text).reduce((sum, char) => sum + TIMES_ROMAN[char], 0) *
        size) /
      1000;
    const str =
      "as will be illustrated in Section 4.2 when we compare MAP-Elites with NEAT";
    const start = 72 + advance(str.slice(0, str.indexOf("4.2")));
    const end = start + advance("4.2");
    const line: LinkTextItem = {
      str,
      transform: [size, 0, 0, size, 72, 500],
      width: advance(str),
      height: size,
      fontName: "f1",
    };

    expect(
      Object.fromEntries(
        fresh.nameLinks(
          [link("7R", [start - 0.3, 498, end + 0.3, 507.5], "subsection.4.2")],
          { items: [line], styles: { f1: { fontFamily: "serif" } } },
        ),
      ),
    ).toEqual({ "7R": "Section 4.2" });
  });

  it("are the PDF core fonts' for pdf.js's three families", () => {
    // Adobe's metrics, in thousandths of an em.
    expect(coreFontMeasure("m", "serif")).toBe(778);
    expect(coreFontMeasure("i", "serif")).toBe(278);
    expect(coreFontMeasure("m", "sans-serif")).toBe(833);
    expect(coreFontMeasure("i", "sans-serif")).toBe(222);
    expect(coreFontMeasure("m", "monospace")).toBe(600);
    expect(coreFontMeasure("i", "monospace")).toBe(600);
  });

  it("weigh what the fonts lack as a space or as an average character", () => {
    // A no-break space is a space; a Greek letter weighs the mean of the
    // font's letters and digits, between its narrowest and widest.
    expect(coreFontMeasure("\u00a0", "serif")).toBe(
      coreFontMeasure(" ", "serif"),
    );
    const alpha = coreFontMeasure("α", "serif");
    expect(alpha).toBeGreaterThan(coreFontMeasure("i", "serif"));
    expect(alpha).toBeLessThan(coreFontMeasure("W", "serif"));
    // A family pdf.js does not name reads as sans-serif, its default.
    expect(coreFontMeasure("m", "cursive")).toBe(
      coreFontMeasure("m", "sans-serif"),
    );
  });
});

describe("createLinkNameBook", () => {
  const line = item("connection. ES-HyperNEAT [5] automatically", 72, 500);
  const annotations = [link("98R", over(line, "5"), "cite.risi2012enhanced")];
  const text = content(line);

  it("names a page once both halves are in, in either order", () => {
    const onNamed = vi.fn();
    const book = createLinkNameBook({ onNamed, measure });

    book.pageCallbacks(1).onGetTextSuccess(text);
    expect(book.nameOf("98R")).toBeNull();
    book.pageCallbacks(1).onGetAnnotationsSuccess(annotations);

    expect(book.nameOf("98R")).toBe("Reference 5");
    expect(onNamed).toHaveBeenCalledTimes(1);
    expect(onNamed).toHaveBeenCalledWith(1, book.nameOf);

    const other = createLinkNameBook({ onNamed: vi.fn(), measure });
    other.pageCallbacks(2).onGetAnnotationsSuccess(annotations);
    other.pageCallbacks(2).onGetTextSuccess(text);
    expect(other.nameOf("98R")).toBe("Reference 5");
  });

  it("tells a listener the pages named while it listens", () => {
    const book = createLinkNameBook({ measure });
    const listener = vi.fn();
    const stop = book.listen(listener);

    book.pageCallbacks(1).onGetAnnotationsSuccess(annotations);
    book.pageCallbacks(1).onGetTextSuccess(text);
    expect(listener).toHaveBeenCalledWith(1, book.nameOf);

    stop();
    book.pageCallbacks(2).onGetAnnotationsSuccess(annotations);
    book.pageCallbacks(2).onGetTextSuccess(text);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(book.nameOf("98R")).toBe("Reference 5");
  });

  it("does no work again when a zoom hands the page over again", () => {
    const onNamed = vi.fn();
    const book = createLinkNameBook({ onNamed, measure });
    const page = book.pageCallbacks(1);
    page.onGetAnnotationsSuccess(annotations);
    page.onGetTextSuccess(text);

    page.onGetAnnotationsSuccess(annotations);
    page.onGetTextSuccess(text);

    expect(onNamed).toHaveBeenCalledTimes(1);
    expect(book.pageCallbacks(1)).toBe(page);
  });

  it("forgets every name for a different document", () => {
    const book = createLinkNameBook({ onNamed: vi.fn(), measure });
    book.pageCallbacks(1).onGetAnnotationsSuccess(annotations);
    book.pageCallbacks(1).onGetTextSuccess(text);

    book.reset();

    expect(book.nameOf("98R")).toBeNull();
  });

  it("fetches the text itself when the text layer is off", async () => {
    // Fallback fonts turn the text layer off, and with it onGetTextSuccess.
    const onNamed = vi.fn();
    const book = createLinkNameBook({ onNamed, measure });
    const page = book.pageCallbacks(1);
    const getTextContent = vi.fn(async () => text);

    page.onGetAnnotationsSuccess(annotations);
    page.onLoadSuccess({ getTextContent });
    page.onLoadSuccess({ getTextContent });
    await vi.waitFor(() => expect(book.nameOf("98R")).toBe("Reference 5"));

    expect(getTextContent).toHaveBeenCalledTimes(1);
  });

  it("ignores text fetched for a document it has since left", async () => {
    const book = createLinkNameBook({ onNamed: vi.fn(), measure });
    let deliver: (value: LinkTextContent) => void = () => {};
    const getTextContent = () =>
      new Promise<LinkTextContent>((resolve) => {
        deliver = resolve;
      });
    book.pageCallbacks(1).onGetAnnotationsSuccess(annotations);
    book.pageCallbacks(1).onLoadSuccess({ getTextContent });

    book.reset();
    deliver(text);
    await Promise.resolve();

    expect(book.nameOf("98R")).toBeNull();
  });

  it("never waits for the text of a page with no links to name", () => {
    const onNamed = vi.fn();
    const book = createLinkNameBook({ onNamed, measure });
    const getTextContent = vi.fn(async () => text);

    book.pageCallbacks(1).onGetAnnotationsSuccess([]);
    book.pageCallbacks(1).onLoadSuccess({ getTextContent });

    expect(getTextContent).not.toHaveBeenCalled();
    expect(onNamed).not.toHaveBeenCalled();
  });
});
