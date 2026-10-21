"use client";

/**
 * The blog's cards: a chunk of their own, fetched beside the articles
 * (Blog.tsx). The section's HTML holds its heading and skeleton until both
 * are in, so the card's code and Medium's color table need not be in the
 * page's first JavaScript.
 */

import { BlogCardHolographic } from "@/components/ui/blog-card-holographic";
import { lazyDetails } from "@/components/ui/lazy-details";
import { blogSection } from "@/data/portfolio";
import type { useDetailsDialog } from "@/lib/hooks/useDetailsDialog";
import mediumColors from "@/lib/utils/medium-colors.json";
import { cn } from "@/lib/utils";

interface MediumColorEntry {
  color?: string;
}

interface MediumColors {
  [key: string]: MediumColorEntry;
}

export interface MediumPost {
  title: string;
  link: string;
  pubDate: string;
  content: string;
  contentSnippet?: string;
  description?: string;
  guid: string;
  isoDate: string;
  categories?: string[];
  /** The picture, through /api/blog-image (the API's medium-posts). */
  image?: string | null;
  enrichedColor?: string;
}

export interface KudosArticle {
  id?: string; // stable deep-link anchor (absent in older cached responses)
  title: string;
  description: string;
  url: string;
  date: string;
  author: string;
  tags?: string[];
  image?: string;
  type: "research-story";
  venue?: string;
  publisher?: string;
  doi?: string;
  highlights?: string[];
  applications?: string[];
  perspectives?: string;
}

export type Article =
  | (KudosArticle & { source: "kudos"; sortDate: number })
  | (MediumPost & { source: "medium"; sortDate: number });

/**
 * Which post's details are open: by its address, so the dialog follows the
 * lists as they arrive. The card gives its colour; a link gives none.
 */
export interface BlogSubject {
  url: string;
  accent?: string;
}

/** The section's details dialog (Blog.tsx keeps it: links open it). */
export type BlogDetails = ReturnType<typeof useDetailsDialog<BlogSubject>>;

// A post's whole text (BlogDetailsDialog.tsx): a chunk of its own, fetched
// when a Read more is pointed at or focused.
const { Dialog: BlogDetailsDialog, intent: blogIntent } = lazyDetails(
  () => import("./BlogDetailsDialog").then((mod) => mod.BlogDetailsDialog),
  "Blog details chunk",
);

// Where a block of the post ends, and a line breaks, until the whitespace is
// settled: private-use characters, which no post holds and \s does not match.
const BLOCK_END = "\uE000";
const LINE_BREAK = "\uE001";
const BLOCKS = "p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, figure";

// Extract text content from HTML safely using DOMParser. The paragraphs are
// kept, a blank line between two, for the post's details dialog, and the
// photos' captions left out. Exported for tests.
export function extractTextContent(html: string): string {
  if (typeof html !== "string") return "";

  // Strip out tracking pixels and scripts before processing
  const cleanedHtml = html
    .replace(/<img[^>]*medium\.com\/_\/stat[^>]*>/gi, "") // Remove Medium tracking pixels
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ""); // Remove scripts

  // Use DOMParser for safe HTML parsing (doesn't execute scripts)
  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanedHtml, "text/html");
  // A photo's caption is its credit ("Photo by ... on Unsplash"), not the
  // post's text. The text was cut at the first credit instead, and Medium
  // puts a photo under a post's first lines: both posts on the site were
  // down to their first sentence (64 and 127 of 854 and 1,559 characters),
  // too short for a Read more.
  doc.body
    .querySelectorAll("figcaption")
    .forEach((caption) => caption.remove());
  doc.body.querySelectorAll(BLOCKS).forEach((block) => block.append(BLOCK_END));
  doc.body.querySelectorAll("br").forEach((br) => br.replaceWith(LINE_BREAK));
  return (doc.body.textContent || "")
    .replace(/\s+/g, " ")
    .replace(/[ \uE001]*\uE000[\s\uE000\uE001]*/g, "\n\n")
    .replace(/ ?\uE001 ?/g, "\n")
    .trim();
}

// Each Medium post's text, parsed once per fetch rather than on every render
// (extractTextContent spins up a DOMParser per call): the posts are the same
// objects until the next fetch.
const mediumTexts = new WeakMap<MediumPost, string>();
function mediumText(post: MediumPost) {
  let text = mediumTexts.get(post);
  if (text === undefined) {
    text = extractTextContent(post.contentSnippet || post.content);
    mediumTexts.set(post, text);
  }
  return text;
}

/** A card, whichever list it comes from. */
interface BlogEntry {
  key: string;
  title: string;
  /** The whole text: the card shows its start, the dialog all of it. */
  text: string;
  url: string;
  date?: string;
  author?: string;
  image?: string;
  color?: string;
  anchorId?: string;
}

/** Minutes to read a text, at 200 words a minute. */
const readingTimeOf = (text: string) =>
  Math.ceil(text.split(/\s+/).length / 200);

/** The start of a long text, for the dialog's stand-in, which does not scroll. */
function excerpt(text: string, max = 280) {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(" ", max);
  return `${text.slice(0, cut > 0 ? cut : max)}…`;
}

export function BlogCards({
  displayStaticBlogs,
  visibleArticles,
  articleAnchorId,
  deepLinkedId,
  highlightedId,
  details,
}: {
  displayStaticBlogs: boolean;
  visibleArticles: Article[];
  articleAnchorId: (article: Article) => string | undefined;
  deepLinkedId: string | null;
  highlightedId: string | null;
  details: BlogDetails;
}) {
  const entries: BlogEntry[] = displayStaticBlogs
    ? blogSection.blogs.map((blog, index) => ({
        key: `static-${index}`,
        title: blog.title,
        text: blog.description,
        url: blog.url,
        image: blog.image,
      }))
    : visibleArticles.map((article) => {
        const anchorId = articleAnchorId(article);

        // Handle Kudos articles
        if (article.source === "kudos") {
          return {
            key: `kudos-${article.url}`,
            title: article.title,
            text: article.description,
            url: article.url,
            date: article.date,
            author: article.author,
            image: article.image,
            anchorId,
          };
        }

        // Handle Medium posts. The server picks the picture and serves it
        // itself: a Medium URL here would have the browser load it there.
        // Use enriched color from scraper, fallback to cached colors
        const guidColor = (mediumColors as MediumColors)[article.guid];
        const linkColor = (mediumColors as MediumColors)[article.link];
        return {
          key: article.guid,
          title: article.title,
          text: mediumText(article),
          url: article.link,
          date: article.pubDate,
          image: article.image || undefined,
          color: article.enrichedColor || guidColor?.color || linkColor?.color,
          anchorId,
        };
      });

  // The open post, from the latest lists.
  const open = details.open;
  const openEntry =
    open && entries.find((entry) => entry.url === open.item.url);

  return (
    <div className="flex justify-center">
      <div className="grid gap-6 md:grid-cols-2 grid-rows-auto grid-stretch max-w-[1000px]">
        {entries.map((entry, index) => (
          <div
            key={entry.key}
            id={entry.anchorId}
            className={cn(
              "h-full",
              entry.anchorId &&
                highlightedId === entry.anchorId &&
                "deep-link-highlight",
            )}
          >
            <BlogCardHolographic
              title={entry.title}
              description={entry.text}
              url={entry.url}
              date={entry.date}
              author={entry.author}
              image={entry.image}
              color={entry.color}
              index={index}
              readingTime={readingTimeOf(entry.text)}
              anchorId={entry.anchorId}
              isDeepLinked={!!entry.anchorId && deepLinkedId === entry.anchorId}
              onOpenDetails={(trigger, accent) =>
                details.show({ url: entry.url, accent }, trigger)
              }
              detailsIntent={blogIntent}
            />
          </div>
        ))}
      </div>

      {/* A post's whole text, once for the section, outside the cards */}
      {details.dialog && open && openEntry && (
        <BlogDetailsDialog
          title={openEntry.title}
          summary={excerpt(openEntry.text)}
          text={openEntry.text}
          url={openEntry.url}
          date={openEntry.date}
          readingTime={readingTimeOf(openEntry.text)}
          author={openEntry.author ?? "Romain Claret"}
          accent={open.item.accent ?? openEntry.color ?? "71, 85, 105"}
          dialog={details.dialog}
        />
      )}
    </div>
  );
}
