"use client";

import type { ComponentProps } from "react";
import dynamic from "next/dynamic";
import type { PDFViewer as Reader } from "@/components/ui/pdf-viewer";
import { withLoadFallback } from "@/lib/utils/load-fallback";
import { logError } from "@/lib/utils/dev-logger";
import { reloadPage } from "@/lib/utils/reload-page";

type ReaderProps = ComponentProps<typeof Reader>;

/**
 * Shown in place of the reader when its chunk cannot be fetched. This page
 * is the reader alone and the visitor came for the document, so it says
 * what failed and offers a retry, and the PDF itself for the browser's own
 * viewer. Before, React.lazy threw while rendering and the error page
 * (error.tsx) replaced the reader with "Something went wrong", whose "Try
 * Again" could not load it again.
 */
export function PdfPageUnavailable({
  url,
  title,
  retry,
  retrying,
}: ReaderProps & { retry: () => void; retrying: boolean }) {
  return (
    // On the reader's own surface (pdf-viewer.tsx: h-full bg-background).
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-background p-4 text-center">
      {title && <h2 className="text-xl font-semibold">{title}</h2>}
      <p className="text-muted-foreground">
        Could not load the PDF reader. Check your connection and try again.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="text-primary hover:underline disabled:opacity-60 disabled:no-underline"
        >
          {retrying ? "Trying again..." : "Try again"}
        </button>
        {/* Once a retry has failed too: a deploy may have replaced the
            reader's chunk since this page loaded. */}
        {!retrying && (
          <button
            type="button"
            onClick={reloadPage}
            className="text-primary hover:underline"
          >
            Reload page
          </button>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Open the PDF
        </a>
      </div>
    </div>
  );
}

/**
 * Client boundary for the reader.
 *
 * PDFViewer pulls in react-pdf, which needs a browser, and Next 15 rejects
 * `next/dynamic` with `ssr: false` inside a server component. The page stays a
 * server component so it can keep generateStaticParams and generateMetadata,
 * and defers to this.
 */
const PDFViewer = dynamic(
  withLoadFallback(
    () => import("@/components/ui/pdf-viewer").then((mod) => mod.PDFViewer),
    PdfPageUnavailable,
    { onError: (error) => logError(error, "PDF reader chunk") },
  ),
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
