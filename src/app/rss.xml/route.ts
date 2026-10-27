// RSS Feed Generator
import { logError } from "@/lib/utils/dev-logger";
import { fetchMediumFeed } from "@/lib/utils/medium-feed";
import { blogImagePath } from "@/lib/blog-images/sources";

/**
 * Characters XML 1.0 forbids: one (decoded from Medium's &#11;, say) made
 * the whole feed ill-formed for a strict reader.
 */
// eslint-disable-next-line no-control-regex
const NOT_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

/** Medium's view counter, an image in every post: not ours to republish. */
const VIEW_COUNTER =
  /<img[^>]+src="https:\/\/medium\.com\/_\/stat[^"]*"[^>]*>/g;

// A backstop for the feed fetch's 10 s timeout, which Next drops when it
// refreshes the stale cached feed in the background.
export const maxDuration = 30;

/**
 * Escape text for an XML element or attribute.
 *
 * The feed is built by interpolation from Medium's content, which this site
 * does not control. Unescaped, a crafted title or link closes the element and
 * injects markup into a document served as application/xml from this origin.
 */
function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(NOT_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Text for a CDATA section. CDATA does not make content inert: a literal
 * "]]>" inside it ends the section early and everything after is parsed as
 * markup. Splitting it across two sections is the standard fix.
 */
function cdata(value: unknown): string {
  return String(value ?? "")
    .replace(NOT_XML, "")
    .replace(/]]>/g, "]]]]><![CDATA[>");
}

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://claret.tech";

  try {
    // Medium's own feed, read directly: through the site's API over HTTP it
    // cost each poll a rate-limited request and the API's image scraping,
    // and a local or preview build read production's API.
    const data = await fetchMediumFeed();

    // Generate RSS XML
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Romain Claret - Blog</title>
    <description>Notes on evolving intelligence, growing artificial minds, and the occasional detour.</description>
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
                thumbnail?: string;
                description?: string;
                link: string;
                guid?: string;
                pubDate: string;
                author?: string;
                categories?: string[];
              }) => {
                const content = post.content?.replace(VIEW_COUNTER, "");
                // Extract clean content from HTML
                const cleanContent = content
                  ? content.replace(/<[^>]*>/g, "").substring(0, 500) + "..."
                  : post.description || "";

                // The post's picture through the site's own route, as the
                // blog shows it: a reader of the feed then asks this site,
                // not Medium.
                const picture = blogImagePath(post);
                const imageUrl = picture ? `${siteUrl}${picture}?w=960` : null;

                return `
    <item>
      <title><![CDATA[${cdata(post.title)}]]></title>
      <description><![CDATA[${cdata(cleanContent)}]]></description>
      <link>${xmlEscape(post.link)}</link>
      <guid isPermaLink="true">${xmlEscape(post.guid || post.link)}</guid>
      <pubDate>${new Date(post.pubDate).toUTCString()}</pubDate>
      <dc:creator><![CDATA[${cdata(post.author || "Romain Claret")}]]></dc:creator>
      ${
        post.categories && post.categories.length > 0
          ? post.categories
              .map(
                (cat: string) =>
                  `<category><![CDATA[${cdata(cat)}]]></category>`,
              )
              .join("\n      ")
          : ""
      }
      ${imageUrl ? `<enclosure url="${xmlEscape(imageUrl)}" type="image/webp" />` : ""}
      <content:encoded><![CDATA[${cdata(content || cleanContent)}]]></content:encoded>
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
    <description>Notes on evolving intelligence, growing artificial minds, and the occasional detour.</description>
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
