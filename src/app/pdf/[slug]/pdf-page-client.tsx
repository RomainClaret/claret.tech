"use client";

import dynamic from "next/dynamic";

/**
 * Client boundary for the reader.
 *
 * PDFViewer pulls in react-pdf, which needs a browser, and Next 15 rejects
 * `next/dynamic` with `ssr: false` inside a server component. The page stays a
 * server component so it can keep generateStaticParams and generateMetadata,
 * and defers to this.
 */
const PDFViewer = dynamic(
  () => import("@/components/ui/pdf-viewer").then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => null },
);

export function PdfPageClient({
  url,
  title,
  downloadFileName,
  shareSlug,
}: {
  url: string;
  title: string;
  downloadFileName: string;
  shareSlug: string;
}) {
  return (
    <PDFViewer
      url={url}
      title={title}
      downloadFileName={downloadFileName}
      shareSlug={shareSlug}
    />
  );
}
