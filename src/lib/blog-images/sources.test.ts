import { describe, it, expect, vi } from "vitest";

const feed = vi.hoisted(() => ({
  items: [] as { content?: string; thumbnail?: string }[],
}));
vi.mock("@/lib/utils/medium-feed", () => ({
  fetchMediumFeed: vi.fn(async () => feed),
}));

import {
  blogImageId,
  blogImagePath,
  blogImageSources,
  isMediumImage,
  postImage,
} from "./sources";

const PICTURE = "https://cdn-images-1.medium.com/max/1024/0*foSWTIlQM-cdYK3S";
const PIXEL = "https://medium.com/_/stat?event=post.clientViewed";

describe("the blog's pictures", () => {
  it.each([
    ["miro", "https://miro.medium.com/v2/resize:fit:1200/0*abc", true],
    ["cdn-images-2", "https://cdn-images-2.medium.com/max/800/1*abc.png", true],
    ["plain http", "http://miro.medium.com/v2/0*abc", false],
    [
      "a lookalike host",
      "https://miro.medium.com.example.invalid/0*abc",
      false,
    ],
    ["Medium's tracking pixel", PIXEL, false],
    ["another site", "https://images.unsplash.com/photo-1", false],
    ["not a URL", "0*abc", false],
    // The allowlist names origins: no other port, no credentials.
    ["another port", "https://miro.medium.com:8443/v2/0*abc", false],
    ["credentials", "https://user:pw@miro.medium.com/v2/0*abc", false],
  ])("takes %s as Medium's image: %s", (_label, url, expected) => {
    expect(isMediumImage(url as string)).toBe(expected);
  });

  it("finds a post's picture past other hosts, and not the tracking pixel", () => {
    const content = [
      '<img src="https://images.example.invalid/elsewhere.png">',
      `<figure><img alt="" src="${PICTURE}"></figure>`,
      `<img src="${PIXEL}" width="1" height="1">`,
    ].join("");

    expect(postImage({ content })).toBe(PICTURE);
    expect(postImage({ content: `<img src="${PIXEL}">` })).toBeNull();
    expect(postImage({ thumbnail: "", content: "<p>No image</p>" })).toBeNull();
  });

  it("names a picture by a short id, the same each time", () => {
    const id = blogImageId(PICTURE);

    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(blogImageId(PICTURE)).toBe(id);
    expect(blogImageId(`${PICTURE}x`)).not.toBe(id);
    expect(blogImagePath({ content: `<img src="${PICTURE}">` })).toBe(
      `/api/blog-image/${id}`,
    );
    expect(blogImagePath({ content: "" })).toBeNull();
  });

  it("lists every picture the feed names, by id", async () => {
    const other =
      "https://miro.medium.com/v2/resize:fit:1024/0*EKYFWiak9n1vXniX";
    feed.items = [
      { content: `<img src="${PICTURE}"><img src="${PIXEL}">` },
      { thumbnail: other },
      { content: "<p>A post with no picture</p>" },
    ];

    expect(await blogImageSources()).toEqual(
      new Map([
        [blogImageId(PICTURE), PICTURE],
        [blogImageId(other), other],
      ]),
    );
  });
  it("gives the blog only paths the route will serve", async () => {
    // The contract between /api/medium-posts, which hands each post a path,
    // and /api/blog-image, which serves only what this list holds.
    feed.items = [
      { content: `<p>Intro</p><img src="${PICTURE}">` },
      { content: `<img src="https://images.example.invalid/x.png">` },
      { thumbnail: "https://miro.medium.com/v2/resize:fit:1024/0*third" },
    ];
    const served = await blogImageSources();

    const paths = feed.items
      .map((post) => blogImagePath(post))
      .filter((path): path is string => path !== null);
    expect(paths).toHaveLength(2);
    for (const path of paths) {
      expect(served.has(path.replace("/api/blog-image/", "")), path).toBe(true);
    }
  });
});
