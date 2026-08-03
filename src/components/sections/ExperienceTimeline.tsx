"use client";

import { workExperiences } from "@/data/portfolio";
import { FadeIn } from "@/components/ui/animated";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { DEFAULT_BLUR_PLACEHOLDER } from "@/lib/utils/blur-placeholder";
import {
  useColorExtraction,
  adjustColorBrightness,
} from "@/lib/hooks/useColorExtraction";
import { useTheme } from "@/components/ui/theme-provider";
import { useState, useEffect, useRef } from "react";
import {
  Calendar,
  MapPin,
  ExternalLink,
  Briefcase,
  GraduationCap,
  Rocket,
  ChevronRight,
  Building,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFormattedExperienceYears } from "@/lib/utils/experience-calculator";
import { motion, AnimatePresence } from "framer-motion";
import { useCardDeepLink } from "@/lib/hooks/useCardDeepLink";
import { CopyLinkButton } from "@/components/ui/copy-link-button";
import { HolographicStatsCard } from "@/components/ui/holographic-stats-card";
import { HolographicCard } from "@/components/ui/holographic-card";

interface ExperienceTimelineItemProps {
  experience: (typeof workExperiences.experience)[0];
  index: number;
  isLast: boolean;
  /** Arrived via a deep link: hold the glow and open the details. */
  isDeepLinked?: boolean;
  /** Briefly ring-pulse this card after a deep link lands on it. */
  isHighlighted?: boolean;
}

function getExperienceType(experience: (typeof workExperiences.experience)[0]) {
  const role = experience.role.toLowerCase();
  const company = experience.company.toLowerCase();

  if (
    role.includes("phd") ||
    role.includes("researcher") ||
    company.includes("university")
  ) {
    return {
      icon: GraduationCap,
      colorClass: "text-purple-600 dark:text-purple-400",
      bgClass: "bg-purple-600/10 dark:bg-purple-400/10",
      borderClass: "border-purple-600/30 dark:border-purple-400/30",
      label: "Academic",
    };
  }
  if (role.includes("founder") || role.includes("co-founder")) {
    return {
      icon: Rocket,
      colorClass: "text-emerald-600 dark:text-emerald-400",
      bgClass: "bg-emerald-600/10 dark:bg-emerald-400/10",
      borderClass: "border-emerald-600/30 dark:border-emerald-400/30",
      label: "Startup",
    };
  }
  if (role.includes("engineer") || role.includes("developer")) {
    return {
      icon: Briefcase,
      colorClass: "text-blue-600 dark:text-blue-400",
      bgClass: "bg-blue-600/10 dark:bg-blue-400/10",
      borderClass: "border-blue-600/30 dark:border-blue-400/30",
      label: "Engineering",
    };
  }
  return {
    icon: Building,
    colorClass: "text-slate-600 dark:text-slate-400",
    bgClass: "bg-slate-600/10 dark:bg-slate-400/10",
    borderClass: "border-slate-600/30 dark:border-slate-400/30",
    label: "Professional",
  };
}

function ExperienceTimelineItem({
  experience,
  index,
  isLast,
  isDeepLinked = false,
  isHighlighted = false,
}: ExperienceTimelineItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  // Arriving via a deep link opens the details.
  useEffect(() => {
    if (isDeepLinked) setIsExpanded(true);
  }, [isDeepLinked]);

  const { theme } = useTheme();
  const fallbackColor = "rgb(59, 130, 246)";
  const { color: baseColor } = useColorExtraction(
    experience.companyLogo,
    fallbackColor,
  );
  const experienceType = getExperienceType(experience);

  // Apply brightness adjustment for dark mode
  const extractedColor =
    theme === "dark" ? adjustColorBrightness(baseColor, 2.0) : baseColor;

  // Extract key achievements (first 2-3 bullet points)
  const keyAchievements = experience.descBullets
    .filter((bullet) => !bullet.includes("#"))
    .slice(0, 2);

  const hashtags = experience.descBullets.filter((bullet) =>
    bullet.includes("#"),
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    if (itemRef.current) {
      observer.observe(itemRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Entrance is gated on the IntersectionObserver. A deep link can land on a
  // card far down the page, so it must show regardless: scrolling the viewport
  // to something still at opacity 0 would look like a broken link. Every
  // entrance animation in this card reads this, not isVisible.
  const shown = isVisible || isDeepLinked;

  return (
    <div
      ref={itemRef}
      id={experience.anchorId}
      className={cn(
        "relative flex gap-4 sm:gap-6 transition-all duration-700",
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        isHighlighted && "deep-link-highlight",
      )}
    >
      {/* Timeline line and dot */}
      <div className="relative flex flex-col items-center">
        {/* Dot */}
        <motion.div
          initial={{ scale: 0 }}
          animate={shown ? { scale: 1 } : { scale: 0 }}
          transition={{ delay: index * 0.05, type: "spring", stiffness: 200 }}
          className="relative z-10"
        >
          {/* Company logo */}
          <div
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full p-0.5 bg-background border-2"
            style={{ borderColor: extractedColor }}
          >
            <div className="relative w-full h-full rounded-full overflow-hidden bg-white">
              <OptimizedImage
                src={experience.companyLogo}
                alt={`${experience.company} logo`}
                fill
                sizes="56px"
                className="object-contain p-1"
                crossOrigin="anonymous"
                placeholder="blur"
                blurDataURL={DEFAULT_BLUR_PLACEHOLDER}
                loading="lazy"
              />
            </div>
          </div>

          {/* Type indicator */}
          <div
            className={cn(
              "absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center",
              experienceType.bgClass,
              experienceType.borderClass,
              "border",
            )}
          >
            <experienceType.icon
              className={cn("w-3 h-3", experienceType.colorClass)}
            />
          </div>
        </motion.div>

        {/* Line */}
        {!isLast && (
          <div
            className="w-0.5 flex-1 -mt-2"
            style={{
              background: `linear-gradient(to bottom, ${extractedColor} 0%, transparent 100%)`,
            }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-8 sm:pb-12">
        <HolographicCard
          glowColor={extractedColor.replace("rgb(", "").replace(")", "")}
          insideBackgroundColor={extractedColor
            .replace("rgb(", "")
            .replace(")", "")}
          className="h-full cursor-pointer"
          forceHover={isDeepLinked}
          onMouseEnter={() => {}}
          onMouseLeave={() => {}}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={shown ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: index * 0.05 + 0.1 }}
            className="p-4 sm:p-6"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {/* Year and Type badges */}
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: `${extractedColor}20`,
                  color: extractedColor,
                  border: `1px solid ${extractedColor}40`,
                }}
              >
                {experience.date}
              </span>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1",
                  experienceType.bgClass,
                  experienceType.colorClass,
                  experienceType.borderClass,
                  "border",
                )}
              >
                <experienceType.icon className="w-3 h-3" />
                {experienceType.label}
              </span>
              {experience.anchorId && (
                <CopyLinkButton
                  anchorId={experience.anchorId}
                  label={`Copy link to ${experience.role} at ${experience.company}`}
                  className="ml-auto"
                />
              )}
            </div>

            {/* Role and Company */}
            <h3 className="text-lg sm:text-xl font-bold mb-1">
              {experience.role}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mb-3 text-sm text-muted-foreground">
              <span className="font-medium">{experience.company}</span>
              {experience.location && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {experience.location}
                  </span>
                </>
              )}
              {experience.companyUrl && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <a
                    href={experience.companyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                    style={{ color: extractedColor }}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Website
                  </a>
                </>
              )}
            </div>

            {/* Key achievements */}
            <div className="space-y-1.5 mb-3">
              {keyAchievements.map((achievement, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight
                    className="w-3 h-3 mt-0.5 flex-shrink-0"
                    style={{ color: extractedColor }}
                  />
                  <span className="text-muted-foreground">{achievement}</span>
                </div>
              ))}
            </div>

            {/* Expand button for more details */}
            {(experience.desc || hashtags.length > 0) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-sm font-medium transition-colors hover:underline flex items-center gap-1"
                style={{ color: extractedColor }}
                aria-label={
                  isExpanded ? "Show less details" : "Show more details"
                }
              >
                {isExpanded ? "Show less" : "View details"}
                <ChevronRight
                  className={cn(
                    "w-3 h-3 transition-transform",
                    isExpanded && "rotate-90",
                  )}
                />
              </button>
            )}

            {/* Expanded content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 space-y-3">
                    {experience.desc && (
                      <p className="text-sm text-muted-foreground">
                        {experience.desc}
                      </p>
                    )}

                    {/* Tech stack */}
                    {hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {hashtags.map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 text-xs rounded-full"
                            style={{
                              backgroundColor: `${extractedColor}20`,
                              color: extractedColor,
                              border: `1px solid ${extractedColor}30`,
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </HolographicCard>
      </div>
    </div>
  );
}

/** Roles shown before the reader has to ask for the rest. */
const COLLAPSED_COUNT = 5;

/**
 * The reveal control, built as a node ON the timeline rather than a button
 * under it, so the list reads as continuing rather than ending.
 *
 * Geometry deliberately matches ExperienceTimelineItem: same column, same
 * circle size as the company logos, so the node lands on the same vertical
 * axis as every dot above it.
 */
function TimelineRevealNode({
  hiddenCount,
  expanded,
  onToggle,
}: {
  hiddenCount: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative flex gap-4 sm:gap-6">
      <div className="relative flex flex-col items-center">
        {/* Dashed while collapsed: the timeline is interrupted, not finished.
            Solid once open, matching the connectors between real cards. */}
        <div
          className={cn(
            "w-0.5 h-6 -mt-2",
            expanded
              ? "bg-primary/30"
              : "bg-[linear-gradient(to_bottom,currentColor_50%,transparent_50%)] bg-[length:2px_8px] text-primary/40",
          )}
        />
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={
            expanded
              ? "Collapse earlier roles"
              : `Show ${hiddenCount} earlier roles`
          }
          className={cn(
            "relative z-10 w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-dashed",
            "flex items-center justify-center bg-background",
            "border-primary/40 text-primary hover:border-primary hover:bg-primary/5",
            "transition-colors",
          )}
        >
          {expanded ? (
            <ChevronRight className="w-5 h-5 -rotate-90" />
          ) : (
            <span className="text-sm font-semibold">+{hiddenCount}</span>
          )}
        </button>
      </div>

      <div className="flex-1 pb-8 sm:pb-12 flex items-center">
        <button
          onClick={onToggle}
          aria-hidden="true"
          tabIndex={-1}
          className="text-sm font-medium text-primary transition-colors hover:underline flex items-center gap-1"
        >
          {expanded
            ? "Show fewer roles"
            : `See all ${hiddenCount} earlier roles`}
          <ChevronRight
            className={cn(
              "w-3 h-3 transition-transform",
              expanded ? "-rotate-90" : "rotate-90",
            )}
          />
        </button>
      </div>
    </div>
  );
}

export function ExperienceTimeline() {
  // Above the display check on purpose: hooks cannot sit behind an early
  // return. The hook itself no-ops when the hash matches nothing.
  const { deepLinkedId, highlightedId } = useCardDeepLink(
    workExperiences.experience.flatMap((exp) =>
      exp.anchorId ? [exp.anchorId] : [],
    ),
  );
  const [showAll, setShowAll] = useState(false);

  // A deep link to a role behind the cutoff has to reveal it, or the hash
  // would resolve to nothing and the page would sit at the top. Only when the
  // target is genuinely hidden: linking to one of the first roles must leave
  // the list collapsed rather than dumping all eleven on the reader.
  useEffect(() => {
    if (!deepLinkedId) return;
    const target = workExperiences.experience.findIndex(
      (exp) => exp.anchorId === deepLinkedId,
    );
    if (target >= COLLAPSED_COUNT) setShowAll(true);
  }, [deepLinkedId]);

  if (!workExperiences.display) {
    return null;
  }

  const visibleExperiences = showAll
    ? workExperiences.experience
    : workExperiences.experience.slice(0, COLLAPSED_COUNT);
  const hiddenCount = workExperiences.experience.length - COLLAPSED_COUNT;

  const stats = {
    totalPositions: workExperiences.experience.length,
    yearsExperience: getFormattedExperienceYears(workExperiences.experience),
    companiesFounded: workExperiences.experience.filter((exp) =>
      exp.role.toLowerCase().includes("founder"),
    ).length,
    researchPositions: workExperiences.experience.filter(
      (exp) =>
        exp.role.toLowerCase().includes("researcher") ||
        exp.company.toLowerCase().includes("university"),
    ).length,
  };

  return (
    <div className="container mx-auto px-4 md:px-16 pt-20 pb-8 sm:pt-24 sm:pb-16 max-w-4xl relative">
      <FadeIn className="text-center mb-8 sm:mb-12">
        <h2 className="section-title-gradient">{workExperiences.title}</h2>
        <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">
          <span className="text-primary font-semibold">
            {workExperiences.subtitle.highlightedText}
          </span>
          {" • "}
          {workExperiences.subtitle.normalText}
        </p>
      </FadeIn>

      {/* Career stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-12">
        <HolographicStatsCard
          glowColor="59, 130, 246"
          insideBackgroundColor="59, 130, 246"
          delay={0.1}
        >
          <div className="flex flex-col items-center">
            <Briefcase className="w-5 h-5 text-blue-500 mb-2" />
            <div className="text-2xl sm:text-3xl font-bold text-blue-500 mb-0.5">
              {stats.totalPositions}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              Positions
            </div>
          </div>
        </HolographicStatsCard>

        <HolographicStatsCard
          glowColor="245, 158, 11"
          insideBackgroundColor="245, 158, 11"
          delay={0.15}
        >
          <div className="flex flex-col items-center">
            <Calendar className="w-5 h-5 text-amber-500 mb-2" />
            <div className="text-2xl sm:text-3xl font-bold text-amber-500 mb-0.5">
              {stats.yearsExperience}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              Years Experience
            </div>
          </div>
        </HolographicStatsCard>

        <HolographicStatsCard
          glowColor="34, 197, 94"
          insideBackgroundColor="34, 197, 94"
          delay={0.2}
        >
          <div className="flex flex-col items-center">
            <Rocket className="w-5 h-5 text-green-500 mb-2" />
            <div className="text-2xl sm:text-3xl font-bold text-green-500 mb-0.5">
              1
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              Founded Company
            </div>
          </div>
        </HolographicStatsCard>

        <HolographicStatsCard
          glowColor="139, 92, 246"
          insideBackgroundColor="139, 92, 246"
          delay={0.25}
        >
          <div className="flex flex-col items-center">
            <GraduationCap className="w-5 h-5 text-purple-500 mb-2" />
            <div className="text-2xl sm:text-3xl font-bold text-purple-500 mb-0.5">
              4
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              Academic Positions
            </div>
          </div>
        </HolographicStatsCard>
      </div>

      {/* Timeline */}
      <div className="relative">
        {visibleExperiences.map((exp, index) => (
          <ExperienceTimelineItem
            key={index}
            experience={exp}
            index={index}
            // Measured against what is actually rendered, not the full array.
            // Otherwise the fifth card keeps isLast false while collapsed and
            // trails its connector line into empty space.
            isLast={index === visibleExperiences.length - 1}
            isDeepLinked={!!exp.anchorId && deepLinkedId === exp.anchorId}
            isHighlighted={!!exp.anchorId && highlightedId === exp.anchorId}
          />
        ))}

        {hiddenCount > 0 && (
          <TimelineRevealNode
            hiddenCount={hiddenCount}
            expanded={showAll}
            onToggle={() => setShowAll((open) => !open)}
          />
        )}
      </div>
    </div>
  );
}
