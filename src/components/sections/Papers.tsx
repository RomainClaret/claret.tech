"use client";

import { papersSection, socialMediaLinks } from "@/data/portfolio";
import { SlideInUp } from "@/components/ui/animated";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { cn } from "@/lib/utils";
import { OptimizedImage } from "@/components/ui/optimized-image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ExternalLink,
  Download,
  BookOpen,
  Copy,
  Check,
  Calendar,
  Users,
  FileText,
  Sparkles,
  Star,
} from "lucide-react";
import { ArxivWordmark, OrcidIcon } from "@/components/icons";
import { DEFAULT_BLUR_PLACEHOLDER } from "@/lib/utils/blur-placeholder";
import { useEffect, useState } from "react";
import { m } from "framer-motion";
import {
  comparePublications,
  exportToBibTeX,
  publicationToBibTeX,
  STATIC_PUBLICATIONS,
  withAbstracts,
  type ArxivVariant,
  type Publication,
} from "@/lib/api/fetch-publications";
import { usePDFViewer } from "@/lib/hooks/usePDFViewer";
import { pdfReaderIntent } from "@/lib/pdf-reader-preload";
import { loadPdfModal } from "@/components/ui/pdf-modal-loader";
import { useCardDeepLink } from "@/lib/hooks/useCardDeepLink";
import { useConferenceLogo } from "@/lib/hooks/useConferenceLogo";
import { useColorExtraction } from "@/lib/hooks/useColorExtraction";
import { HolographicCard } from "@/components/ui/holographic-card";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import { logError } from "@/lib/utils/dev-logger";
import { accentStyle } from "@/components/ui/accent-text";
import { researchAreaOf } from "@/lib/utils/research-area";
import {
  DETAILS_TRIGGER,
  useDetailsDialog,
} from "@/lib/hooks/useDetailsDialog";
import { lazyDetails } from "@/components/ui/lazy-details";
import type { OpenPaper } from "./PaperDetailsDialog";
import {
  AuthorNames,
  detectPublicationStatus,
  otherWorkKind,
  publicationKind,
  ReadPdfButton,
  RESEARCH_COLORS,
  WatchVideoButton,
} from "./paper-parts";

// Fetched on intent and mounted only while open (pdf-reader-preload.ts).
const PDFModal = dynamic(loadPdfModal, {
  ssr: false,
  loading: () => null,
});

/** Which paper's details are open: by id, so late abstracts fill them. */
type PaperSubject =
  | { kind: "publication"; id: string; accent: string }
  | { kind: "other"; index: number; accent: string };

/** Opens a card's details, from its button, in the card's colour. */
type OpenDetails = (trigger: HTMLElement, accent: string) => void;

// A paper's details (PaperDetailsDialog.tsx): a chunk of its own.
const { Dialog: PaperDetailsDialog, intent: paperIntent } = lazyDetails(
  () => import("./PaperDetailsDialog").then((mod) => mod.PaperDetailsDialog),
  "Paper details chunk",
);

/** A paper's name and short text: its dialog's title, and its stand-in's. */
const paperText = (open: OpenPaper) =>
  open.kind === "publication"
    ? {
        title: open.publication.title,
        summary: open.publication.shortDescription || open.publication.abstract,
      }
    : {
        title: open.paper.title,
        summary: open.paper.shortDescription || open.paper.subtitle,
      };

// The arXiv copy of a paper is sometimes the published one and sometimes a
// longer one. Which of the two it is, is the whole reason to click, so the
// label says it. The wordmark supplies "arXiv", which is why the label does not
// repeat it, and why the link carries its own accessible name. That name starts
// with the label, so a speech user can say what they see (WCAG 2.5.3).
const ARXIV_LABELS: Record<
  ArxivVariant,
  { label: string; description: string }
> = {
  published: {
    label: "published version",
    description: "Published version on arXiv",
  },
  extended: {
    label: "extended version",
    description: "Extended version on arXiv, longer than the published paper",
  },
  accepted: {
    label: "accepted version",
    description:
      "Accepted version on arXiv: the authors' manuscript, not the publisher's final version",
  },
};

// A line rather than another pill: it sits under the action row and points at a
// second copy of the same work, not at a separate thing to do.
function ArxivLine({
  arxivId,
  variant = "published",
}: {
  arxivId: string;
  variant?: ArxivVariant;
}) {
  // A variant the map does not know, a typo in the hand-edited JSON, renders
  // nothing: destructuring undefined would throw, and with no boundary around
  // the section that replaces the whole homepage with the error page. Falling
  // back to "published" instead would make the claim nobody checked.
  const entry = ARXIV_LABELS[variant];
  if (!entry) return null;
  const { label, description } = entry;
  return (
    <Link
      href={`https://arxiv.org/abs/${arxivId}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={description}
      title={description}
      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary px-3 py-1.5 rounded-lg transition-colors duration-200 group"
    >
      <ArxivWordmark className="h-3.5 w-[31px] shrink-0" />
      <span>{label}</span>
      <ExternalLink className="w-3 h-3 ml-auto shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
    </Link>
  );
}

interface PaperCardProps {
  paper: (typeof papersSection.papersCards)[0];
  onOpenPDF: (url: string, title: string, fileName: string) => void;
  onOpenDetails: OpenDetails;
  shouldReduceAnimations: boolean;
  isDeepLinked?: boolean;
}

// Static paper card with neural design
function PaperCard({
  paper,
  onOpenPDF,
  onOpenDetails,
  shouldReduceAnimations,
  isDeepLinked = false,
}: PaperCardProps) {
  const [bibtexCopied, setBibtexCopied] = useState(false);

  const handleBibTeXClick = async () => {
    if (!paper.bibtex) return;
    try {
      await navigator.clipboard.writeText(paper.bibtex);
    } catch {
      // Denied, or unavailable over plain http. Say nothing rather than show
      // a success mark for a copy that did not happen.
      return;
    }
    setBibtexCopied(true);
    setTimeout(() => setBibtexCopied(false), 2000);
  };

  const researchArea = researchAreaOf(paper);
  const fallbackColor = RESEARCH_COLORS[researchArea];
  const publicationStatus = detectPublicationStatus(paper);

  // Extract color from paper image if available
  const { color: extractedColor } = useColorExtraction(
    paper.image || "",
    `rgb(${fallbackColor})`,
  );
  const nodeColor = extractedColor.replace("rgb(", "").replace(")", "");

  const handleLinkClick = (
    e: React.MouseEvent,
    link: { name: string; url: string },
  ) => {
    if (link.url.endsWith(".pdf") && link.url.startsWith("/")) {
      e.preventDefault();
      const fileName = link.url.split("/").pop() || "document.pdf";
      onOpenPDF(link.url, `${paper.title} - ${link.name}`, fileName);
    }
  };

  // Determine paper type. A card with a poster PDF or a link named "Poster"
  // is a poster even when its title does not say so.
  // A repository link, held to the end of the action row so BibTeX can sit
  // ahead of it. Matched on the host rather than the label, because the label
  // is free text: "Code", "Code Repository" and "GitHub Repository" are all in
  // use across these cards.
  const isRepoLink = (url: string) =>
    /^https?:\/\/(www\.)?(github|gitlab)\.com\//.test(url);
  const outwardFooterLinks = paper.footerLink.filter(
    (link) => !isRepoLink(link.url),
  );
  const repoFooterLinks = paper.footerLink.filter((link) =>
    isRepoLink(link.url),
  );

  const renderFooterLink = (link: { name: string; url: string }) => {
    const isPDF = link.url.endsWith(".pdf") && link.url.startsWith("/");

    if (isPDF) {
      return (
        <button
          key={link.url}
          {...pdfReaderIntent}
          onClick={(e) => handleLinkClick(e, link)}
          className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-foreground px-3 py-2 bg-primary/5 hover:bg-primary rounded-lg transition-all duration-200 group"
        >
          <span className="truncate">{link.name}</span>
          <Download
            className={cn(
              "w-3 h-3 shrink-0",
              !shouldReduceAnimations && "group-hover:animate-bounce",
            )}
          />
        </button>
      );
    }

    return (
      <Link
        key={link.url}
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-foreground px-3 py-2 bg-primary/5 hover:bg-primary rounded-lg transition-all duration-200 group"
      >
        <span className="truncate">{link.name}</span>
        <ExternalLink className="w-3 h-3 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
      </Link>
    );
  };

  const kind = otherWorkKind(paper);

  return (
    <SlideInUp className="h-full">
      <m.div
        className="relative h-full"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <HolographicCard
          glowColor={nodeColor}
          insideBackgroundColor={nodeColor}
          forceHover={isDeepLinked}
        >
          <div className="p-6 h-full flex flex-col">
            {/* Header with type badge */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <m.div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `rgba(${nodeColor}, 0.1)` }}
                    whileHover={{ scale: 1.1 }}
                  >
                    {kind === "Thesis" ? (
                      <Sparkles
                        className="w-6 h-6"
                        style={{ color: `rgb(${nodeColor})` }}
                      />
                    ) : kind === "Poster" ? (
                      <FileText
                        className="w-6 h-6"
                        style={{ color: `rgb(${nodeColor})` }}
                      />
                    ) : (
                      <BookOpen
                        className="w-6 h-6"
                        style={{ color: `rgb(${nodeColor})` }}
                      />
                    )}
                  </m.div>
                  {/* Gentle breathing effect: a CSS loop (motion.css) that
                      pauses with its card when off-screen */}
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none anim-decor anim-breathe-115"
                    style={{
                      backgroundColor: `rgb(${nodeColor})`,
                      opacity: 0.1,
                    }}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">
                      {kind}
                    </span>
                    {/* Publication status tag */}
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium accent-text"
                      style={{
                        ...accentStyle(`rgb(${publicationStatus.color})`),
                        backgroundColor: `rgba(${publicationStatus.color}, 0.1)`,
                        border: `1px solid rgba(${publicationStatus.color}, 0.3)`,
                      }}
                    >
                      {publicationStatus.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {paper.date}
                  </p>
                </div>
              </div>
              {paper.anchorId && (
                <CopyLinkButton
                  anchorId={paper.anchorId}
                  label="Copy link to this paper"
                />
              )}
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold mb-3 line-clamp-3 min-h-[84px] bg-linear-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300">
              {paper.title}
            </h3>

            {/* Read the locally hosted PDFs in the in-app reader + video link */}
            {(paper.paperPdf ||
              paper.posterPdf ||
              paper.presentationPdf ||
              paper.videoUrl) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {paper.paperPdf && (
                  <ReadPdfButton
                    variant="paper"
                    pdf={paper.paperPdf}
                    title={paper.title}
                    onOpenPDF={onOpenPDF}
                  />
                )}
                {paper.posterPdf && (
                  <ReadPdfButton
                    variant="poster"
                    pdf={paper.posterPdf}
                    title={paper.title}
                    onOpenPDF={onOpenPDF}
                  />
                )}
                {paper.presentationPdf && (
                  <ReadPdfButton
                    variant="presentation"
                    pdf={paper.presentationPdf}
                    title={paper.title}
                    onOpenPDF={onOpenPDF}
                  />
                )}
                {paper.videoUrl && <WatchVideoButton url={paper.videoUrl} />}
              </div>
            )}

            {/* Preview image */}
            {paper.image && (
              <div className="relative h-48 mb-4 rounded-lg overflow-hidden bg-linear-to-br from-muted/50 to-muted/30">
                <OptimizedImage
                  src={paper.image}
                  alt={paper.title}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-contain"
                  placeholder="blur"
                  blurDataURL={DEFAULT_BLUR_PLACEHOLDER}
                  loading="lazy"
                />
              </div>
            )}

            {/* Authors, same treatment as a peer-reviewed card: same icon, same
                clamp, and the site's own author in bold so a reader can find
                the name without reading the list. Optional, because not every
                Other Work entry has an author list worth asserting.

                Placed after the image rather than under the title so it lands in
                the same slot as a peer-reviewed card's, and a reader scanning
                the two kinds of card finds the names in one place. */}
            {paper.authors && paper.authors.length > 0 && (
              <div className="text-sm text-muted-foreground flex items-start gap-1 mb-3">
                <Users className="w-3 h-3 shrink-0 mt-0.5" />
                <p className="line-clamp-2">
                  <AuthorNames authors={paper.authors} />
                </p>
              </div>
            )}

            {/* The short text; the whole one opens in the details dialog */}
            <div className="flex-1 mb-4 min-h-[72px]">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {paper.shortDescription || paper.subtitle}
              </p>
              {paper.subtitle && paper.subtitle.length > 100 && (
                <button
                  type="button"
                  {...{ [DETAILS_TRIGGER]: "" }}
                  aria-haspopup="dialog"
                  aria-label={`Read more about ${paper.title}`}
                  {...paperIntent}
                  onClick={(event) =>
                    onOpenDetails(event.currentTarget, nodeColor)
                  }
                  className="text-xs text-primary hover:underline mt-1"
                >
                  Read more
                </button>
              )}
            </div>

            {/* Action buttons */}
            <div className="mt-auto space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {/* Paper, then BibTeX, then Code - the same order the
                    peer-reviewed cards put them in, so the two kinds of card
                    read alike. footerLink is author-ordered and mixes outward
                    links with repositories, so the repository ones are held
                    back and the BibTeX button sits between the two groups. */}
                {outwardFooterLinks.map(renderFooterLink)}
                {paper.bibtex && (
                  <button
                    onClick={handleBibTeXClick}
                    className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-foreground px-3 py-2 bg-primary/5 hover:bg-primary rounded-lg transition-all duration-200"
                    title="Copy BibTeX"
                  >
                    <span>BibTeX</span>
                    {bibtexCopied ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
                {repoFooterLinks.map(renderFooterLink)}
              </div>
              {paper.arxivId && (
                <ArxivLine
                  arxivId={paper.arxivId}
                  variant={paper.arxivVariant}
                />
              )}
            </div>
          </div>
        </HolographicCard>
      </m.div>
    </SlideInUp>
  );
}

// Helper function to truncate text
function truncateText(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text;
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return truncated.substring(0, lastSpace) + "...";
}

// Dynamic publication card
function DynamicPaperCard({
  publication,
  onOpenPDF,
  onOpenDetails,
  shouldReduceAnimations,
  isDeepLinked = false,
}: {
  publication: Publication;
  onOpenPDF: (url: string, title: string, fileName: string) => void;
  onOpenDetails: OpenDetails;
  shouldReduceAnimations: boolean;
  isDeepLinked?: boolean;
}) {
  const [bibtexCopied, setBibtexCopied] = useState(false);

  const { logoUrl } = useConferenceLogo(
    publication.venue
      ? `${publication.venue} • ${publication.year}`
      : undefined,
  );
  const researchArea = researchAreaOf(publication);
  const fallbackColor = RESEARCH_COLORS[researchArea];
  const publicationStatus = detectPublicationStatus(publication);

  // Extract color from conference logo if available
  const { color: extractedColor } = useColorExtraction(
    logoUrl || "",
    `rgb(${fallbackColor})`,
  );
  const nodeColor = extractedColor.replace("rgb(", "").replace(")", "");

  const handlePDFClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (publication.pdfUrl || publication.openAccessUrl) {
      const pdfUrl = publication.pdfUrl || publication.openAccessUrl || "";
      const fileName = `${publication.authors[0]?.split(" ").pop()}_${publication.year}_${publication.title.split(" ").slice(0, 3).join("_")}.pdf`;
      onOpenPDF(pdfUrl, publication.title, fileName);
    }
  };

  const handleBibTeXClick = async () => {
    try {
      // Prefer the curated verbatim entry; generate one only as a fallback.
      await navigator.clipboard.writeText(
        publication.bibtex ?? publicationToBibTeX(publication),
      );
    } catch {
      // Denied, or unavailable over plain http. Say nothing rather than show
      // a success mark for a copy that did not happen.
      return;
    }
    setBibtexCopied(true);
    setTimeout(() => setBibtexCopied(false), 2000);
  };

  return (
    <SlideInUp className="h-full">
      <m.div
        className="relative h-full"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <HolographicCard
          glowColor={nodeColor}
          insideBackgroundColor={nodeColor}
          forceHover={isDeepLinked}
        >
          <div className="p-6 h-full flex flex-col">
            {/* Header with type badge */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <m.div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `rgba(${nodeColor}, 0.1)` }}
                    whileHover={{ scale: 1.1 }}
                  >
                    {publicationKind(publication) === "Journal" ? (
                      <BookOpen
                        className="w-6 h-6"
                        style={{ color: `rgb(${nodeColor})` }}
                      />
                    ) : publicationKind(publication) === "Poster" ? (
                      <FileText
                        className="w-6 h-6"
                        style={{ color: `rgb(${nodeColor})` }}
                      />
                    ) : (
                      <Sparkles
                        className="w-6 h-6"
                        style={{ color: `rgb(${nodeColor})` }}
                      />
                    )}
                  </m.div>
                  {/* Gentle breathing effect: a CSS loop (motion.css) that
                      pauses with its card when off-screen */}
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none anim-decor anim-breathe-115"
                    style={{
                      backgroundColor: `rgb(${nodeColor})`,
                      opacity: 0.1,
                    }}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {publication.starred && (
                      <Star
                        className="w-4 h-4 shrink-0 fill-amber-400 text-amber-400"
                        aria-label="Featured paper"
                      />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {publicationKind(publication)}
                    </span>
                    {/* Publication status tag */}
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium accent-text"
                      style={{
                        ...accentStyle(`rgb(${publicationStatus.color})`),
                        backgroundColor: `rgba(${publicationStatus.color}, 0.1)`,
                        border: `1px solid rgba(${publicationStatus.color}, 0.3)`,
                      }}
                    >
                      {publicationStatus.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {publication.year}
                    {publication.citations !== undefined &&
                      publication.citations > 0 && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          {publication.googleScholarCitationId ? (
                            <Link
                              href={`https://scholar.google.com/scholar?oi=bibs&hl=en&cites=${publication.googleScholarCitationId}&as_sdt=5`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Sparkles
                                className="w-3 h-3"
                                style={{ color: `rgb(${nodeColor})` }}
                              />
                              {publication.citations} citations
                            </Link>
                          ) : (
                            <Link
                              href={`https://scholar.google.com/scholar?q=${encodeURIComponent(publication.title)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Sparkles
                                className="w-3 h-3"
                                style={{ color: `rgb(${nodeColor})` }}
                              />
                              {publication.citations} citations
                            </Link>
                          )}
                        </>
                      )}
                  </p>
                </div>
              </div>
              <CopyLinkButton
                anchorId={publication.id}
                label="Copy link to this paper"
              />
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold mb-3 line-clamp-3 min-h-[84px] bg-linear-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300">
              {publication.title}
            </h3>

            {/* Read the locally hosted PDFs in the in-app reader + video link */}
            {(publication.paperPdf ||
              publication.posterPdf ||
              publication.presentationPdf ||
              publication.videoUrl) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {publication.paperPdf && (
                  <ReadPdfButton
                    variant="paper"
                    pdf={publication.paperPdf}
                    title={publication.title}
                    onOpenPDF={onOpenPDF}
                  />
                )}
                {publication.posterPdf && (
                  <ReadPdfButton
                    variant="poster"
                    pdf={publication.posterPdf}
                    title={publication.title}
                    onOpenPDF={onOpenPDF}
                  />
                )}
                {publication.presentationPdf && (
                  <ReadPdfButton
                    variant="presentation"
                    pdf={publication.presentationPdf}
                    title={publication.title}
                    onOpenPDF={onOpenPDF}
                  />
                )}
                {publication.videoUrl && (
                  <WatchVideoButton url={publication.videoUrl} />
                )}
              </div>
            )}

            {/* Conference/Journal logo. Height-driven (h-full w-auto) so wide
                logos like ICPR and WCCI scale to the full card height instead of
                being letterboxed by object-contain; the box centers and clips any
                horizontal overflow. */}
            {logoUrl && (
              <div className="relative h-32 mb-3 rounded-lg overflow-hidden bg-linear-to-br from-muted/50 to-muted/30 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt={`${publication.venue} logo`}
                  loading="lazy"
                  className="h-full w-auto object-contain"
                />
              </div>
            )}

            {/* Authors and Venue */}
            <div className="space-y-1 mb-3">
              <div className="text-sm text-muted-foreground flex items-start gap-1 min-h-[48px]">
                <Users className="w-3 h-3 shrink-0 mt-0.5" />
                <p className="line-clamp-2">
                  <AuthorNames authors={publication.authors} />
                </p>
              </div>
              {publication.venue && (
                <p className="text-sm text-muted-foreground min-h-[24px]">
                  {publication.venue}
                </p>
              )}
            </div>

            {/* The short text; the whole abstract opens in the details
                dialog (/api/publications brings it on mount: the page's own
                copy has none) */}
            <div className="flex-1 mb-4 min-h-[72px]">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {publication.shortDescription ||
                  truncateText(
                    publication.abstract || "No abstract available",
                    200,
                  )}
              </p>
              {(() => {
                const abstract = publication.abstract || "";
                const shortDesc = publication.shortDescription;
                const hasLongContent =
                  abstract.length > 200 ||
                  (shortDesc && shortDesc.length > 100);
                const hasDifferentContent = shortDesc && shortDesc !== abstract;

                return (
                  (hasLongContent || hasDifferentContent) && (
                    <button
                      type="button"
                      {...{ [DETAILS_TRIGGER]: "" }}
                      aria-haspopup="dialog"
                      aria-label={`Read more about ${publication.title}`}
                      {...paperIntent}
                      onClick={(event) =>
                        onOpenDetails(event.currentTarget, nodeColor)
                      }
                      className="text-xs text-primary hover:underline mt-1"
                    >
                      Read more
                    </button>
                  )
                );
              })()}
            </div>

            {/* Action buttons */}
            <div className="mt-auto space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {publication.paperUrl && (
                  <Link
                    href={publication.paperUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-foreground px-3 py-2 bg-primary/5 hover:bg-primary rounded-lg transition-all duration-200 group"
                  >
                    <span>Paper</span>
                    <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </Link>
                )}
                {publication.pdfUrl && (
                  <button
                    {...pdfReaderIntent}
                    onClick={handlePDFClick}
                    className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-foreground px-3 py-2 bg-primary/5 hover:bg-primary rounded-lg transition-all duration-200 group"
                  >
                    <span>Poster</span>
                    <Download
                      className={cn(
                        "w-3 h-3",
                        !shouldReduceAnimations && "group-hover:animate-bounce",
                      )}
                    />
                  </button>
                )}
                {publication.bibtex && (
                  <button
                    onClick={handleBibTeXClick}
                    className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-foreground px-3 py-2 bg-primary/5 hover:bg-primary rounded-lg transition-all duration-200"
                    title="Copy BibTeX"
                  >
                    <span>BibTeX</span>
                    {bibtexCopied ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
                {publication.codeUrl && (
                  <Link
                    href={publication.codeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-foreground px-3 py-2 bg-primary/5 hover:bg-primary rounded-lg transition-all duration-200 group"
                  >
                    <span>Code</span>
                    <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </Link>
                )}
                {/* Details gives way to Code when a repo link exists */}
                {publication.semanticScholarUrl && !publication.codeUrl && (
                  <Link
                    href={publication.semanticScholarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-foreground px-3 py-2 bg-primary/5 hover:bg-primary rounded-lg transition-all duration-200 group"
                  >
                    <span>Details</span>
                    <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </Link>
                )}
              </div>
              {/* Only curated entries, or a stated variant: the fetchers fill
                  arxivId from Semantic Scholar on their own, and an omitted
                  variant reads "published version", a claim nobody has
                  checked for an uncurated paper such as an arXiv-only
                  preprint. */}
              {publication.arxivId &&
                (publication.source === "static" ||
                  publication.arxivVariant) && (
                  <ArxivLine
                    arxivId={publication.arxivId}
                    variant={publication.arxivVariant}
                  />
                )}
            </div>
          </div>
        </HolographicCard>
      </m.div>
    </SlideInUp>
  );
}

export function Papers() {
  const shouldReduceAnimations = useShouldReduceAnimations();
  // Seeded from the static list rather than empty. /api/publications serves
  // public/publications.json, which is a mirror of this same array, so the
  // seed is the same data one round trip earlier. It keeps the header from
  // painting "4 academic works, 0 peer-reviewed" and correcting itself, and it
  // means a failed fetch leaves the real publications on screen instead of an
  // empty grid under a header that still claims seven.
  const [dynamicPapers, setDynamicPapers] =
    useState<Publication[]>(STATIC_PUBLICATIONS);
  const [totalCitations, setTotalCitations] = useState(() =>
    STATIC_PUBLICATIONS.reduce((sum, pub) => sum + (pub.citations ?? 0), 0),
  );
  const [filterType, setFilterType] = useState<"all" | "papers" | "theses">(
    "all",
  );
  // Until /api/publications answers (or the abstracts' own chunk does), a
  // publication's dialog says its abstract is on the way.
  const [abstractsPending, setAbstractsPending] = useState(true);
  // A paper's details, one dialog for the section.
  const paperDetails = useDetailsDialog<PaperSubject>();
  const {
    isOpen,
    pdfUrl,
    title,
    downloadFileName,
    shareSlug,
    openPDF,
    closePDF,
  } = usePDFViewer();

  useEffect(() => {
    // Fetch dynamic publications
    // no-store: the publications are manually curated; without it the
    // stale-while-revalidate response header leaves the browser one reload
    // behind every data update.
    fetch("/api/publications", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.publications) {
          setDynamicPapers(data.publications);
          setTotalCitations(data.totalCitations || 0);
        }
        setAbstractsPending(false);
      })
      .catch((error) => {
        // Only log in non-test environments to avoid test stderr pollution
        if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
          logError(error, "Papers.fetchPublications");
        }
        // The abstracts, which the answer would have carried, from their
        // own chunk.
        withAbstracts(STATIC_PUBLICATIONS)
          .then(setDynamicPapers, () => {})
          .finally(() => setAbstractsPending(false));
      });
  }, []);

  // Deep links: a #<publication id | paper anchorId> hash (the BibTeX-style
  // keys, e.g. #claret2026emr) scrolls to that card, pulses a highlight, and
  // holds its hover glow until the user interacts (see useCardDeepLink); with
  // -full (#claret2026emr-full) it also opens the paper's details. The target
  // may be hidden by the filter pills, so onMatch shows everything.
  const { deepLinkedId, highlightedId } = useCardDeepLink(
    [
      ...dynamicPapers.map((p) => p.id),
      ...papersSection.papersCards.flatMap((p) =>
        p.anchorId ? [p.anchorId] : [],
      ),
    ],
    {
      onMatch: () => setFilterType("all"),
      onOpen: (id) => {
        const publication = dynamicPapers.find((p) => p.id === id);
        const index = papersSection.papersCards.findIndex(
          (p) => p.anchorId === id,
        );
        // Not the card's own colour, which its logo or image gives as it
        // loads: its research area's, the card's colour until then.
        if (publication) {
          paperDetails.showFromLink(
            {
              kind: "publication",
              id,
              accent: RESEARCH_COLORS[researchAreaOf(publication)],
            },
            id,
          );
        } else if (index >= 0) {
          paperDetails.showFromLink(
            {
              kind: "other",
              index,
              accent:
                RESEARCH_COLORS[
                  researchAreaOf(papersSection.papersCards[index])
                ],
            },
            id,
          );
        }
      },
    },
  );

  // The open paper, from the latest data: an abstract that arrives while its
  // dialog is open fills it.
  const openSubject = paperDetails.open?.item;
  const openPublication =
    openSubject?.kind === "publication"
      ? dynamicPapers.find((p) => p.id === openSubject.id)
      : undefined;
  const openOther =
    openSubject?.kind === "other"
      ? papersSection.papersCards[openSubject.index]
      : undefined;
  const openPaper: OpenPaper | undefined = openPublication
    ? { kind: "publication", publication: openPublication }
    : openOther && { kind: "other", paper: openOther };

  if (!papersSection.display) {
    return null;
  }

  const hasDynamicPapers = dynamicPapers.length > 0;

  // All three counts come from the data. The total says "works" rather than
  // "publications" because four of them are filed below under Other Work as
  // explicitly not that, and the header used to call all eleven publications.
  // Deliberately unfiltered: these describe the record, not the current view.
  const peerReviewedCount = dynamicPapers.length;
  const totalWorks = peerReviewedCount + papersSection.papersCards.length;
  const citationCount =
    totalCitations +
    papersSection.papersCards.reduce(
      (sum, paper) => sum + (paper.citations ?? 0),
      0,
    );

  // Filter papers based on type
  const filteredDynamicPapers =
    filterType === "theses" ? [] : [...dynamicPapers].sort(comparePublications);
  const filteredStaticPapers =
    filterType === "papers" ? [] : papersSection.papersCards;

  return (
    <div className="relative">
      <div className="container mx-auto px-4 md:px-16 pt-20 pb-8 sm:pt-24 sm:pb-16 max-w-7xl relative">
        <div className="lg:px-8 w-full">
          <div className="text-center mb-12">
            <h2 className="section-title-gradient">{papersSection.title}</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              <span className="text-primary font-semibold">
                {papersSection.subtitle.highlightedText}
              </span>
              {" • "}
              {papersSection.subtitle.normalText}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                {totalWorks} academic works
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                {peerReviewedCount} peer-reviewed
              </span>
              {citationCount > 0 && (
                <span className="flex items-center gap-1">
                  <Sparkles className="w-4 h-4" />
                  {citationCount} citations
                </span>
              )}
            </div>
          </div>

          {/* Filter pills */}
          <div
            role="group"
            aria-label="Filter publications"
            className="flex flex-wrap justify-center gap-2 mb-8"
          >
            <button
              type="button"
              onClick={() => setFilterType("all")}
              aria-pressed={filterType === "all"}
              className={cn(
                "px-3 sm:px-4 py-2 rounded-full text-sm transition-all",
                filterType === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80",
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterType("papers")}
              aria-pressed={filterType === "papers"}
              className={cn(
                "px-3 sm:px-4 py-2 rounded-full text-sm transition-all",
                filterType === "papers"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80",
              )}
            >
              Papers Only
            </button>
            <button
              type="button"
              onClick={() => setFilterType("theses")}
              aria-pressed={filterType === "theses"}
              className={cn(
                "px-3 sm:px-4 py-2 rounded-full text-sm transition-all",
                filterType === "theses"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80",
              )}
            >
              Other Work
            </button>
          </div>

          {/* Dynamic Papers Grid */}
          {hasDynamicPapers && filteredDynamicPapers.length > 0 && (
            <div className="mb-16 w-full">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-semibold mb-2 bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Peer-Reviewed Publications
                </h3>
                <p className="text-sm text-muted-foreground">
                  Journal articles and conference proceedings
                </p>
              </div>
              <div className="flex justify-center">
                <div className="grid gap-6 md:grid-cols-2 grid-rows-auto grid-stretch max-w-[1000px]">
                  {filteredDynamicPapers.map((publication) => (
                    <div
                      key={publication.id}
                      id={publication.id}
                      className={cn(
                        "h-full",
                        highlightedId === publication.id &&
                          "deep-link-highlight",
                      )}
                    >
                      <DynamicPaperCard
                        publication={publication}
                        onOpenPDF={openPDF}
                        onOpenDetails={(trigger, accent) =>
                          paperDetails.show(
                            { kind: "publication", id: publication.id, accent },
                            trigger,
                          )
                        }
                        shouldReduceAnimations={shouldReduceAnimations}
                        isDeepLinked={deepLinkedId === publication.id}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Static Papers Grid */}
          {filteredStaticPapers.length > 0 && (
            <div className="w-full">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-semibold mb-2 bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Other Work
                </h3>
                <p className="text-sm text-muted-foreground">
                  Technical reports, white papers, and additional contributions
                </p>
              </div>
              <div className="flex justify-center">
                <div className="flex flex-wrap justify-center gap-6 max-w-[1500px]">
                  {filteredStaticPapers.map((paper, index) => (
                    <div
                      key={`static-${index}`}
                      id={paper.anchorId}
                      className={cn(
                        "w-full sm:w-auto sm:min-w-[350px] sm:max-w-[450px] md:min-w-[400px] md:max-w-[500px]",
                        highlightedId === paper.anchorId &&
                          "deep-link-highlight",
                      )}
                    >
                      <PaperCard
                        paper={paper}
                        onOpenPDF={openPDF}
                        onOpenDetails={(trigger, accent) =>
                          paperDetails.show(
                            {
                              kind: "other",
                              // In the whole list: the filter may hide some.
                              index: papersSection.papersCards.indexOf(paper),
                              accent,
                            },
                            trigger,
                          )
                        }
                        shouldReduceAnimations={shouldReduceAnimations}
                        isDeepLinked={
                          !!paper.anchorId && deepLinkedId === paper.anchorId
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Export and ORCID links */}
          <div className="text-center mt-12 space-y-4">
            {hasDynamicPapers && (
              <button
                onClick={() => {
                  // Built here: posting the papers to /api/publications ran
                  // this same function, and saved the rate limiter's 429 or
                  // a 500 as the .bib file whenever the request failed.
                  const bibtex = exportToBibTeX(dynamicPapers);
                  const blob = new Blob([bibtex], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "romainclaret-publications.bib";
                  a.click();
                  // Released after the download has had time to read it:
                  // WebKit (and older Firefox) may still be resolving the URL
                  // after click() returns, and revoking at once can fail the
                  // download. FileSaver.js waits 40 s for the same reason. The
                  // blob is a few KB; without this every export kept it for
                  // the life of the page.
                  setTimeout(() => URL.revokeObjectURL(url), 40_000);
                }}
                className="inline-flex items-center gap-2 text-primary hover:underline transition-colors"
              >
                <Download className="w-4 h-4" />
                {/* Named for what it exports. "Export all" left out the
                    Other Work cards, filed apart as not publications, each
                    with its own BibTeX copy button. */}
                Export peer-reviewed publications as BibTeX
              </button>
            )}

            <div>
              <Link
                href={socialMediaLinks.orcid || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline transition-colors"
              >
                <OrcidIcon size={24} />
                View all publications on ORCID
              </Link>
            </div>
          </div>

          {/* A paper's details, once for the section, outside the cards */}
          {paperDetails.dialog && openSubject && openPaper && (
            <PaperDetailsDialog
              open={openPaper}
              {...paperText(openPaper)}
              accent={openSubject.accent}
              abstractPending={abstractsPending}
              dialog={paperDetails.dialog}
              onOpenPDF={openPDF}
            />
          )}

          {/* PDF Modal: opened from a dialog, it mounts after it and so
              paints above it, and takes the keys while it is open. */}
          {isOpen && (
            <PDFModal
              isOpen={isOpen}
              onClose={closePDF}
              pdfUrl={pdfUrl}
              title={title}
              downloadFileName={downloadFileName}
              shareSlug={shareSlug}
            />
          )}
        </div>
      </div>
    </div>
  );
}
