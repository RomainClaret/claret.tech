import { describe, it, expect } from "vitest";
import { parseMediumRss } from "./medium-rss";

/**
 * Medium's RSS, read by the server since rss2json started answering servers
 * with a Cloudflare challenge (2026-10). The documents below follow
 * medium.com/feed/@<user> as it was served on 2026-10-21.
 */

const PICTURE = "https://cdn-images-1.medium.com/max/1024/0*first-picture";
const SECOND = "https://cdn-images-1.medium.com/max/1024/0*second-picture";
const PIXEL =
  "https://medium.com/_/stat?event=post.clientViewed&referrerSource=full_rss&postId=abc123";

const feed = (items: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" version="2.0">
    <channel>
        <title><![CDATA[Stories by Someone on Medium]]></title>
        <link>https://medium.com/@someone?source=rss-0123------2</link>
        <image>
            <url>https://cdn-images-1.medium.com/fit/c/150/150/avatar.jpeg</url>
            <title>Stories by Someone on Medium</title>
        </image>
        <generator>Medium</generator>
        ${items}
    </channel>
</rss>`;

const POST = `<item>
            <title><![CDATA[A first post]]></title>
            <link>https://someone.medium.com/a-first-post-abc123?source=rss-0123------2</link>
            <guid isPermaLink="false">https://medium.com/p/abc123</guid>
            <category><![CDATA[short-story]]></category>
            <category><![CDATA[science-fiction]]></category>
            <dc:creator><![CDATA[Someone]]></dc:creator>
            <pubDate>Thu, 25 Apr 2019 13:09:33 GMT</pubDate>
            <atom:updated>2019-05-06T18:30:44.813Z</atom:updated>
            <content:encoded><![CDATA[<p>Fish & chips.</p><figure><img alt="" src="${PICTURE}" /></figure><p>More.</p><img src="${SECOND}" /><img src="${PIXEL}" width="1" height="1" alt="">]]></content:encoded>
        </item>`;

describe("parseMediumRss", () => {
  it("reads each post's fields as rss2json gave them", () => {
    const [post] = parseMediumRss(feed(POST));

    expect(post).toEqual({
      title: "A first post",
      link: "https://someone.medium.com/a-first-post-abc123?source=rss-0123------2",
      guid: "https://medium.com/p/abc123",
      pubDate: "Thu, 25 Apr 2019 13:09:33 GMT",
      author: "Someone",
      categories: ["short-story", "science-fiction"],
      content: `<p>Fish & chips.</p><figure><img alt="" src="${PICTURE}" /></figure><p>More.</p><img src="${SECOND}" /><img src="${PIXEL}" width="1" height="1" alt="">`,
      thumbnail: PICTURE,
    });
  });

  it("keeps the feed's order, and reads every post", () => {
    const second = POST.replace("A first post", "A second post").replaceAll(
      "abc123",
      "def456",
    );

    const posts = parseMediumRss(feed(POST + second));

    expect(posts.map((post) => post.title)).toEqual([
      "A first post",
      "A second post",
    ]);
    expect(posts[1].guid).toBe("https://medium.com/p/def456");
  });

  it("takes no picture from Medium's view counter", () => {
    const counterOnly = POST.replace(
      /<content:encoded>[\s\S]*<\/content:encoded>/,
      `<content:encoded><![CDATA[<p>Text only.</p><img src="${PIXEL}" width="1" height="1" alt="">]]></content:encoded>`,
    );

    const [post] = parseMediumRss(feed(counterOnly));

    expect(post.thumbnail).toBeUndefined();
  });

  it("decodes entities outside CDATA, and joins a section split at ]]>", () => {
    const plain = POST.replace(
      "<title><![CDATA[A first post]]></title>",
      "<title>Caf&#233; &amp; caf&#xE9; &lt;3</title>",
    ).replace(
      "<dc:creator><![CDATA[Someone]]></dc:creator>",
      "<dc:creator><![CDATA[a]]]]><![CDATA[>b]]></dc:creator>",
    );

    const [post] = parseMediumRss(feed(plain));

    expect(post.title).toBe("Café & café <3");
    expect(post.author).toBe("a]]>b");
  });

  it("reads markup inside CDATA as text, never as the feed's own tags", () => {
    // A title is the author's text: a <link> or a </item><item> in it took
    // over the card's link or added whole posts (security audit run 1,
    // hardening).
    const title =
      "Hi <link>https://evil.example/phish</link></item><item><title>Injected</title><link>https://evil.example/x</link><pubDate>Mon, 01 Jan 2100 00:00:00 GMT</pubDate>";
    const posts = parseMediumRss(
      feed(POST.replace("<![CDATA[A first post]]>", `<![CDATA[${title}]]>`)),
    );

    expect(posts).toHaveLength(1);
    expect(posts[0].title).toBe(title);
    expect(posts[0].link).toBe(
      "https://someone.medium.com/a-first-post-abc123?source=rss-0123------2",
    );
  });

  it("has no posts for a feed with none", () => {
    expect(parseMediumRss(feed(""))).toEqual([]);
  });

  it("refuses a page that is not a feed", () => {
    // What rss2json, and a blocked request to anyone, answers with.
    const challenge =
      '<!DOCTYPE html><html lang="en-US"><head><title>Just a moment...</title></head><body></body></html>';

    expect(() => parseMediumRss(challenge)).toThrow("Not an RSS feed");
  });
});
