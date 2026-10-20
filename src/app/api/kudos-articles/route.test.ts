import { describe, it, expect, vi, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as route from "./route";
import {
  kudosArticles,
  formatKudosArticleForBlog,
} from "@/data/sections/kudos-articles";

/**
 * The Kudos stories, built once with the site. Each picture is one of the
 * site's own files: the route fetched the story's Kudos page at runtime
 * for an Unsplash photo, which visitors' browsers then loaded through the
 * image optimizer (round 26).
 */
describe("/api/kudos-articles", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is built once, with the site", () => {
    expect(route.dynamic).toBe("force-static");
  });

  it("serves every story as the blog shows it, contacting nobody", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const body = await route.GET().json();

    expect(body).toEqual({
      status: "success",
      articles: kudosArticles.map(formatKudosArticleForBlog),
      count: kudosArticles.length,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("gives each story a picture of the site's own", () => {
    for (const article of kudosArticles) {
      expect(article.image, article.id).toMatch(/^\/images\/[\w-]+\.webp$/);
      expect(
        existsSync(join(process.cwd(), "public", article.image ?? "")),
        article.id,
      ).toBe(true);
    }
  });
});
