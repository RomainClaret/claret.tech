/**
 * Medium's RSS feed, read without a third party. rss2json, which turned it
 * into JSON for the site until 2026-10, answers servers with a Cloudflare
 * challenge: from then on the blog showed no Medium posts and /rss.xml was
 * empty. Medium's feed is regular (one <item> per post, its text in CDATA),
 * so a few patterns read it.
 *
 * Plain Node runs this file too: the build's color script
 * (scripts/extract-medium-colors.js) requires it, and Node 24 strips the
 * types. So it imports nothing and uses only erasable TypeScript.
 */

/** One post, with the fields rss2json gave. */
export interface MediumRssItem {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  author: string;
  categories: string[];
  /** The post's HTML. */
  content: string;
  /** Its first image, as rss2json's `thumbnail` was. */
  thumbnail?: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** XML text with its entities decoded. */
function decode(raw: string): string {
  return raw.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (entity, code: string) => {
      if (code[0] !== "#") return NAMED_ENTITIES[code] ?? entity;
      const point =
        code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    },
  );
}

/**
 * CDATA sections, set aside before any tag is matched: a section's text is
 * the author's (a title, a post), and a "<link>" or "</item><item>" in it
 * took over a card's link or added whole posts. Each becomes a NUL-quoted
 * index, which XML text cannot contain.
 */
function maskCdata(xml: string): { masked: string; sections: string[] } {
  const sections: string[] = [];
  const masked = xml.replace(
    /<!\[CDATA\[([\s\S]*?)\]\]>/g,
    (_section, body: string) => `\u0000${sections.push(body) - 1}\u0000`,
  );
  return { masked, sections };
}

/**
 * An element's text: its CDATA sections as they are, the rest decoded. A
 * "]]>" inside the text arrives split across two sections.
 */
function text(raw: string, sections: string[]): string {
  let out = "";
  let last = 0;
  // NUL is the mark because XML text cannot contain it (maskCdata).
  // eslint-disable-next-line no-control-regex
  for (const mark of raw.matchAll(/\u0000(\d+)\u0000/g)) {
    out +=
      decode(raw.slice(last, mark.index)) + (sections[Number(mark[1])] ?? "");
    last = mark.index + mark[0].length;
  }
  return (out + decode(raw.slice(last))).trim();
}

/** The text of each `tag` element in `xml` (CDATA masked), in order. */
function elements(xml: string, tag: string, sections: string[]): string[] {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  return Array.from(xml.matchAll(pattern), (match) => text(match[1], sections));
}

/** Medium's view counter: an image in every post, never its picture. */
const TRACKING_PIXEL = "https://medium.com/_/stat";

/**
 * The posts in a Medium RSS document, in the feed's order (newest first).
 * Throws when the document is not RSS: a challenge or an error page answers
 * with HTML.
 */
export function parseMediumRss(xml: string): MediumRssItem[] {
  if (!/<rss[\s>]/.test(xml) || !xml.includes("<channel>")) {
    throw new Error("Not an RSS feed");
  }
  const { masked, sections } = maskCdata(xml);
  return Array.from(
    masked.matchAll(/<item>([\s\S]*?)<\/item>/g),
    ([, item]) => {
      const first = (tag: string) => elements(item, tag, sections)[0] ?? "";
      const content = first("content:encoded");
      const images = Array.from(
        content.matchAll(/<img[^>]+src="([^"]+)"/g),
        (match) => match[1],
      );
      return {
        title: first("title"),
        link: first("link"),
        guid: first("guid"),
        pubDate: first("pubDate"),
        author: first("dc:creator"),
        categories: elements(item, "category", sections),
        content,
        thumbnail: images.find((src) => !src.startsWith(TRACKING_PIXEL)),
      };
    },
  );
}
