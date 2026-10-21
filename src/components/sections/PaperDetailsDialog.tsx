"use client";

// Deep per-icon imports: a lazily loaded component (pdf-viewer.tsx).
import BookOpen from "lucide-react/dist/esm/icons/book-open";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import FileText from "lucide-react/dist/esm/icons/file-text";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import type { Publication } from "@/lib/api/fetch-publications";
import {
  DetailsDialog,
  DetailsProse,
  DetailsSection,
} from "@/components/ui/details-dialog";
import { accentStyle } from "@/components/ui/accent-text";
import type { DetailsStandInProps } from "@/components/ui/lazy-details";
import { pdfReaderIntent } from "@/lib/pdf-reader-preload";
import {
  AuthorNames,
  detectPublicationStatus,
  otherWorkKind,
  publicationKind,
  ReadPdfButton,
  WatchVideoButton,
  type OtherWork,
} from "./paper-parts";

/** The paper whose details are open, as the section resolves it. */
export type OpenPaper =
  | { kind: "publication"; publication: Publication }
  | { kind: "other"; paper: OtherWork };

export interface PaperDetailsDialogProps extends DetailsStandInProps {
  open: OpenPaper;
  /** The card's colour, as "r, g, b". */
  accent: string;
  /** /api/publications has not answered yet: the abstracts are on the way. */
  abstractPending: boolean;
  onOpenPDF: (url: string, title: string, fileName: string) => void;
}

const linkClass =
  "inline-flex items-center gap-1 rounded-lg bg-primary/5 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary hover:text-primary-foreground";

function OutwardLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClass}
    >
      {label}
      <ExternalLink aria-hidden="true" className="h-3 w-3" />
    </a>
  );
}

/**
 * A paper's details, above the page, instead of its card growing in place
 * (round 27): the whole abstract (a publication's) or text (Other Work's),
 * the authors, and the ways to read it. The reader opens above this dialog.
 * A chunk of its own.
 */
export function PaperDetailsDialog({
  open,
  title,
  accent,
  abstractPending,
  dialog,
  onOpenPDF,
}: PaperDetailsDialogProps) {
  const item = open.kind === "publication" ? open.publication : open.paper;
  const status = detectPublicationStatus(item);
  const kind =
    open.kind === "publication"
      ? publicationKind(open.publication)
      : otherWorkKind(open.paper);
  const Icon =
    kind === "Journal" || kind === "Paper"
      ? BookOpen
      : kind === "Poster"
        ? FileText
        : Sparkles;

  const text =
    open.kind === "publication"
      ? open.publication.abstract || open.publication.shortDescription || ""
      : open.paper.subtitle;
  const authors =
    open.kind === "publication" ? open.publication.authors : open.paper.authors;

  return (
    <DetailsDialog
      title={title}
      icon={Icon}
      accent={accent}
      meta={
        <>
          <span>{kind}</span>
          <span>
            {open.kind === "publication"
              ? open.publication.year
              : open.paper.date}
          </span>
          <span
            className="accent-text font-medium"
            style={accentStyle(`rgb(${status.color})`)}
          >
            {status.label}
          </span>
          {open.kind === "publication" && open.publication.venue && (
            <span>{open.publication.venue}</span>
          )}
        </>
      }
      onClose={dialog.onClose}
      returnFocus={dialog.returnFocus}
      restoreScroll={dialog.restoreScroll}
      testId="paper-details"
    >
      <DetailsProse>{text}</DetailsProse>
      {open.kind === "publication" &&
        !open.publication.abstract &&
        abstractPending && (
          <p role="status" className="text-xs text-muted-foreground">
            Loading the abstract…
          </p>
        )}

      {authors && authors.length > 0 && (
        <DetailsSection title="Authors">
          <p className="text-sm text-muted-foreground">
            <AuthorNames authors={authors} />
          </p>
        </DetailsSection>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {item.paperPdf && (
          <ReadPdfButton
            variant="paper"
            pdf={item.paperPdf}
            title={item.title}
            onOpenPDF={onOpenPDF}
          />
        )}
        {item.posterPdf && (
          <ReadPdfButton
            variant="poster"
            pdf={item.posterPdf}
            title={item.title}
            onOpenPDF={onOpenPDF}
          />
        )}
        {item.presentationPdf && (
          <ReadPdfButton
            variant="presentation"
            pdf={item.presentationPdf}
            title={item.title}
            onOpenPDF={onOpenPDF}
          />
        )}
        {item.videoUrl && <WatchVideoButton url={item.videoUrl} />}
        {open.kind === "publication" ? (
          <>
            {open.publication.paperUrl && (
              <OutwardLink href={open.publication.paperUrl} label="Paper" />
            )}
            {open.publication.codeUrl && (
              <OutwardLink href={open.publication.codeUrl} label="Code" />
            )}
          </>
        ) : (
          open.paper.footerLink.map((link) =>
            link.url.startsWith("/") && link.url.endsWith(".pdf") ? (
              <button
                key={link.url}
                type="button"
                className={linkClass}
                {...pdfReaderIntent}
                onClick={() =>
                  onOpenPDF(
                    link.url,
                    `${open.paper.title} - ${link.name}`,
                    link.url.split("/").pop() || "document.pdf",
                  )
                }
              >
                {link.name}
              </button>
            ) : (
              <OutwardLink key={link.url} href={link.url} label={link.name} />
            ),
          )
        )}
      </div>
    </DetailsDialog>
  );
}
