"use client";

/**
 * The blog's cards: a chunk of their own, fetched beside the articles
 * (Blog.tsx). The section's HTML holds its heading and skeleton until both
 * are in, so the card's code and Medium's color table need not be in the
 * page's first JavaScript.
 */

import { BlogCardHolographic } from "@/components/ui/blog-card-holographic";
import { blogSection } from "@/data/portfolio";
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

export function BlogCards({
  displayStaticBlogs,
  visibleArticles,
  mediumTextByKey,
  articleAnchorId,
  deepLinkedId,
  highlightedId,
}: {
  displayStaticBlogs: boolean;
  visibleArticles: Article[];
  mediumTextByKey: Map<string, string>;
  articleAnchorId: (article: Article) => string | undefined;
  deepLinkedId: string | null;
  highlightedId: string | null;
}) {
  return (
    <div className="flex justify-center">
      <div className="grid gap-6 md:grid-cols-2 grid-rows-auto grid-stretch max-w-[1000px]">
        {displayStaticBlogs
          ? blogSection.blogs.map((blog, index) => (
              <BlogCardHolographic
                key={index}
                title={blog.title}
                description={blog.description}
                url={blog.url}
                image={blog.image}
                index={index}
                readingTime={Math.ceil(
                  blog.description.split(" ").length / 200,
                )}
              />
            ))
          : visibleArticles.map((article, index) => {
              const anchorId = articleAnchorId(article);

              // Handle Kudos articles
              if (article.source === "kudos") {
                const kudosArticle = article as KudosArticle & {
                  source: string;
                  sortDate: number;
                };
                return (
                  <div
                    key={`kudos-${kudosArticle.url}`}
                    id={anchorId}
                    className={cn(
                      "h-full",
                      anchorId &&
                        highlightedId === anchorId &&
                        "deep-link-highlight",
                    )}
                  >
                    <BlogCardHolographic
                      title={kudosArticle.title}
                      description={kudosArticle.description}
                      url={kudosArticle.url}
                      date={kudosArticle.date}
                      author={kudosArticle.author}
                      image={kudosArticle.image}
                      index={index}
                      readingTime={Math.ceil(
                        kudosArticle.description.split(" ").length / 200,
                      )}
                      anchorId={anchorId}
                      isDeepLinked={!!anchorId && deepLinkedId === anchorId}
                    />
                  </div>
                );
              }

              // Handle Medium posts
              const post = article as MediumPost & {
                source: string;
                sortDate: number;
              };
              const content = mediumTextByKey.get(post.guid || post.link) ?? "";

              // The server picks the picture and serves it itself: a
              // Medium URL here would have the browser load it there.
              const imageUrl = post.image;

              // Use enriched color from scraper, fallback to cached colors
              const guidColor = (mediumColors as MediumColors)[post.guid];
              const linkColor = (mediumColors as MediumColors)[post.link];
              const postColor =
                post.enrichedColor || guidColor?.color || linkColor?.color;

              return (
                <div
                  key={post.guid}
                  id={anchorId}
                  className={cn(
                    "h-full",
                    anchorId &&
                      highlightedId === anchorId &&
                      "deep-link-highlight",
                  )}
                >
                  <BlogCardHolographic
                    title={post.title}
                    description={content}
                    url={post.link}
                    date={post.pubDate}
                    image={imageUrl || undefined}
                    color={postColor}
                    index={index}
                    readingTime={Math.ceil(content.split(" ").length / 200)}
                    anchorId={anchorId}
                    isDeepLinked={!!anchorId && deepLinkedId === anchorId}
                  />
                </div>
              );
            })}
      </div>
    </div>
  );
}
