import { NextResponse } from "next/server";
import {
  kudosArticles,
  formatKudosArticleForBlog,
} from "@/data/sections/kudos-articles";

/**
 * The Kudos stories for the blog, built once with the site: they are its own
 * data, pictures included (public/images). The route used to fetch each
 * story's Kudos page at runtime for an Unsplash photo, which the visitor's
 * browser then loaded through Vercel's image optimizer.
 */
export const dynamic = "force-static";

export function GET() {
  const articles = kudosArticles.map(formatKudosArticleForBlog);
  return NextResponse.json({
    status: "success",
    articles,
    count: articles.length,
  });
}
