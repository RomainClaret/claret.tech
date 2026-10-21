"use client";

import { researchSection } from "@/data/sections/research";
import { SlideInUp, ScaleIn } from "@/components/ui/animated";
import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  Zap,
  FileText,
  Brain,
  Calendar,
  Award,
  Sparkles,
  BookOpen,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useId } from "react";
import { getFormattedResearchYears } from "@/lib/utils/experience-calculator";
import { HolographicCard } from "@/components/ui/holographic-card";
import { HolographicStatsCard } from "@/components/ui/holographic-stats-card";
import { m } from "framer-motion";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { usePDFViewer } from "@/lib/hooks/usePDFViewer";
import { pdfReaderIntent } from "@/lib/pdf-reader-preload";
import { loadPdfModal } from "@/components/ui/pdf-modal-loader";
import { useCardDeepLink } from "@/lib/hooks/useCardDeepLink";
import { useAnimationGate } from "@/lib/hooks/useMotionGate";
import dynamic from "next/dynamic";
import { accentStyle } from "@/components/ui/accent-text";
import {
  DETAILS_TRIGGER,
  useDetailsDialog,
} from "@/lib/hooks/useDetailsDialog";
import { lazyDetails } from "@/components/ui/lazy-details";
import type { ResearchSubject } from "./ResearchDetailsDialog";
import {
  iconMap,
  isLocalPdf,
  pdfFileName,
  projectColor,
  iconKey,
  statusConfig,
  visibleProjects,
  type ResearchProject,
} from "./research-shared";

interface ResearchCardProps {
  project: ResearchProject;
  /** A click anywhere on the card opens its details (useDetailsDialog). */
  onOpen: (event: React.MouseEvent<HTMLElement>) => void;
  isLeftSide?: boolean;
  /** Arrived via a deep link: hold the glow. */
  isDeepLinked?: boolean;
  /** Briefly ring-pulse this card after a deep link lands on it. */
  isHighlighted?: boolean;
}

// Fetched on intent and mounted only while open (pdf-reader-preload.ts),
// same as Papers.
const PDFModal = dynamic(loadPdfModal, {
  ssr: false,
  loading: () => null,
});

// A card's details (ResearchDetailsDialog.tsx): a chunk of its own with the
// section's long texts.
const { Dialog: ResearchDetailsDialog, intent: researchIntent } = lazyDetails(
  () =>
    import("./ResearchDetailsDialog").then((mod) => mod.ResearchDetailsDialog),
  "Research details chunk",
);

/** A card's name and short text: its dialog's title, and its stand-in's. */
const subjectText = (subject: ResearchSubject) =>
  subject.kind === "journey"
    ? {
        title: "My Research Journey",
        summary: researchSection.journeyShortDescription,
      }
    : {
        title: visibleProjects[subject.index].title,
        summary: visibleProjects[subject.index].shortDescription,
      };

function ResearchCard({
  project,
  onOpen,
  isLeftSide = false,
  isDeepLinked = false,
  isHighlighted = false,
}: ResearchCardProps) {
  const status = statusConfig[project.status];
  const Icon = iconMap[iconKey(project)];
  const year = project.year;
  const nodeColor = projectColor(project);

  return (
    <m.div
      className="relative h-full"
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Year Badge - moved outside card for proper layering */}
      {year && (
        <div
          className={cn(
            "absolute -top-3 px-2.5 py-0.5 bg-background border border-border rounded-full z-10",
            isLeftSide ? "-left-3" : "-right-3",
          )}
        >
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {year}
          </span>
        </div>
      )}

      {/* A click anywhere on the card opens its details above the page
          (it grew in place, pushing the grid around); pointing at it or
          focusing it fetches the dialog's code. */}
      <div
        id={project.anchorId}
        onClick={onOpen}
        {...researchIntent}
        className={cn(
          "h-full cursor-pointer",
          isHighlighted && "deep-link-highlight",
        )}
      >
        <HolographicCard glowColor={nodeColor} forceHover={isDeepLinked}>
          <div className="p-4 sm:p-6">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="relative">
                <m.div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `rgba(${nodeColor}, 0.1)` }}
                  whileHover={{ scale: 1.1 }}
                >
                  <Icon
                    className="w-6 h-6"
                    style={{ color: `rgb(${nodeColor})` }}
                  />
                </m.div>
                {/* Gentle breathing effect: a CSS loop (motion.css) */}
                <div
                  className="absolute inset-0 rounded-full pointer-events-none anim-decor anim-breathe-115"
                  style={{
                    backgroundColor: `rgb(${nodeColor})`,
                    opacity: 0.1,
                    willChange: "transform",
                  }}
                />
              </div>
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-bold mb-1 bg-linear-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300">
                  {project.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                  {project.subtitle}
                </p>
                {project.shortDescription && (
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {project.shortDescription}
                  </p>
                )}
              </div>
            </div>

            {/* Status Badge */}
            <div className="mb-3">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium accent-text"
                style={{
                  ...accentStyle(`rgb(${status.rgbColor})`),
                  backgroundColor: `rgba(${status.rgbColor}, 0.1)`,
                  border: `1px solid rgba(${status.rgbColor}, 0.3)`,
                }}
              >
                <status.icon className="w-3 h-3" />
                {status.text}
              </span>
            </div>

            {/* What the details hold, and the way to them */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-4">
              {project.links && (
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {project.links.length}{" "}
                  {project.links.length === 1 ? "Resource" : "Resources"}
                </span>
              )}
              {project.highlights && (
                <span className="flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  {project.highlights.length} Achievements
                </span>
              )}
              {/* The card opens from a click anywhere on it; this is its
                  control for the keyboard and for screen readers, and the
                  way back when the dialog closes. */}
              <button
                type="button"
                {...{ [DETAILS_TRIGGER]: "" }}
                aria-haspopup="dialog"
                aria-label={`Read more about ${project.title}`}
                className="flex items-center gap-1 ml-auto text-primary cursor-pointer rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                Read more
                <ArrowRight aria-hidden="true" className="w-3 h-3" />
              </button>
            </div>
          </div>
        </HolographicCard>
      </div>
    </m.div>
  );
}

export function Research() {
  const shouldReduceAnimations = useShouldReduceAnimations();
  const highlightId = useId();
  // The hero glow and the timeline pulse only run while on screen. Not tied
  // to the animation switch, which they never followed: Safari, where it
  // starts off, keeps its look.
  const { ref: heroGlowRef, active: heroGlowActive } = useAnimationGate({
    respectPlaying: false,
  });
  const { ref: timelineRef, active: timelineActive } = useAnimationGate({
    respectPlaying: false,
  });
  // The cards' details, the hero's and the journey's: one dialog for the
  // section, with the long texts (ResearchDetailsDialog.tsx).
  const cardDetails = useDetailsDialog<ResearchSubject>();
  const {
    isOpen,
    pdfUrl,
    title,
    downloadFileName,
    shareSlug,
    openPDF,
    closePDF,
  } = usePDFViewer();

  // Above the display check: hooks cannot sit behind an early return.
  //
  // #<anchor> points at a card; #<anchor>-full also opens its details
  // (useCardDeepLink's onOpen), so a link can share a card without forcing
  // the long read on the reader.
  const heroAnchor = visibleProjects[0].anchorId;
  const { deepLinkedId, highlightedId } = useCardDeepLink(
    visibleProjects.flatMap((p) => (p.anchorId ? [p.anchorId] : [])),
    {
      onOpen: (id) => {
        const index = visibleProjects.findIndex((p) => p.anchorId === id);
        if (index >= 0) {
          cardDetails.showFromLink({ kind: "project", index }, id);
        }
      },
    },
  );
  const heroIsLinked = !!heroAnchor && deepLinkedId === heroAnchor;

  if (!researchSection.display) {
    return null;
  }

  const stats = {
    totalProjects: visibleProjects.length,
    activeProjects: visibleProjects.filter((p) => p.status === "active").length,
    yearsOfResearch: getFormattedResearchYears(
      visibleProjects,
      researchSection.additionalResearchYears,
    ),
    // Hand-maintained, not derived from the data: several projects share a
    // field, so counting distinct tags would overcount.
    researchAreas: 5, // Neuroevolution, Artificial Life, Conversational AI, Decentralization, Neuroscience
    technologies: new Set(visibleProjects.flatMap((p) => p.tags)).size,
  };

  return (
    <div className="container mx-auto px-4 md:px-16 pt-20 pb-8 sm:pt-24 sm:pb-16 max-w-7xl relative">
      <div className="lg:px-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="section-title-gradient">{researchSection.title}</h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-4xl mx-auto">
            <span className="text-primary font-semibold">
              {researchSection.subtitle.highlightedText}
            </span>
            {" • "}
            {researchSection.subtitle.normalText}
          </p>
        </div>

        {/* Research Journey: a teaser, the story in the dialog */}
        {researchSection.journeyShortDescription && (
          <SlideInUp className="mb-8 sm:mb-12">
            <m.div
              className="relative max-w-4xl mx-auto"
              whileHover={{ scale: 1.005 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              {/* Floating badge */}
              {researchSection.journeyBadge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background px-3 py-1 rounded-full border border-primary/30 z-10">
                  <span className="text-xs font-semibold text-primary flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {researchSection.journeyBadge}
                  </span>
                </div>
              )}

              <HolographicCard
                glowColor="245, 158, 11"
                className="bg-linear-to-br from-amber-500/5 via-orange-500/5 to-yellow-500/5 backdrop-blur-xs"
              >
                <div className="p-6 sm:p-8 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <m.div
                        className="w-16 h-16 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: "rgba(245, 158, 11, 0.1)" }}
                        whileHover={{ scale: 1.1, rotate: 15 }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                      >
                        <Rocket
                          className="w-8 h-8"
                          style={{ color: "rgb(245, 158, 11)" }}
                        />
                      </m.div>
                      {/* Breathing effect: a CSS loop (motion.css), 4 s */}
                      <div
                        className="absolute inset-0 rounded-full pointer-events-none anim-decor anim-breathe-120"
                        style={{
                          backgroundColor: "rgb(245, 158, 11)",
                          opacity: 0.1,
                          animationDuration: "4s",
                        }}
                      />
                    </div>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold mb-4 bg-linear-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                    My Research Journey
                  </h3>

                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl mx-auto">
                    {researchSection.journeyShortDescription}
                  </p>

                  <div className="flex justify-center mt-6">
                    <m.button
                      type="button"
                      aria-haspopup="dialog"
                      {...researchIntent}
                      onClick={(event) =>
                        cardDetails.show(
                          { kind: "journey" },
                          event.currentTarget,
                        )
                      }
                      className="group flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-300"
                      style={{ borderColor: "rgba(245, 158, 11, 0.3)" }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span
                        className="text-sm font-medium accent-text"
                        style={accentStyle("rgb(245, 158, 11)")}
                      >
                        Read the full story
                      </span>
                      <ArrowRight
                        className="w-4 h-4"
                        style={{ color: "rgb(245, 158, 11)" }}
                        aria-hidden="true"
                      />
                    </m.button>
                  </div>
                </div>
              </HolographicCard>
            </m.div>
          </SlideInUp>
        )}

        {/* Research Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 mb-8 sm:mb-12">
          <HolographicStatsCard
            glowColor="59, 130, 246"
            insideBackgroundColor="59, 130, 246"
            delay={0.1}
          >
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-primary mb-0.5 sm:mb-1">
                {stats.totalProjects}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Research Projects
              </div>
            </div>
          </HolographicStatsCard>

          <HolographicStatsCard
            glowColor="34, 197, 94"
            insideBackgroundColor="34, 197, 94"
            delay={0.15}
          >
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-green-700 dark:text-green-400 mb-0.5 sm:mb-1">
                {stats.activeProjects}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Active Research
              </div>
            </div>
          </HolographicStatsCard>

          <HolographicStatsCard
            glowColor="245, 158, 11"
            insideBackgroundColor="245, 158, 11"
            delay={0.2}
          >
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-amber-700 dark:text-amber-400 mb-0.5 sm:mb-1">
                {stats.yearsOfResearch}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Years of Research
              </div>
            </div>
          </HolographicStatsCard>

          <HolographicStatsCard
            glowColor="139, 92, 246"
            insideBackgroundColor="139, 92, 246"
            delay={0.25}
          >
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-purple-700 dark:text-purple-400 mb-0.5 sm:mb-1">
                {stats.researchAreas}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Research Areas
              </div>
            </div>
          </HolographicStatsCard>
        </div>

        {/* PhD Research Hero Feature - Standalone */}
        {/* z-20, above the z-10 project grid below. The highlight tooltips
            hang past this card's bottom edge, and at equal z-index the grid
            wins on DOM order and paints over the escaping text. */}
        <SlideInUp className="mb-8 sm:mb-16 relative z-20">
          <m.div
            id={heroAnchor}
            className={cn(
              "relative",
              highlightedId === heroAnchor && "deep-link-highlight",
            )}
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {/* Unified Badge - Elegant single pill design */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
              <div className="bg-background px-5 py-1.5 rounded-full border border-primary/50 shadow-lg shadow-primary/10">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-primary flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    Current Focus
                  </span>
                  {visibleProjects[0].year && (
                    <>
                      <div className="w-px h-4 bg-border" />
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3 opacity-70" />
                        {visibleProjects[0].year}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Neural glow effect for hero; rests at its starting opacity
                while off-screen */}
            <m.div
              ref={heroGlowRef}
              className="absolute -inset-1 rounded-2xl opacity-0 blur-xl"
              style={{
                backgroundColor: `rgb(${visibleProjects[0].color || "139, 92, 246"})`,
              }}
              initial={{ opacity: 0.3 }}
              animate={
                heroGlowActive ? { opacity: [0.3, 0.5, 0.3] } : { opacity: 0.3 }
              }
              transition={
                heroGlowActive
                  ? { duration: 3, repeat: Infinity }
                  : { duration: 0 }
              }
            />

            <HolographicCard
              glowColor={visibleProjects[0].color || "139, 92, 246"}
              className="bg-linear-to-br from-primary/5 via-purple-500/5 to-pink-500/5 backdrop-blur-xs"
              // The highlight boxes below open hover tooltips that are taller
              // than the space left under them, so the card must not clip.
              allowContentOverflow
              forceHover={heroIsLinked}
            >
              <div className="p-6 sm:p-8">
                <div className="text-center mb-4 sm:mb-6">
                  <h3 className="text-xl sm:text-2xl font-bold mb-2 bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                    {visibleProjects[0].title}
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground mb-2">
                    {visibleProjects[0].subtitle}
                  </p>
                </div>

                {/* The short description, and the way to the full one */}
                <div className="text-center mb-6 sm:mb-8 max-w-3xl mx-auto">
                  <p className="text-sm sm:text-base text-muted-foreground">
                    {visibleProjects[0].shortDescription}
                  </p>

                  <div className="flex justify-center mt-4">
                    <m.button
                      type="button"
                      {...{ [DETAILS_TRIGGER]: "" }}
                      aria-haspopup="dialog"
                      {...researchIntent}
                      onClick={(event) =>
                        cardDetails.show(
                          { kind: "project", index: 0 },
                          event.currentTarget,
                        )
                      }
                      className="group flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-300"
                      style={{
                        borderColor: `rgba(${projectColor(visibleProjects[0])}, 0.3)`,
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span
                        className="text-xs font-medium accent-text"
                        style={accentStyle(
                          `rgb(${projectColor(visibleProjects[0])})`,
                        )}
                      >
                        Read full description
                      </span>
                      <ArrowRight
                        className="w-3 h-3"
                        style={{
                          color: `rgb(${projectColor(visibleProjects[0])})`,
                        }}
                        aria-hidden="true"
                      />
                    </m.button>
                  </div>
                </div>

                {/* Visual Representation. auto-rows-fr + h-full equalize the
                    highlight boxes to the tallest one across all rows. */}
                <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-fr gap-3 sm:gap-4 mb-6 sm:mb-8 relative">
                  {visibleProjects[0].highlights?.map((highlight, i) => {
                    const iconName =
                      researchSection.highlightIcons?.[i] || "Brain";
                    const Icon =
                      iconMap[iconName as keyof typeof iconMap] || Brain;
                    const expandedDescriptions =
                      visibleProjects[0].expandedHighlightDescriptions || [];

                    const explanation = expandedDescriptions[i];
                    const explanationId = `${highlightId}-${i}`;
                    return (
                      <ScaleIn key={i} className="h-full">
                        <m.div
                          // Focusable when it has an explanation, which shows
                          // on focus or a tap as it does on hover: hover alone
                          // kept it from keyboards and touch screens.
                          tabIndex={explanation ? 0 : undefined}
                          aria-describedby={
                            explanation ? explanationId : undefined
                          }
                          className="group relative h-full bg-card/50 backdrop-blur-xs rounded-lg p-3 sm:p-4 text-center border border-primary/20 hover:border-primary/50 focus-visible:border-primary/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring transition-all hover:shadow-lg min-h-[140px] sm:min-h-[160px] flex flex-col justify-between"
                          whileHover={{ scale: 1.05 }}
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 20,
                          }}
                        >
                          <div className="flex flex-col items-center">
                            <Icon
                              className="w-6 h-6 sm:w-8 sm:h-8 mb-1.5 sm:mb-2"
                              style={{
                                color: `rgb(${visibleProjects[0].color || "139, 92, 246"})`,
                              }}
                            />
                            <p className="text-lg sm:text-xl font-bold mb-1">
                              {researchSection.highlightLabels[i] || highlight}
                            </p>
                          </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
                            {highlight}
                          </p>

                          {/* Hover tooltip with expanded description. Escapes
                                the card via allowContentOverflow above; without
                                it the card clips this and the text is cut off.
                                Centered under its card in the four-column
                                grid. In the two-column phone grid it lines up
                                with the card's outer edge instead: centered,
                                the right column's 256 px box ended about
                                14 px past the screen, which, hidden or not,
                                made the page pan sideways and stretched the
                                fixed navigation and site grid to match. */}
                          <div
                            id={explanationId}
                            role="tooltip"
                            className={cn(
                              "absolute top-full mt-2 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-all duration-300 pointer-events-none z-60 w-64",
                              i % 2 === 0 ? "left-0" : "right-0",
                              "md:left-1/2 md:right-auto md:-translate-x-1/2",
                            )}
                          >
                            <div className="bg-popover text-popover-foreground rounded-lg shadow-xl border p-3">
                              <p className="text-xs leading-relaxed">
                                {explanation}
                              </p>
                            </div>
                          </div>
                        </m.div>
                      </ScaleIn>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center mb-4 sm:mb-6">
                  {visibleProjects[0].tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-medium rounded-lg accent-text"
                      style={{
                        ...accentStyle(
                          `rgb(${visibleProjects[0].color || "139, 92, 246"})`,
                        ),
                        backgroundColor: `rgba(${visibleProjects[0].color || "139, 92, 246"}, 0.1)`,
                        border: `1px solid rgba(${visibleProjects[0].color || "139, 92, 246"}, 0.3)`,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {visibleProjects[0].links && (
                  <div className="flex justify-center gap-4">
                    {visibleProjects[0].links.map((link, i) => {
                      const isGitHub = link.name
                        .toLowerCase()
                        .includes("github");

                      if (isGitHub) {
                        return (
                          <div key={i} className="text-center">
                            <button
                              disabled
                              className="inline-flex items-center gap-2 px-4 py-2 bg-primary/50 text-primary-foreground/70 rounded-lg cursor-not-allowed transition-all"
                            >
                              <GitBranch className="w-4 h-4" />
                              {link.name}
                            </button>
                            <p className="text-xs text-muted-foreground mt-1">
                              {researchSection.publicationNote}
                            </p>
                          </div>
                        );
                      }

                      const heroLinkClass =
                        "inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all hover:scale-105 hover:shadow-lg";

                      if (isLocalPdf(link.url)) {
                        return (
                          <button
                            key={i}
                            type="button"
                            className={heroLinkClass}
                            {...pdfReaderIntent}
                            onClick={() =>
                              openPDF(
                                link.url,
                                visibleProjects[0].title,
                                pdfFileName(link.url),
                              )
                            }
                          >
                            <BookOpen className="w-4 h-4" />
                            {link.name}
                          </button>
                        );
                      }

                      return (
                        <Link
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={heroLinkClass}
                        >
                          <GitBranch className="w-4 h-4" />
                          {link.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </HolographicCard>
          </m.div>
        </SlideInUp>

        {/* Timeline Container for Other Research Projects */}
        <div className="relative">
          {/* Unified Timeline for Desktop - single continuous element */}
          <div
            ref={timelineRef}
            data-anim={timelineActive ? "on" : "off"}
            className="absolute left-1/2 -top-8 sm:-top-16 bottom-0 w-0.5 -translate-x-1/2 hidden md:block -z-10"
          >
            {/* Continuous gradient from Current Focus to end */}
            <div className="absolute inset-0 bg-linear-to-b from-primary/30 via-primary/20 to-transparent" />
            {/* Subtle pulse animation for visual continuity */}
            <div
              className={cn(
                "absolute inset-0 bg-linear-to-b from-primary/40 via-primary/25 to-transparent opacity-50",
                !shouldReduceAnimations && "animate-pulse anim-decor",
              )}
            />
          </div>

          {/* Mobile Timeline - simplified single element */}
          <div className="absolute left-1/2 -top-8 sm:-top-16 bottom-0 w-0.5 -translate-x-1/2 md:hidden -z-10">
            <div className="absolute inset-0 bg-linear-to-b from-primary/25 via-primary/15 to-transparent" />
          </div>

          {/* Other Research Projects Grid */}
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6 relative z-10">
            {visibleProjects.slice(1).map((project, index) => (
              <SlideInUp key={index + 1}>
                <ResearchCard
                  project={project}
                  onOpen={cardDetails.onCardClick({
                    kind: "project",
                    index: index + 1,
                  })}
                  isLeftSide={index % 2 === 0}
                  isDeepLinked={
                    !!project.anchorId && deepLinkedId === project.anchorId
                  }
                  isHighlighted={
                    !!project.anchorId && highlightedId === project.anchorId
                  }
                />
              </SlideInUp>
            ))}
          </div>
        </div>
      </div>

      {/* A card's details, once for the section, outside the cards: inside
          a clickable card, every click in the dialog would reach the card
          (portal events bubble along the component tree). */}
      {cardDetails.open && cardDetails.dialog && (
        <ResearchDetailsDialog
          subject={cardDetails.open.item}
          {...subjectText(cardDetails.open.item)}
          dialog={cardDetails.dialog}
          onOpenPDF={openPDF}
        />
      )}

      {/* PDF Modal: opened from a dialog, it mounts after it and so paints
          above it, and takes the keys while it is open. */}
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
  );
}
