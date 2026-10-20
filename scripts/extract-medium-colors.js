#!/usr/bin/env node

/**
 * Extract colors from Medium blog post images at build time
 * This script fetches Medium RSS feed and extracts colors from blog images
 */

const fs = require("fs").promises;
const path = require("path");

// The feed of the account the site's blog reads, by the same rule as
// src/lib/utils/medium-username.ts: NEXT_PUBLIC_MEDIUM_USERNAME without a
// leading "@", else romainclaret.
function mediumRssUrl(value = process.env.NEXT_PUBLIC_MEDIUM_USERNAME) {
  const username = (value || "").trim().replace(/^@+/, "") || "romainclaret";
  return `https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/@${username}`;
}

const OUTPUT_FILE = path.join(__dirname, "../src/lib/utils/medium-colors.json");
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Extract thumbnail from Medium RSS item
function extractMediumThumbnail(item) {
  // Check for thumbnail field
  if (item.thumbnail && item.thumbnail !== "") {
    return item.thumbnail;
  }

  // Check for enclosure field (common in RSS)
  if (item.enclosure && item.enclosure.link) {
    return item.enclosure.link;
  }

  // Check if enclosure has url property
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }

  // Check content for images (most reliable for Medium)
  if (item.content) {
    return extractMediumImage(item.content);
  }

  // Check description for images as fallback
  if (item.description) {
    return extractMediumImage(item.description);
  }

  return null;
}

// Extract image from HTML content
function extractMediumImage(content) {
  if (!content || typeof content !== "string") {
    return null;
  }

  // Try to find img tag with src attribute
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1]) {
    return imgMatch[1];
  }

  // Try to find Medium CDN URLs in the content
  const cdnPatterns = [
    /https:\/\/cdn-images-\d+\.medium\.com\/[^\s"'<>]+/i,
    /https:\/\/miro\.medium\.com\/[^\s"'<>]+/i,
  ];

  for (const pattern of cdnPatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return null;
}

// Blog category colors for fallback
const BLOG_COLORS = {
  ai: "rgb(59, 130, 246)", // Blue
  neuroevolution: "rgb(139, 92, 246)", // Purple
  technology: "rgb(16, 185, 129)", // Emerald
  research: "rgb(168, 85, 247)", // Purple
  tutorial: "rgb(251, 146, 60)", // Orange
  story: "rgb(236, 72, 153)", // Pink
  default: "rgb(71, 85, 105)", // Slate
};

// Throws when the feed fails: an empty list here used to be written over the
// saved map, as if the account had no posts.
async function fetchMediumPosts() {
  const response = await fetch(mediumRssUrl());
  const data = await response.json();

  if (data.status !== "ok" || !data.items) {
    throw new Error("Failed to fetch Medium posts");
  }

  return data.items;
}

function getCategoryFromPost(post) {
  const categories = post.categories || [];
  const content = (post.content || "").toLowerCase();
  const title = (post.title || "").toLowerCase();

  // Check categories first
  for (const category of categories) {
    const cat = category.toLowerCase();
    if (BLOG_COLORS[cat]) return cat;
  }

  // Check content and title for keywords
  if (title.includes("ai") || content.includes("artificial intelligence"))
    return "ai";
  if (title.includes("neuroevolution") || content.includes("neuroevolution"))
    return "neuroevolution";
  if (title.includes("research") || content.includes("research"))
    return "research";
  if (title.includes("tutorial") || content.includes("how to"))
    return "tutorial";
  if (title.includes("story") || content.includes("story")) return "story";

  return "technology"; // default category
}

async function extractMediumColors(outputFile = OUTPUT_FILE) {
  console.log("🎨 Extracting colors from Medium blog posts...");

  try {
    // Check if we have a recent cache
    try {
      const stats = await fs.stat(outputFile);
      const now = Date.now();
      const fileAge = now - stats.mtime.getTime();

      if (fileAge < CACHE_DURATION) {
        console.log("✓ Using cached Medium colors (less than 24 hours old)");
        return;
      }
    } catch {
      // File doesn't exist, continue with extraction
    }

    const posts = await fetchMediumPosts();
    console.log(`Found ${posts.length} Medium posts`);

    const colorMap = {};

    for (const post of posts) {
      const imageUrl = extractMediumThumbnail(post);
      const postId = post.guid || post.link;
      // The post's category picks its color: taking one from the thumbnail
      // was never written (a stub returned null for every image).
      const category = getCategoryFromPost(post);
      colorMap[postId] = {
        color: BLOG_COLORS[category] || BLOG_COLORS.default,
        image: imageUrl || null,
        title: post.title,
        category,
      };

      console.log(
        `  ✓ ${post.title.substring(0, 50)}... -> ${colorMap[postId].color}${imageUrl ? "" : " (no image)"}`,
      );
    }

    // Save to file
    await fs.writeFile(outputFile, JSON.stringify(colorMap, null, 2) + "\n");

    console.log(
      `\n✅ Extracted colors for ${Object.keys(colorMap).length} posts`,
    );
    console.log(`📄 Saved to ${outputFile}`);
  } catch (error) {
    console.error("❌ Error extracting Medium colors:", error);

    // The map is tracked, and this runs before every build: a failed feed
    // (offline, or rss2json refusing) keeps the saved one. An empty map only
    // when there is none, since Blog.tsx imports the file.
    try {
      await fs.access(outputFile);
    } catch {
      await fs.writeFile(outputFile, JSON.stringify({}, null, 2) + "\n");
    }
  }
}

// Run the script
if (require.main === module) {
  extractMediumColors();
}

module.exports = { extractMediumColors, mediumRssUrl };
