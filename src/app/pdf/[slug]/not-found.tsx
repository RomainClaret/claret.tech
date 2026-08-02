import Link from "next/link";

/**
 * Shown when /pdf/<slug> names no document.
 *
 * Co-located with the segment rather than left to the root not-found: the root
 * boundary catches unmatched URLs fine, but a notFound() thrown from this
 * segment rendered the layout with an empty page body and a 200, so a missing
 * document looked like a broken page rather than an absent one.
 *
 * A slug can be absent because the document was never posted, which is the
 * usual case: papers without a PDF on the site have no route at all.
 */
export default function PdfNotFound() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto">
        <h1 className="text-9xl font-bold mb-4">
          <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            404
          </span>
        </h1>

        <h2 className="text-3xl font-semibold mb-4">Document Not Found</h2>
        <p className="text-lg text-muted-foreground mb-8">
          There is no document at this address. It may not be published yet, or
          the link may have been mistyped.
        </p>

        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/#papers"
            className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Browse the papers
          </Link>
          <Link
            href="/#research"
            className="inline-flex items-center justify-center px-6 py-3 border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Browse the research
          </Link>
        </div>
      </div>
    </div>
  );
}
