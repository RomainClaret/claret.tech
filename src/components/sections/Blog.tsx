"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { blogSection } from "@/data/portfolio";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { withLoadFallback } from "@/lib/utils/load-fallback";
import { loadOnIntent } from "@/lib/utils/load-on-intent";
import { reloadPage } from "@/lib/utils/reload-page";
import type { BlogSubject, KudosArticle, MediumPost } from "./BlogCards";
import { useCardDeepLink } from "@/lib/hooks/useCardDeepLink";
import { useDetailsDialog } from "@/lib/hooks/useDetailsDialog";
import { cn } from "@/lib/utils";
import { logError } from "@/lib/utils/dev-logger";

// Deep-link anchor for a Medium post: the URL slug (title slug plus Medium's
// permanent post hash), stable across title edits. Exported for tests.
export function mediumAnchorId(link: string): string | undefined {
  try {
    return new URL(link).pathname.split("/").filter(Boolean).pop() || undefined;
  } catch {
    return undefined;
  }
}

/** The cards' place until the articles and their code are in, as the HTML has it. */
function BlogSkeleton() {
  const shouldReduceAnimations = useShouldReduceAnimations();
  return (
    <div className="flex justify-center">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-[1200px]">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "bg-card border border-border rounded-lg p-6 h-64",
              !shouldReduceAnimations && "animate-pulse",
            )}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-muted rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded-sm w-20 mb-2" />
                <div className="h-3 bg-muted rounded-sm w-24" />
              </div>
            </div>
            <div className="h-6 bg-muted rounded-sm mb-4 w-3/4" />
            <div className="h-4 bg-muted rounded-sm mb-2" />
            <div className="h-4 bg-muted rounded-sm w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * In the cards' place while their code cannot be fetched: no connection, or
 * a deploy since this page loaded (Vercel's Hobby plan keeps no older
 * chunks). Without it, React.lazy threw and the page's error boundary
 * replaced every section.
 */
function BlogCardsUnavailable({
  retry,
  retrying,
}: {
  retry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="text-center" role="alert">
      <p className="text-muted-foreground">The articles could not load.</p>
      <div className="mt-4 flex justify-center gap-4 text-sm">
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="text-primary hover:underline disabled:opacity-60 disabled:no-underline"
        >
          {retrying ? "Trying again..." : "Try again"}
        </button>
        {!retrying && (
          <button
            type="button"
            onClick={reloadPage}
            className="text-primary hover:underline"
          >
            Reload page
          </button>
        )}
      </div>
    </div>
  );
}

// The cards' code comes with the articles: its import starts beside their
// fetch, below, and the cards show once both are in.
const cards = loadOnIntent(() => import("./BlogCards"));
const BlogCards = dynamic(
  withLoadFallback(
    () => cards.load().then((mod) => mod.BlogCards),
    BlogCardsUnavailable,
    {
      onError: (error) => logError(error, "Blog cards chunk"),
      peek: () => cards.loaded()?.BlogCards,
    },
  ),
  { ssr: false, loading: BlogSkeleton },
);

export function Blog() {
  const [mediumPosts, setMediumPosts] = useState<MediumPost[]>([]);
  // A post's whole text, in a dialog the cards open (BlogCards.tsx); here
  // so a link to it can open it too.
  const blogDetails = useDetailsDialog<BlogSubject>();
  const [kudosArticles, setKudosArticles] = useState<KudosArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchMediumPosts = async () => {
    try {
      const response = await fetch("/api/medium-posts");
      if (!response.ok) {
        throw new Error("Failed to fetch Medium posts");
      }
      const data = await response.json();
      setMediumPosts(data.items || []);
      setError(false);
    } catch (err) {
      logError(err, "Blog.fetchMediumPosts");
      setError(true);
    }
  };

  const fetchKudosArticles = async () => {
    try {
      const response = await fetch("/api/kudos-articles");
      if (!response.ok) {
        throw new Error("Failed to fetch Kudos articles");
      }
      const data = await response.json();
      setKudosArticles(data.articles || []);
    } catch (err) {
      logError(err, "Blog.fetchKudosArticles");
      // Don't set global error for Kudos, just log it
    }
  };

  useEffect(() => {
    cards.preload();
    const fetchData = async () => {
      const promises = [];

      if (blogSection.displayMediumBlogs) {
        promises.push(fetchMediumPosts());
      }

      if (blogSection.displayKudosArticles) {
        promises.push(fetchKudosArticles());
      }

      if (promises.length > 0) {
        await Promise.all(promises);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  // Combine all blog sources (computed before the display early-return so the
  // deep-link hook below runs unconditionally, per the rules of hooks)
  const allArticles = useMemo(
    () =>
      [
        ...kudosArticles.map((article) => ({
          ...article,
          source: "kudos" as const,
          sortDate: new Date(article.date).getTime(),
        })),
        ...mediumPosts.map((post) => ({
          ...post,
          source: "medium" as const,
          sortDate: new Date(post.pubDate).getTime(),
        })),
      ].sort((a, b) => b.sortDate - a.sortDate), // Sort by date, newest first
    [kudosArticles, mediumPosts],
  );

  // Deep-link anchors: Kudos stories use their curated id; Medium posts use
  // the permanent slug from their URL.
  const articleAnchorId = (
    article: (typeof allArticles)[number],
  ): string | undefined =>
    article.source === "kudos" ? article.id : mediumAnchorId(article.link);

  // Deep links: a #<article anchor> hash scrolls to that card, pulses a
  // highlight, and holds its hover glow until the user interacts; with -full
  // it also opens the post's whole text.
  const { deepLinkedId, highlightedId } = useCardDeepLink(
    allArticles.flatMap((article) => {
      const id = articleAnchorId(article);
      return id ? [id] : [];
    }),
    {
      onOpen: (id) => {
        const article = allArticles.find((a) => articleAnchorId(a) === id);
        if (article) {
          blogDetails.showFromLink(
            { url: article.source === "kudos" ? article.url : article.link },
            id,
          );
        }
      },
    },
  );

  if (!blogSection.display) {
    return null;
  }

  // Newest six, plus the deep-linked article when it is older than the cut
  // (otherwise its anchor would not exist in the DOM).
  const visibleArticles = allArticles.slice(0, 6);
  if (
    deepLinkedId &&
    !visibleArticles.some((a) => articleAnchorId(a) === deepLinkedId)
  ) {
    const target = allArticles.find((a) => articleAnchorId(a) === deepLinkedId);
    if (target) visibleArticles.push(target);
  }

  const displayStaticBlogs =
    (!blogSection.displayMediumBlogs && !blogSection.displayKudosArticles) ||
    (error && kudosArticles.length === 0) ||
    allArticles.length === 0;

  return (
    <div className="container mx-auto px-4 md:px-16 pt-20 pb-8 sm:pt-24 sm:pb-16 max-w-7xl relative">
      <div className="lg:px-8">
        <div className="text-center mb-12">
          <h2 className="section-title-gradient">{blogSection.title}</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            <span className="text-primary font-semibold">
              {blogSection.subtitle.highlightedText}
            </span>
            {" • "}
            {blogSection.subtitle.normalText}
          </p>
        </div>

        {loading ? (
          <BlogSkeleton />
        ) : (
          <BlogCards
            displayStaticBlogs={displayStaticBlogs}
            visibleArticles={visibleArticles}
            articleAnchorId={articleAnchorId}
            deepLinkedId={deepLinkedId}
            highlightedId={highlightedId}
            details={blogDetails}
          />
        )}

        {/* View all posts links */}
        {!displayStaticBlogs &&
          (allArticles.length > 6 || kudosArticles.length > 0) && (
            <div className="text-center mt-12 space-y-4">
              {mediumPosts.length > 0 && (
                <div>
                  <a
                    href={`https://medium.com/@${blogSection.mediumUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                  >
                    View all posts on Medium
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </div>
              )}
              {kudosArticles.length > 0 && (
                <div>
                  <a
                    href={blogSection.kudosProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-primary hover:underline"
                  >
                    View research stories on Kudos
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
