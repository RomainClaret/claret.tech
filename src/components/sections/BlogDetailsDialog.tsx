"use client";

// Deep per-icon imports: a lazily loaded component (pdf-viewer.tsx).
import BookOpen from "lucide-react/dist/esm/icons/book-open";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Share2 from "lucide-react/dist/esm/icons/share-2";
import {
  DetailsDialog,
  DetailsProse,
  primaryActionClass,
  secondaryActionClass,
} from "@/components/ui/details-dialog";
import type { DetailsStandInProps } from "@/components/ui/lazy-details";
import { shareArticle } from "@/lib/utils/share-article";

export interface BlogDetailsDialogProps extends DetailsStandInProps {
  /** The post's whole text, its paragraphs kept. */
  text: string;
  url: string;
  date?: string;
  readingTime: number;
  author: string;
  /** The card's colour, as "r, g, b". */
  accent: string;
}

/**
 * A post's whole text, above the page, instead of its card growing in place
 * (round 27), with the ways to read and share it. A chunk of its own.
 */
export function BlogDetailsDialog({
  title,
  text,
  url,
  date,
  readingTime,
  author,
  accent,
  dialog,
}: BlogDetailsDialogProps) {
  return (
    <DetailsDialog
      title={title}
      icon={BookOpen}
      accent={accent}
      meta={
        <>
          {date && (
            <span>
              {new Date(date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          <span>{readingTime} min read</span>
          <span>{author}</span>
        </>
      }
      footer={
        <>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={primaryActionClass}
          >
            Read
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={() => void shareArticle({ title, text, url })}
            className={secondaryActionClass}
          >
            Share
            <Share2 aria-hidden="true" className="h-4 w-4" />
          </button>
        </>
      }
      onClose={dialog.onClose}
      returnFocus={dialog.returnFocus}
      restoreScroll={dialog.restoreScroll}
      testId="blog-details"
    >
      <DetailsProse>{text}</DetailsProse>
    </DetailsDialog>
  );
}
