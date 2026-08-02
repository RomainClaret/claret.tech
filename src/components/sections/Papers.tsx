"use client";

import { papersSection, socialMediaLinks } from "@/data/portfolio";
import { FadeIn, SlideInUp } from "@/components/ui/animated";
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
  Presentation,
  Play,
} from "lucide-react";
import { OrcidIcon } from "@/components/icons";
import { DEFAULT_BLUR_PLACEHOLDER } from "@/lib/utils/blur-placeholder";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  comparePublications,
  publicationToBibTeX,
  STATIC_PUBLICATIONS,
  type Publication,
} from "@/lib/api/fetch-publications";
import { usePDFViewer } from "@/lib/hooks/usePDFViewer";
import { useCardDeepLink } from "@/lib/hooks/useCardDeepLink";
import { useConferenceLogo } from "@/lib/hooks/useConferenceLogo";
import { useColorExtraction } from "@/lib/hooks/useColorExtraction";
import { HolographicCard } from "@/components/ui/holographic-card";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import { logError } from "@/lib/utils/dev-logger";

// Lazy load PDF Modal
const PDFModal = dynamic(
  () => import("@/components/ui/pdf-modal").then((mod) => mod.PDFModal),
  {
    ssr: false,
    loading: () => null,
  },
);

// Research area colors
const RESEARCH_COLORS: Record<string, string> = {
  neuroevolution: "139, 92, 246", // Purple
  ml: "59, 130, 246", // Blue
  nlp: "34, 197, 94", // Green
  blockchain: "245, 158, 11", // Amber
  neuroscience: "236, 72, 153", // Pink
  general: "107, 114, 128", // Gray
};

// Detect research area from publication
function detectResearchArea(
  pub: Publication | (typeof papersSection.papersCards)[0],
): string {
  const title = pub.title.toLowerCase();
  const content =
    "abstract" in pub ? pub.abstract : "subtitle" in pub ? pub.subtitle : "";
  const text = `${title} ${content}`.toLowerCase();

  if (
    text.includes("neural") ||
    text.includes("evolution") ||
    text.includes("neuroevolution")
  ) {
    return "neuroevolution";
  }
  if (
    text.includes("machine learning") ||
    text.includes("deep learning") ||
    text.includes("ai")
  ) {
    return "ml";
  }
  if (
    text.includes("language") ||
    text.includes("nlp") ||
    text.includes("chatbot") ||
    text.includes("question")
  ) {
    return "nlp";
  }
  if (
    text.includes("blockchain") ||
    text.includes("distributed") ||
    text.includes("ledger")
  ) {
    return "blockchain";
  }
  if (
    text.includes("vestibular") ||
    text.includes("perception") ||
    text.includes("brain")
  ) {
    return "neuroscience";
  }
  return "general";
}

// Detect publication status
function detectPublicationStatus(
  pub: Publication | (typeof papersSection.papersCards)[0],
): {
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

// Unified styling for the Read Paper / Read Poster buttons: solid, saturated,
// and identical across all cards so they read as actions, not tags.
const READ_PDF_VARIANTS = {
  paper: { color: "37, 99, 235", Icon: BookOpen, label: "Read Paper" }, // Blue
  poster: { color: "234, 88, 12", Icon: FileText, label: "Read Poster" }, // Orange
  presentation: {
    color: "5, 150, 105", // Emerald
    Icon: Presentation,
    label: "Read Presentation",
  },
} as const;

// Solid button that opens a locally hosted PDF in the in-app reader.
function ReadPdfButton({
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
function WatchVideoButton({ url }: { url: string }) {
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

interface PaperCardProps {
  paper: (typeof papersSection.papersCards)[0];
  index: number;
  onOpenPDF: (url: string, title: string, fileName: string) => void;
  shouldReduceAnimations: boolean;
  isDeepLinked?: boolean;
}

// Static paper card with neural design
function PaperCard({
  paper,
  index,
  onOpenPDF,
  shouldReduceAnimations,
  isDeepLinked = false,
}: PaperCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [bibtexCopied, setBibtexCopied] = useState(false);

  // Arriving via a deep link opens the full description.
  useEffect(() => {
    if (isDeepLinked) setIsExpanded(true);
  }, [isDeepLinked]);

  const handleBibTeXClick = async () => {
    if (!paper.bibtex) return;
    await navigator.clipboard.writeText(paper.bibtex);
    setBibtexCopied(true);
    setTimeout(() => setBibtexCopied(false), 2000);
  };

  const researchArea = detectResearchArea(paper);
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
  const paperType = paper.title.toLowerCase().includes("thesis")
    ? "thesis"
    : paper.title.toLowerCase().includes("poster") ||
        !!paper.posterPdf ||
        paper.footerLink.some((l) => l.name.toLowerCase() === "poster")
      ? "poster"
      : "paper";

  return (
    <SlideInUp delay={index * 100} className="h-full">
      <motion.div
        className="relative h-full"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <HolographicCard
          glowColor={nodeColor}
          insideBackgroundColor={nodeColor}
          className="h-full"
          forceHover={isDeepLinked}
        >
          <div className="p-6 h-full flex flex-col">
            {/* Header with type badge */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <motion.div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `rgba(${nodeColor}, 0.1)` }}
                    whileHover={{ scale: 1.1 }}
                  >
                    {paperType === "thesis" ? (
                      <Sparkles
                        className="w-6 h-6"
                        style={{ color: `rgb(${nodeColor})` }}
                      />
                    ) : paperType === "poster" ? (
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
                  </motion.div>
                  {/* Gentle breathing effect instead of aggressive pulse */}
                  <motion.div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      backgroundColor: `rgb(${nodeColor})`,
                      opacity: 0.1,
                    }}
                    animate={{
                      scale: [1, 1.15, 1],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">
                      {paperType === "thesis"
                        ? "Thesis"
                        : paperType === "poster"
                          ? "Poster"
                          : "Paper"}
                    </span>
                    {/* Publication status tag */}
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: `rgba(${publicationStatus.color}, 0.1)`,
                        color: `rgb(${publicationStatus.color})`,
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
            <h3 className="text-lg font-semibold mb-3 line-clamp-3 min-h-[84px] bg-gradient-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300">
              {paper.title}
            </h3>

            {/* Read the locally hosted PDFs in the in-app reader + video link */}
            {(paper.paperPdf || paper.posterPdf || paper.videoUrl) && (
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
              <div className="relative h-48 mb-4 rounded-lg overflow-hidden bg-gradient-to-br from-muted/50 to-muted/30">
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

            {/* Abstract with expand/collapse */}
            <div className="flex-1 mb-4 min-h-[72px]">
              <p
                className={cn(
                  "text-sm text-muted-foreground transition-all duration-300",
                  !isExpanded && "line-clamp-3",
                )}
              >
                {isExpanded
                  ? paper.subtitle
                  : paper.shortDescription || paper.subtitle}
              </p>
              {paper.subtitle && paper.subtitle.length > 100 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs text-primary hover:underline mt-1"
                >
                  {isExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2 mt-auto">
              {paper.footerLink.map((link, i) => {
                const isPDF =
                  link.url.endsWith(".pdf") && link.url.startsWith("/");

                if (isPDF) {
                  return (
                    <button
                      key={i}
                      onClick={(e) => handleLinkClick(e, link)}
                      className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-foreground px-3 py-2 bg-primary/10 hover:bg-primary rounded-lg transition-all duration-200 group"
                    >
                      <span className="truncate">{link.name}</span>
                      <Download
                        className={cn(
                          "w-3 h-3 flex-shrink-0",
                          !shouldReduceAnimations &&
                            "group-hover:animate-bounce",
                        )}
                      />
                    </button>
                  );
                }

                return (
                  <Link
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-foreground px-3 py-2 bg-primary/10 hover:bg-primary rounded-lg transition-all duration-200 group"
                  >
                    <span className="truncate">{link.name}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </Link>
                );
              })}
              {paper.bibtex && (
                <button
                  onClick={handleBibTeXClick}
                  className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-foreground px-3 py-2 bg-primary/10 hover:bg-primary rounded-lg transition-all duration-200"
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
            </div>
          </div>
        </HolographicCard>
      </motion.div>
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
  index,
  onOpenPDF,
  shouldReduceAnimations,
  isDeepLinked = false,
}: {
  publication: Publication;
  index: number;
  onOpenPDF: (url: string, title: string, fileName: string) => void;
  shouldReduceAnimations: boolean;
  isDeepLinked?: boolean;
}) {
  const [bibtexCopied, setBibtexCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Arriving via a deep link opens the full abstract.
  useEffect(() => {
    if (isDeepLinked) setIsExpanded(true);
  }, [isDeepLinked]);
  const { logoUrl } = useConferenceLogo(
    publication.venue
      ? `${publication.venue} • ${publication.year}`
      : undefined,
  );
  const researchArea = detectResearchArea(publication);
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
    // Prefer the curated verbatim entry; generate one only as a fallback.
    await navigator.clipboard.writeText(
      publication.bibtex ?? publicationToBibTeX(publication),
    );
    setBibtexCopied(true);
    setTimeout(() => setBibtexCopied(false), 2000);
  };

  return (
    <SlideInUp delay={index * 100} className="h-full">
      <motion.div
        className="relative h-full"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <HolographicCard
          glowColor={nodeColor}
          insideBackgroundColor={nodeColor}
          className="h-full"
          forceHover={isDeepLinked}
        >
          <div className="p-6 h-full flex flex-col">
            {/* Header with type badge */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <motion.div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `rgba(${nodeColor}, 0.1)` }}
                    whileHover={{ scale: 1.1 }}
                  >
                    {publication.venue?.toLowerCase().includes("journal") ? (
                      <BookOpen
                        className="w-6 h-6"
                        style={{ color: `rgb(${nodeColor})` }}
                      />
                    ) : publication.venue?.toLowerCase().includes("poster") ? (
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
                  </motion.div>
                  {/* Gentle breathing effect instead of aggressive pulse */}
                  <motion.div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      backgroundColor: `rgb(${nodeColor})`,
                      opacity: 0.1,
                    }}
                    animate={{
                      scale: [1, 1.15, 1],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {publication.starred && (
                      <Star
                        className="w-4 h-4 flex-shrink-0 fill-amber-400 text-amber-400"
                        aria-label="Featured paper"
                      />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {publication.venue?.toLowerCase().includes("journal")
                        ? "Journal"
                        : publication.venue?.toLowerCase().includes("poster")
                          ? "Poster"
                          : "Conference"}
                    </span>
                    {/* Publication status tag */}
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: `rgba(${publicationStatus.color}, 0.1)`,
                        color: `rgb(${publicationStatus.color})`,
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
            <h3 className="text-lg font-semibold mb-3 line-clamp-3 min-h-[84px] bg-gradient-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300">
              {publication.title}
            </h3>

            {/* Read the locally hosted PDFs in the in-app reader + video link */}
            {(publication.paperPdf ||
              publication.posterPdf ||
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
              <div className="relative h-32 mb-3 rounded-lg overflow-hidden bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center">
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
                <Users className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <p className="line-clamp-2">
                  {publication.authors.map((author, i) => (
                    <span key={i}>
                      {i > 0 && ", "}
                      {author === HIGHLIGHTED_AUTHOR ? (
                        <span className="font-semibold text-foreground">
                          {author}
                        </span>
                      ) : (
                        author
                      )}
                    </span>
                  ))}
                  {/* The line-clamp-2 will automatically handle overflow */}
                </p>
              </div>
              {publication.venue && (
                <p className="text-sm text-muted-foreground min-h-[24px]">
                  {publication.venue}
                </p>
              )}
            </div>

            {/* Abstract with expand/collapse */}
            <div className="flex-1 mb-4 min-h-[72px]">
              <p
                className={cn(
                  "text-sm text-muted-foreground transition-all duration-300",
                  !isExpanded && "line-clamp-3",
                )}
              >
                {(() => {
                  const abstract =
                    publication.abstract || "No abstract available";
                  const shortDesc = publication.shortDescription;

                  if (isExpanded) {
                    // Show full abstract when expanded
                    return abstract;
                  } else {
                    // Show shortDescription if available, otherwise show truncated abstract
                    return shortDesc || truncateText(abstract, 200);
                  }
                })()}
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
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="text-xs text-primary hover:underline mt-1"
                    >
                      {isExpanded ? "Show less" : "Read more"}
                    </button>
                  )
                );
              })()}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2 mt-auto">
              {publication.paperUrl && (
                <Link
                  href={publication.paperUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-foreground px-3 py-2 bg-primary/10 hover:bg-primary rounded-lg transition-all duration-200 group"
                >
                  <span>Paper</span>
                  <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              )}
              {publication.pdfUrl && (
                <button
                  onClick={handlePDFClick}
                  className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-foreground px-3 py-2 bg-primary/10 hover:bg-primary rounded-lg transition-all duration-200 group"
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
                  className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-foreground px-3 py-2 bg-primary/10 hover:bg-primary rounded-lg transition-all duration-200"
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
                  className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-foreground px-3 py-2 bg-primary/10 hover:bg-primary rounded-lg transition-all duration-200 group"
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
                  className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary-foreground px-3 py-2 bg-primary/10 hover:bg-primary rounded-lg transition-all duration-200 group"
                >
                  <span>Details</span>
                  <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              )}
            </div>
          </div>
        </HolographicCard>
      </motion.div>
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
      })
      .catch((error) => {
        // Only log in non-test environments to avoid test stderr pollution
        if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
          logError(error, "Papers.fetchPublications");
        }
      });
  }, []);

  // Deep links: a #<publication id | paper anchorId> hash (the BibTeX-style
  // keys, e.g. #claret2026emr) scrolls to that card, pulses a highlight, and
  // holds its hover glow until the user interacts (see useCardDeepLink). The
  // target may be hidden by the filter pills, so onMatch shows everything.
  const { deepLinkedId, highlightedId } = useCardDeepLink(
    [
      ...dynamicPapers.map((p) => p.id),
      ...papersSection.papersCards.flatMap((p) =>
        p.anchorId ? [p.anchorId] : [],
      ),
    ],
    { onMatch: () => setFilterType("all") },
  );

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
          <FadeIn className="text-center mb-12">
            <h2 className="section-title-gradient">{papersSection.title}</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              <span className="text-primary font-semibold">
                {papersSection.subtitle.highlightedText}
              </span>
              {" • "}
              {papersSection.subtitle.normalText}
            </p>
            <div className="flex items-center justify-center gap-6 mt-4 text-sm text-muted-foreground">
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
          </FadeIn>

          {/* Filter pills */}
          <div className="flex justify-center gap-2 mb-8">
            <button
              onClick={() => setFilterType("all")}
              className={cn(
                "px-4 py-2 rounded-full text-sm transition-all",
                filterType === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80",
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("papers")}
              className={cn(
                "px-4 py-2 rounded-full text-sm transition-all",
                filterType === "papers"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80",
              )}
            >
              Papers Only
            </button>
            <button
              onClick={() => setFilterType("theses")}
              className={cn(
                "px-4 py-2 rounded-full text-sm transition-all",
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
              <FadeIn delay={200} className="text-center mb-8">
                <h3 className="text-2xl font-semibold mb-2 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Peer-Reviewed Publications
                </h3>
                <p className="text-sm text-muted-foreground">
                  Journal articles and conference proceedings
                </p>
              </FadeIn>
              <div className="flex justify-center">
                <div className="grid gap-6 md:grid-cols-2 grid-rows-auto grid-stretch max-w-[1000px]">
                  {filteredDynamicPapers.map((publication, index) => (
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
                        index={index}
                        onOpenPDF={openPDF}
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
              <FadeIn
                delay={hasDynamicPapers ? 400 : 200}
                className="text-center mb-8"
              >
                <h3 className="text-2xl font-semibold mb-2 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  Other Work
                </h3>
                <p className="text-sm text-muted-foreground">
                  Technical reports, white papers, and additional contributions
                </p>
              </FadeIn>
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
                        index={index + filteredDynamicPapers.length}
                        onOpenPDF={openPDF}
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
          <FadeIn delay={600} className="text-center mt-12 space-y-4">
            {hasDynamicPapers && (
              <button
                onClick={async () => {
                  const response = await fetch("/api/publications", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ publications: dynamicPapers }),
                  });
                  const bibtex = await response.text();
                  const blob = new Blob([bibtex], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "romainclaret-publications.bib";
                  a.click();
                }}
                className="inline-flex items-center gap-2 text-primary hover:underline transition-colors"
              >
                <Download className="w-4 h-4" />
                Export all as BibTeX
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
          </FadeIn>

          {/* PDF Modal */}
          <PDFModal
            isOpen={isOpen}
            onClose={closePDF}
            pdfUrl={pdfUrl}
            title={title}
            downloadFileName={downloadFileName}
            shareSlug={shareSlug}
          />
        </div>
      </div>
    </div>
  );
}
