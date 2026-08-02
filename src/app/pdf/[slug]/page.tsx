import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PDF_ROUTES, findPdfRoute, pdfDownloadName } from "@/lib/pdf-registry";
import { PdfPageClient } from "./pdf-page-client";

/**
 * A locally hosted PDF on its own page, /pdf/<slug>.
 *
 * The point is to open the document without loading the homepage, which is
 * around 20,000px tall, fetches GitHub and the publications API and mounts the
 * terminal. This route still inherits the root layout, so the nav and footer
 * come with it; escaping those entirely would need parallel root layouts.
 */

const KIND_LABEL: Record<string, string> = {
  paper: "Paper",
  poster: "Poster",
  presentation: "Presentation",
  thesis: "Thesis",
  cv: "CV",
};

export function generateStaticParams() {
  return PDF_ROUTES.map((route) => ({ slug: route.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const route = findPdfRoute(slug);
  if (!route) return { title: "Document not found" };

  const label = KIND_LABEL[route.kind] ?? "Document";
  const title = `${route.title} (${label})`;
  // The generic phrasing reads badly for the CV, which is not something you
  // read by a person, it is theirs.
  const description =
    route.kind === "cv"
      ? "The resume of Romain Claret."
      : `Read "${route.title}" by Romain Claret.`;

  return {
    title,
    description,
    // Without this each reader page inherits the site-wide canonical from the
    // root layout and declares itself to be the homepage, while the sitemap
    // asks for these same URLs to be indexed. A nickname names its target,
    // so /pdf/phd and /pdf/phd-thesis are one document to a crawler.
    alternates: { canonical: `/pdf/${route.canonicalSlug ?? route.slug}` },
    openGraph: { title, description, type: "article" },
  };
}

export default async function PdfPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const route = findPdfRoute(slug);
  if (!route) notFound();

  return (
    // Minus the 64px fixed nav, so the reader fills what is left rather than
    // pushing a scrollbar onto the page behind it.
    <div className="h-[calc(100vh-4rem)]">
      <PdfPageClient
        url={route.url}
        title={route.title}
        downloadFileName={pdfDownloadName(route)}
        shareSlug={route.slug}
      />
    </div>
  );
}
