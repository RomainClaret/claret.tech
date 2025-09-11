"use client";

import { useEffect, useState } from "react";
import { FadeIn } from "@/components/ui/animated";
import { BlogCardHolographic } from "@/components/ui/blog-card-holographic";
import { blogSection } from "@/data/portfolio";
import {
  extractMediumImage,
  extractMediumThumbnail,
} from "@/lib/utils/extract-medium-image";
import mediumColors from "@/lib/utils/medium-colors.json";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { cn } from "@/lib/utils";
import { logError } from "@/lib/utils/dev-logger";

interface MediumColorEntry {
  color?: string;
}

interface MediumColors {
  [key: string]: MediumColorEntry;
}

interface MediumPost {
  title: string;
  link: string;
  pubDate: string;
  content: string;
  contentSnippet?: string;
  description?: string;
  guid: string;
  isoDate: string;
  categories?: string[];
  enrichedImage?: string;
  enrichedColor?: string;
}

interface KudosArticle {
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

export function Blog() {
  const [mediumPosts, setMediumPosts] = useState<MediumPost[]>([]);
  const [kudosArticles, setKudosArticles] = useState<KudosArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const shouldReduceAnimations = useShouldReduceAnimations();

  useEffect(() => {
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

  // Extract text content from HTML
  const extractTextContent = (html: string): string => {
    if (typeof html !== "string") return "";

    // Strip out tracking pixels and scripts before processing
    const cleanedHtml = html
      .replace(/<img[^>]*medium\.com\/_\/stat[^>]*>/gi, "") // Remove Medium tracking pixels
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ""); // Remove scripts

    // Remove HTML tags and get text content
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = cleanedHtml;
    let textContent = tempDiv.textContent || tempDiv.innerText || "";

    // Remove "Photo by" credits and everything after
    const photoByIndex = textContent.indexOf("Photo by");
    if (photoByIndex !== -1) {
      textContent = textContent.substring(0, photoByIndex).trim();
    }

    return textContent;
  };

  if (!blogSection.display) {
    return null;
  }

  // Combine all blog sources
  const allArticles = [
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
  ].sort((a, b) => b.sortDate - a.sortDate); // Sort by date, newest first

  const displayStaticBlogs =
    (!blogSection.displayMediumBlogs && !blogSection.displayKudosArticles) ||
    (error && kudosArticles.length === 0) ||
    allArticles.length === 0;

  return (
    <div className="container mx-auto px-4 md:px-16 pt-20 pb-8 sm:pt-24 sm:pb-16 max-w-7xl relative">
      <div className="lg:px-8">
        <FadeIn className="text-center mb-12">
          <h2 className="section-title-gradient">{blogSection.title}</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            <span className="text-primary font-semibold">
              {blogSection.subtitle.highlightedText}
            </span>
            {""}
            {blogSection.subtitle.normalText}
          </p>
        </FadeIn>

        {loading ? (
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
                      <div className="h-4 bg-muted rounded w-20 mb-2" />
                      <div className="h-3 bg-muted rounded w-24" />
                    </div>
                  </div>
                  <div className="h-6 bg-muted rounded mb-4 w-3/4" />
                  <div className="h-4 bg-muted rounded mb-2" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                </div>
              ))}
            </div>
          </div>
        ) : (
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
                : allArticles.slice(0, 6).map((article, index) => {
                    // Handle Kudos articles
                    if (article.source === "kudos") {
                      const kudosArticle = article as KudosArticle & {
                        source: string;
                        sortDate: number;
                      };
                      return (
                        <BlogCardHolographic
                          key={`kudos-${kudosArticle.url}`}
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
                        />
                      );
                    }

                    // Handle Medium posts
                    const post = article as MediumPost & {
                      source: string;
                      sortDate: number;
                    };
                    const content = extractTextContent(
                      post.contentSnippet || post.content,
                    );

                    // Use enriched image from scraper, fallback to RSS extraction
                    const imageUrl =
                      post.enrichedImage ||
                      extractMediumThumbnail(post) ||
                      extractMediumImage(
                        post.content || post.description || "",
                      );

                    // Use enriched color from scraper, fallback to cached colors
                    const guidColor = (mediumColors as MediumColors)[post.guid];
                    const linkColor = (mediumColors as MediumColors)[post.link];
                    const postColor =
                      post.enrichedColor ||
                      guidColor?.color ||
                      linkColor?.color;

                    return (
                      <BlogCardHolographic
                        key={post.guid}
                        title={post.title}
                        description={content}
                        url={post.link}
                        date={post.pubDate}
                        image={imageUrl || undefined}
                        color={postColor}
                        index={index}
                        readingTime={Math.ceil(content.split(" ").length / 200)}
                      />
                    );
                  })}
            </div>
          </div>
        )}

        {/* View all posts links */}
        {!displayStaticBlogs &&
          (allArticles.length > 6 || kudosArticles.length > 0) && (
            <FadeIn className="text-center mt-12 space-y-4">
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
            </FadeIn>
          )}
      </div>
    </div>
  );
}
