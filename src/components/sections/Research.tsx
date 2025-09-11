"use client";

import { researchSection } from "@/data/sections/research";
import { FadeIn, SlideInUp, ScaleIn } from "@/components/ui/animated";
import Link from "next/link";
import {
  ExternalLink,
  GitBranch,
  Beaker,
  CheckCircle2,
  Clock,
  Zap,
  FileText,
  Trophy,
  Brain,
  Calendar,
  Award,
  Sparkles,
  Shield,
  Bot,
  Ear,
  ChevronDown,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { getFormattedResearchYears } from "@/lib/utils/experience-calculator";
import { HolographicCard } from "@/components/ui/holographic-card";
import { HolographicStatsCard } from "@/components/ui/holographic-stats-card";
import { motion, AnimatePresence } from "framer-motion";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";

interface ResearchCardProps {
  project: (typeof researchSection.projects)[0];
  index: number;
  isActive: boolean;
  onToggle: () => void;
  isLeftSide?: boolean;
}

const statusConfig = {
  active: {
    icon: Zap,
    text: "Active Research",
    color: "text-green-500",
    bgColor: "bg-green-500/20",
    borderColor: "border-green-500/30",
    glowColor: "shadow-green-500/25",
    rgbColor: "34, 197, 94",
  },
  ongoing: {
    icon: Clock,
    text: "Ongoing",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/20",
    borderColor: "border-yellow-500/30",
    glowColor: "shadow-yellow-500/25",
    rgbColor: "250, 204, 21",
  },
  completed: {
    icon: CheckCircle2,
    text: "Completed",
    color: "text-blue-500",
    bgColor: "bg-blue-500/20",
    borderColor: "border-blue-500/30",
    glowColor: "shadow-blue-500/25",
    rgbColor: "59, 130, 246",
  },
};

// Icon mapping for all icons
const iconMap = {
  Brain: Brain,
  Bot: Bot,
  Shield: Shield,
  Ear: Ear,
  Beaker: Beaker,
  Zap: Zap,
  Sparkles: Sparkles,
};

function ResearchCard({
  project,
  index: _index,
  isActive,
  onToggle,
  isLeftSide = false,
}: ResearchCardProps) {
  const status = statusConfig[project.status];
  const Icon = project.icon
    ? iconMap[project.icon as keyof typeof iconMap] || Beaker
    : Beaker;
  const year = project.year;
  const nodeColor = project.color || "139, 92, 246";

  return (
    <motion.div
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

      <div onClick={onToggle} className="h-full cursor-pointer">
        <HolographicCard glowColor={nodeColor} className="h-full">
          <div className="p-4 sm:p-6">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="relative">
                <motion.div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `rgba(${nodeColor}, 0.1)` }}
                  whileHover={{ scale: 1.1 }}
                >
                  <Icon
                    className="w-6 h-6"
                    style={{ color: `rgb(${nodeColor})` }}
                  />
                </motion.div>
                {/* Gentle breathing effect */}
                <motion.div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    backgroundColor: `rgb(${nodeColor})`,
                    opacity: 0.1,
                    willChange: "transform",
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
                <h3 className="text-base sm:text-lg font-bold mb-1 bg-gradient-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300">
                  {project.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                  {project.subtitle}
                </p>
                {project.shortDescription && (
                  <p className="text-xs text-muted-foreground/80 line-clamp-3">
                    {project.shortDescription}
                  </p>
                )}
              </div>
            </div>

            {/* Status Badge */}
            <div className="mb-3">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `rgba(${status.rgbColor}, 0.1)`,
                  color: `rgb(${status.rgbColor})`,
                  border: `1px solid rgba(${status.rgbColor}, 0.3)`,
                }}
              >
                <status.icon className="w-3 h-3" />
                {status.text}
              </span>
            </div>

            {/* Expandable Content */}
            <AnimatePresence>
              {isActive && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 border-t border-border mt-4">
                    {/* Full Description */}
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                      {project.description}
                    </p>

                    {/* Highlights Section */}
                    {project.highlights && project.highlights.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-primary" />
                          Key Contributions
                        </h4>
                        <div className="grid gap-2">
                          {project.highlights.map((highlight, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-sm"
                            >
                              <Sparkles className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                              <span className="text-muted-foreground">
                                {highlight}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tags Section */}
                    {project.tags && project.tags.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Award className="w-4 h-4 text-primary" />
                          Technologies & Methods
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {project.tags.map((tag, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 text-xs font-medium rounded-lg transition-all hover:scale-105"
                              style={{
                                backgroundColor: `rgba(${nodeColor}, 0.1)`,
                                color: `rgb(${nodeColor})`,
                                border: `1px solid rgba(${nodeColor}, 0.3)`,
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Links Section */}
                    {project.links && project.links.length > 0 && (
                      <div className="pt-4 border-t border-border">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          Resources & Publications
                        </h4>
                        <div className="flex flex-wrap gap-3">
                          {project.links.map((link, i) => (
                            <Link
                              key={i}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline transition-colors font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {link.name.includes("GitHub") ? (
                                <GitBranch className="w-4 h-4" />
                              ) : (
                                <ExternalLink className="w-4 h-4" />
                              )}
                              {link.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick Stats / Expand Toggle */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-4">
              {!isActive && project.links && (
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {project.links.length}{" "}
                  {project.links.length === 1 ? "Resource" : "Resources"}
                </span>
              )}
              {!isActive && project.highlights && (
                <span className="flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  {project.highlights.length} Achievements
                </span>
              )}
              <span className="flex items-center gap-1 ml-auto text-primary cursor-pointer">
                {isActive ? "Click to collapse" : "Click to expand"}
                <ChevronDown
                  className={cn(
                    "w-3 h-3 transition-transform duration-300",
                    isActive && "rotate-180",
                  )}
                />
              </span>
            </div>
          </div>
        </HolographicCard>
      </div>
    </motion.div>
  );
}

export function Research() {
  const shouldReduceAnimations = useShouldReduceAnimations();
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isJourneyExpanded, setIsJourneyExpanded] = useState(false);
  const [isPhdExpanded, setIsPhdExpanded] = useState(false);

  if (!researchSection.display) {
    return null;
  }

  const stats = {
    totalProjects: researchSection.projects.length,
    activeProjects: researchSection.projects.filter(
      (p) => p.status === "active",
    ).length,
    yearsOfResearch: getFormattedResearchYears(researchSection.projects),
    researchAreas: 4, // Neuroevolution, Conversational AI, Decentralization, Neuroscience
    technologies: new Set(researchSection.projects.flatMap((p) => p.tags)).size,
  };

  return (
    <div className="container mx-auto px-4 md:px-16 pt-20 pb-8 sm:pt-24 sm:pb-16 max-w-7xl relative">
      <div className="lg:px-8">
        {/* Header */}
        <FadeIn className="text-center mb-6 sm:mb-8">
          <h2 className="section-title-gradient">{researchSection.title}</h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-4xl mx-auto">
            <span className="text-primary font-semibold">
              {researchSection.subtitle.highlightedText}
            </span>
            {""}
            {researchSection.subtitle.normalText}
          </p>
        </FadeIn>

        {/* Research Journey - Expandable Description */}
        {researchSection.journeyDescription && (
          <SlideInUp delay={100} className="mb-8 sm:mb-12">
            <motion.div
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
                className="bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-yellow-500/5 backdrop-blur-sm"
              >
                <div className="p-6 sm:p-8 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <motion.div
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
                      </motion.div>
                      <motion.div
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{
                          backgroundColor: "rgb(245, 158, 11)",
                          opacity: 0.1,
                        }}
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    </div>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold mb-4 bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
                    My Research Journey
                  </h3>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={isJourneyExpanded ? "full" : "short"}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl mx-auto">
                        {isJourneyExpanded
                          ? researchSection.journeyDescription
                          : researchSection.journeyShortDescription}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  <div className="flex justify-center mt-6">
                    <motion.button
                      onClick={() => setIsJourneyExpanded(!isJourneyExpanded)}
                      className="group flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-300"
                      style={{
                        borderColor: "rgba(245, 158, 11, 0.3)",
                        backgroundColor: isJourneyExpanded
                          ? "rgba(245, 158, 11, 0.1)"
                          : "transparent",
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span
                        className="text-sm font-medium"
                        style={{ color: "rgb(245, 158, 11)" }}
                      >
                        {isJourneyExpanded ? "Show less" : "Read full story"}
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 transition-transform duration-300",
                          isJourneyExpanded && "rotate-180",
                        )}
                        style={{ color: "rgb(245, 158, 11)" }}
                      />
                    </motion.button>
                  </div>
                </div>
              </HolographicCard>
            </motion.div>
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
              <div className="text-2xl sm:text-3xl font-bold text-green-500 mb-0.5 sm:mb-1">
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
              <div className="text-2xl sm:text-3xl font-bold text-amber-500 mb-0.5 sm:mb-1">
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
              <div className="text-2xl sm:text-3xl font-bold text-purple-500 mb-0.5 sm:mb-1">
                {stats.researchAreas}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                Research Areas
              </div>
            </div>
          </HolographicStatsCard>
        </div>

        {/* PhD Research Hero Feature - Standalone */}
        <SlideInUp delay={200} className="mb-8 sm:mb-16 relative z-10">
          <motion.div
            className="relative"
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
                  {researchSection.projects[0].year && (
                    <>
                      <div className="w-px h-4 bg-border" />
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3 opacity-70" />
                        {researchSection.projects[0].year}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Neural glow effect for hero */}
            <motion.div
              className="absolute -inset-1 rounded-2xl opacity-0 blur-xl"
              style={{
                backgroundColor: `rgb(${researchSection.projects[0].color || "139, 92, 246"})`,
              }}
              initial={{ opacity: 0.3 }}
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
            />

            <HolographicCard
              glowColor={researchSection.projects[0].color || "139, 92, 246"}
              className="bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5 backdrop-blur-sm overflow-visible"
            >
              <div className="p-6 sm:p-8 overflow-visible">
                <div className="text-center mb-4 sm:mb-6">
                  <h3 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                    {researchSection.projects[0].title}
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground mb-2">
                    {researchSection.projects[0].subtitle}
                  </p>
                </div>

                {/* Expandable Description with Toggle */}
                <div className="text-center mb-6 sm:mb-8 max-w-3xl mx-auto">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={isPhdExpanded ? "full" : "short"}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <p className="text-sm sm:text-base text-muted-foreground">
                        {isPhdExpanded
                          ? researchSection.projects[0].description
                          : researchSection.projects[0].shortDescription}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  {/* Toggle Button */}
                  <div className="flex justify-center mt-4">
                    <motion.button
                      onClick={() => setIsPhdExpanded(!isPhdExpanded)}
                      className="group flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-300"
                      style={{
                        borderColor: `rgba(${researchSection.projects[0].color || "139, 92, 246"}, 0.3)`,
                        backgroundColor: isPhdExpanded
                          ? `rgba(${researchSection.projects[0].color || "139, 92, 246"}, 0.1)`
                          : "transparent",
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span
                        className="text-xs font-medium"
                        style={{
                          color: `rgb(${researchSection.projects[0].color || "139, 92, 246"})`,
                        }}
                      >
                        {isPhdExpanded ? "Show less" : "Read full description"}
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-3 h-3 transition-transform duration-300",
                          isPhdExpanded && "rotate-180",
                        )}
                        style={{
                          color: `rgb(${researchSection.projects[0].color || "139, 92, 246"})`,
                        }}
                      />
                    </motion.button>
                  </div>
                </div>

                {/* Visual Representation */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8 relative">
                  {researchSection.projects[0].highlights?.map(
                    (highlight, i) => {
                      const iconName =
                        researchSection.highlightIcons?.[i] || "Brain";
                      const Icon =
                        iconMap[iconName as keyof typeof iconMap] || Brain;
                      const expandedDescriptions =
                        researchSection.projects[0]
                          .expandedHighlightDescriptions || [];

                      return (
                        <ScaleIn key={i} delay={300 + i * 50}>
                          <motion.div
                            className="group relative bg-card/50 backdrop-blur-sm rounded-lg p-3 sm:p-4 text-center border border-primary/20 hover:border-primary/50 transition-all hover:shadow-lg min-h-[140px] sm:min-h-[160px] flex flex-col justify-between"
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
                                  color: `rgb(${researchSection.projects[0].color || "139, 92, 246"})`,
                                }}
                              />
                              <p className="text-lg sm:text-xl font-bold mb-1">
                                {researchSection.highlightLabels[i] ||
                                  highlight}
                              </p>
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
                              {highlight}
                            </p>

                            {/* Hover tooltip with expanded description */}
                            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-[60] w-64 group">
                              <div className="bg-popover text-popover-foreground rounded-lg shadow-xl border p-3">
                                <p className="text-xs leading-relaxed">
                                  {expandedDescriptions[i]}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        </ScaleIn>
                      );
                    },
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center mb-4 sm:mb-6">
                  {researchSection.projects[0].tags.map((tag, i) => (
                    <span
                      key={i}
                      className="px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-medium rounded-lg"
                      style={{
                        backgroundColor: `rgba(${researchSection.projects[0].color || "139, 92, 246"}, 0.1)`,
                        color: `rgb(${researchSection.projects[0].color || "139, 92, 246"})`,
                        border: `1px solid rgba(${researchSection.projects[0].color || "139, 92, 246"}, 0.3)`,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {researchSection.projects[0].links && (
                  <div className="flex justify-center gap-4">
                    {researchSection.projects[0].links.map((link, i) => {
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

                      return (
                        <Link
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all hover:scale-105 hover:shadow-lg"
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
          </motion.div>
        </SlideInUp>

        {/* Timeline Container for Other Research Projects */}
        <div className="relative">
          {/* Unified Timeline for Desktop - single continuous element */}
          <div className="absolute left-1/2 -top-8 sm:-top-16 bottom-0 w-0.5 -translate-x-1/2 hidden md:block -z-10">
            {/* Continuous gradient from Current Focus to end */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/20 to-transparent" />
            {/* Subtle pulse animation for visual continuity */}
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-b from-primary/40 via-primary/25 to-transparent opacity-50",
                !shouldReduceAnimations && "animate-pulse",
              )}
            />
          </div>

          {/* Mobile Timeline - simplified single element */}
          <div className="absolute left-1/2 -top-8 sm:-top-16 bottom-0 w-0.5 -translate-x-1/2 md:hidden -z-10">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/25 via-primary/15 to-transparent" />
          </div>

          {/* Other Research Projects Grid */}
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6 relative z-10">
            {researchSection.projects.slice(1).map((project, index) => (
              <SlideInUp key={index + 1} delay={300 + index * 100}>
                <ResearchCard
                  project={project}
                  index={index + 1}
                  isActive={activeIndex === index + 1}
                  onToggle={() =>
                    setActiveIndex(activeIndex === index + 1 ? -1 : index + 1)
                  }
                  isLeftSide={index % 2 === 0}
                />
              </SlideInUp>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
