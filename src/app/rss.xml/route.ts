// RSS Feed Generator
import { logError } from "@/lib/utils/dev-logger";

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://claret.tech";

  try {
    // Fetch Medium posts from our API
    const response = await fetch(`${siteUrl}/api/medium-posts`);
    const data = await response.json();

    // Generate RSS XML
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Romain Claret - Blog</title>
    <description>AI, engineering, and research insights.</description>
    <link>${siteUrl}</link>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    <copyright>© ${new Date().getFullYear()} Romain Claret</copyright>
    <generator>Next.js</generator>
    <managingEditor>contact@claret.tech (Romain Claret)</managingEditor>
    <webMaster>contact@claret.tech (Romain Claret)</webMaster>
    <image>
      <url>${siteUrl}/og-image.png</url>
      <title>Romain Claret - Blog</title>
      <link>${siteUrl}</link>
    </image>
    ${
      data.items
        ? data.items
            .map(
              (post: {
                title: string;
                content?: string;
                description?: string;
                link: string;
                guid?: string;
                pubDate: string;
                author?: string;
                categories?: string[];
              }) => {
                // Extract clean content from HTML
                const cleanContent = post.content
                  ? post.content.replace(/<[^>]*>/g, "").substring(0, 500) +
                    "..."
                  : post.description || "";

                // Extract first image from content if available
                const imageMatch = post.content?.match(
                  /<img[^>]+src="([^">]+)"/,
                );
                const imageUrl = imageMatch ? imageMatch[1] : null;

                return `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <description><![CDATA[${cleanContent}]]></description>
      <link>${post.link}</link>
      <guid isPermaLink="true">${post.guid || post.link}</guid>
      <pubDate>${new Date(post.pubDate).toUTCString()}</pubDate>
      <dc:creator><![CDATA[${post.author || "Romain Claret"}]]></dc:creator>
      ${
        post.categories && post.categories.length > 0
          ? post.categories
              .map((cat: string) => `<category><![CDATA[${cat}]]></category>`)
              .join("\n      ")
          : ""
      }
      ${imageUrl ? `<enclosure url="${imageUrl}" type="image/jpeg" />` : ""}
      <content:encoded><![CDATA[${post.content || cleanContent}]]></content:encoded>
    </item>`;
              },
            )
            .join("")
        : ""
    }
  </channel>
</rss>`;

    return new Response(rss, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    logError(error, "rss-feed-generation");

    // Return a minimal valid RSS feed on error
    const errorRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Romain Claret - Blog</title>
    <description>AI, engineering, and research insights.</description>
    <link>${siteUrl}</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  </channel>
</rss>`;

    return new Response(errorRss, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
      status: 500,
    });
  }
}
