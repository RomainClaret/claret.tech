import { MetadataRoute } from "next";
import { PDF_ROUTES } from "@/lib/pdf-registry";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://claret.tech";

  // Get current date for lastModified
  const currentDate = new Date();

  return [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${baseUrl}/#skills`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/#experience`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/#projects`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/#research`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/#papers`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/#education`,
      lastModified: currentDate,
      changeFrequency: "yearly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/#blogs`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/#contact`,
      lastModified: currentDate,
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/rss.xml`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.5,
    },
    // Every locally hosted PDF is a real page, so list them rather than only
    // the section anchors. Two kinds of duplicate are dropped: suffixed
    // aliases (-paper, -poster), and short names like /pdf/phd, which carry a
    // canonicalSlug and resolve to a document already listed under its own
    // address. Routes pinned to a file, e.g. /pdf/thesis-geenns, are addresses
    // in their own right and stay.
    ...PDF_ROUTES.filter(
      (route) =>
        !route.canonicalSlug &&
        !/-(paper|poster|presentation)$/.test(route.slug),
    ).map((route) => ({
      url: `${baseUrl}/pdf/${route.slug}`,
      lastModified: currentDate,
      // A published paper is fixed once it is out; the CV is not.
      changeFrequency:
        route.kind === "cv" ? ("monthly" as const) : ("yearly" as const),
      priority: 0.6,
    })),
  ];
}
