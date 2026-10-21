"use client";

import { BookOpen, FileText, Play, Presentation } from "lucide-react";
import type { papersSection } from "@/data/portfolio";
import type { Publication } from "@/lib/api/fetch-publications";
import { pdfReaderIntent } from "@/lib/pdf-reader-preload";

/**
 * What the Papers section's cards and their details dialog share: the
 * dialog loads as a chunk of its own (PaperDetailsDialog.tsx), so it cannot
 * import the section, whose cards it details.
 */

export type OtherWork = (typeof papersSection.papersCards)[number];

// Research area colors
export const RESEARCH_COLORS: Record<string, string> = {
  neuroevolution: "139, 92, 246", // Purple
  ml: "59, 130, 246", // Blue
  nlp: "34, 197, 94", // Green
  blockchain: "245, 158, 11", // Amber
  neuroscience: "236, 72, 153", // Pink
  general: "107, 114, 128", // Gray
};

// Detect publication status
export function detectPublicationStatus(pub: Publication | OtherWork): {
  status:
    | "published"
    | "under_review"
    | "open_review"
    | "preprint"
    | "to_appear"
    | "presented";
  label: string;
  color: string;
} {
  const title = pub.title.toLowerCase();
  const venue = "venue" in pub ? pub.venue?.toLowerCase() || "" : "";

  // Explicitly marked as forthcoming (accepted / to appear)
  if (pub.status === "to-appear") {
    return { status: "to_appear", label: "To Appear", color: "59, 130, 246" }; // Blue
  }

  // Explicitly marked as presented (talks and posters that are not publications)
  if (pub.status === "presented") {
    return { status: "presented", label: "Presented", color: "20, 184, 166" }; // Teal
  }

  // Explicitly marked as a preprint (never formally published)
  if (pub.status === "preprint") {
    return { status: "preprint", label: "Preprint", color: "139, 92, 246" }; // Purple
  }

  // Check for arXiv/preprint
  if (venue.includes("arxiv") || title.includes("preprint")) {
    return { status: "preprint", label: "Preprint", color: "139, 92, 246" }; // Purple
  }

  // Check for open review
  if (venue.includes("openreview") || title.includes("open review")) {
    return {
      status: "open_review",
      label: "Open Review",
      color: "251, 146, 60",
    }; // Orange
  }

  // Check for under review
  if (
    venue.includes("under review") ||
    venue.includes("submitted") ||
    title.includes("under review")
  ) {
    return {
      status: "under_review",
      label: "Under Review",
      color: "250, 204, 21",
    }; // Yellow
  }

  // Default to published
  return { status: "published", label: "Published", color: "34, 197, 94" }; // Green
}

/** A peer-reviewed publication's kind, from its venue. */
export function publicationKind(publication: Publication) {
  const venue = publication.venue?.toLowerCase() ?? "";
  return venue.includes("journal")
    ? "Journal"
    : venue.includes("poster")
      ? "Poster"
      : "Conference";
}

/**
 * An Other Work card's kind. A card with a poster PDF or a link named
 * "Poster" is a poster even when its title does not say so.
 */
export function otherWorkKind(paper: OtherWork) {
  const title = paper.title.toLowerCase();
  return title.includes("thesis")
    ? "Thesis"
    : title.includes("poster") ||
        !!paper.posterPdf ||
        paper.footerLink.some((l) => l.name.toLowerCase() === "poster")
      ? "Poster"
      : "Paper";
}

// Unified styling for the Read Paper / Read Poster buttons: solid, saturated,
// and identical across all cards so they read as actions, not tags.
const READ_PDF_VARIANTS = {
  paper: { color: "37, 99, 235", Icon: BookOpen, label: "Read Paper" }, // Blue
  poster: { color: "194, 65, 12", Icon: FileText, label: "Read Poster" }, // Orange 700: white reads at 5.2:1
  presentation: {
    color: "4, 120, 87", // Emerald 700: white reads at 5.5:1
    Icon: Presentation,
    label: "Read Presentation",
  },
} as const;

// Solid button that opens a locally hosted PDF in the in-app reader.
export function ReadPdfButton({
  variant,
  pdf,
  title,
  onOpenPDF,
}: {
  variant: keyof typeof READ_PDF_VARIANTS;
  pdf: string;
  title: string;
  onOpenPDF: (url: string, title: string, fileName: string) => void;
}) {
  const { color, Icon, label } = READ_PDF_VARIANTS[variant];
  return (
    <button
      {...pdfReaderIntent}
      onClick={() =>
        onOpenPDF(pdf, title, pdf.split("/").pop() || "document.pdf")
      }
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white shadow-md transition-all hover:shadow-lg hover:brightness-110 active:scale-95"
      style={{ backgroundColor: `rgb(${color})` }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

// Same look as ReadPdfButton, but an external link: opens the paper's video
// (e.g. a YouTube talk) in a new tab instead of the in-app PDF reader.
export function WatchVideoButton({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white shadow-md transition-all hover:shadow-lg hover:brightness-110 active:scale-95"
      style={{ backgroundColor: "rgb(220, 38, 38)" }} // Red
    >
      <Play className="w-3.5 h-3.5" />
      Watch Video
    </a>
  );
}

// Highlighted in author lists so it is obvious where Romain sits.
const HIGHLIGHTED_AUTHOR = "Romain Claret";

/** An author list, Romain's name in bold. */
export function AuthorNames({ authors }: { authors: string[] }) {
  return (
    <>
      {authors.map((author, i) => (
        <span key={i}>
          {i > 0 && ", "}
          {author === HIGHLIGHTED_AUTHOR ? (
            <span className="font-semibold text-foreground">{author}</span>
          ) : (
            author
          )}
        </span>
      ))}
    </>
  );
}
