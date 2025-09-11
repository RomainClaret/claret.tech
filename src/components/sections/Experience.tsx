"use client";

import { workExperiences } from "@/data/portfolio";
import { SlideInUp } from "@/components/ui/animated";
import Image from "next/image";
import { DEFAULT_BLUR_PLACEHOLDER } from "@/lib/utils/blur-placeholder";
import {
  useColorExtraction,
  adjustColorBrightness,
} from "@/lib/hooks/useColorExtraction";
import { useTheme } from "@/components/ui/theme-provider";
import { useState, useRef, useEffect, memo } from "react";
import {
  ChevronDown,
  Calendar,
  MapPin,
  ExternalLink,
  GraduationCap,
  Rocket,
  Briefcase,
  Building,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFormattedExperienceYears } from "@/lib/utils/experience-calculator";

interface ExperienceCardProps {
  experience: (typeof workExperiences.experience)[0];
  index: number;
  animationDelay: number;
}

// Experience type detection (same as in ExperienceTimeline)
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
      label: "Research",
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

const ExperienceCard = memo(function ExperienceCard({
  experience,
  index: _index,
  animationDelay,
}: ExperienceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const experienceType = getExperienceType(experience);

  // Use dynamic color extraction with fallback color
  const fallbackColor = "rgb(59, 130, 246)";
  const { color: baseColor } = useColorExtraction(
    experience.companyLogo,
    fallbackColor,
  );

  // Apply brightness adjustment for dark mode
  const extractedColor =
    theme === "dark" ? adjustColorBrightness(baseColor, 2.0) : baseColor;

  // Create color variations
  const darkColor = adjustColorBrightness(extractedColor, 0.7);
  const lightColor = adjustColorBrightness(extractedColor, 0.15);
  const ultraLightColor = adjustColorBrightness(extractedColor, 0.05);

  // Extract hashtags and other bullets from descBullets
  const hashtags = experience.descBullets.filter((bullet) =>
    bullet.includes("#"),
  );
  const otherBullets = experience.descBullets.filter(
    (bullet) => !bullet.includes("#"),
  );

  // Intersection Observer for scroll animations
  useEffect(() => {
    if (cardRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              setIsVisible(true);
            }, animationDelay);
            observer.disconnect();
          }
        },
        {
          threshold: 0.1,
          rootMargin: "50px",
        },
      );
      observer.observe(cardRef.current);
      return () => observer.disconnect();
    }
  }, [animationDelay]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "experience-card-wrapper h-full",
        "transition-all duration-700 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
      )}
    >
      <article
        className={cn(
          "group relative rounded-2xl overflow-hidden h-full flex flex-col",
          "transform transition-all duration-500",
          "hover:scale-[1.02] hover:-translate-y-1",
          "shadow-lg hover:shadow-2xl",
          // Glassmorphism effect
          "bg-card dark:bg-card/80 backdrop-blur-sm",
          "border border-border",
          // Accessibility
          "focus-within:ring-2 focus-within:ring-offset-2",
        )}
        style={
          {
            "--tw-ring-color": extractedColor,
          } as React.CSSProperties
        }
        aria-label={`${experience.role} at ${experience.company}`}
      >
        {/* Colored Header Banner */}
        <div
          className="relative h-20 sm:h-44 overflow-hidden flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${extractedColor} 0%, ${darkColor} 100%)`,
          }}
        >
          {/* Blurred background effect */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(circle at 30% 50%, ${lightColor} 0%, transparent 50%)`,
              filter: "blur(40px)",
            }}
          />

          {/* Company name */}
          <div className="relative z-10 h-full flex items-center justify-center px-2 sm:px-4 md:px-6">
            <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white text-center">
              {experience.company}
            </h3>
          </div>
        </div>

        {/* Experience Type Badge - Top Right */}
        <div className="absolute top-3 right-3 z-20">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium",
              experienceType.bgClass,
              experienceType.colorClass,
              experienceType.borderClass,
              "border",
            )}
          >
            <experienceType.icon className="w-3.5 h-3.5" />
            {experienceType.label}
          </span>
        </div>

        {/* Company Logo - Overlapping banner and content */}
        <div className="absolute left-1/2 -translate-x-1/2 top-14 sm:top-32 z-20">
          <div className="relative group/logo">
            {/* Logo glow effect */}
            <div
              className="absolute -inset-3 rounded-full opacity-0 group-hover/logo:opacity-40 blur-xl transition-all duration-500"
              style={{ backgroundColor: extractedColor }}
            />

            {/* Logo container with color extraction */}
            <div
              className="relative w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-background rounded-full p-1.5 sm:p-2 shadow-xl"
              style={{
                border: `4px solid ${extractedColor}`,
                boxShadow: `0 10px 25px -5px ${extractedColor}40, 0 8px 10px -6px ${extractedColor}20`,
              }}
            >
              <div className="relative w-full h-full rounded-full overflow-hidden bg-white">
                <Image
                  src={experience.companyLogo}
                  alt={`${experience.company} logo`}
                  fill
                  sizes="96px"
                  className="object-contain p-0.5 sm:p-1"
                  crossOrigin="anonymous"
                  placeholder="blur"
                  blurDataURL={DEFAULT_BLUR_PLACEHOLDER}
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="pt-8 sm:pt-14 md:pt-16 pb-4 sm:pb-6 px-4 sm:px-6 flex-1 flex flex-col">
          {/* Role - Hidden on mobile, shown on larger screens */}
          <h4 className="hidden sm:block text-xl md:text-2xl font-bold text-center mb-2">
            {experience.role}
          </h4>

          {/* Meta information - Hidden on mobile, shown on larger screens */}
          <div className="hidden sm:flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-4">
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: ultraLightColor,
                border: `1px solid ${lightColor}`,
              }}
            >
              <Calendar
                className="w-3.5 h-3.5"
                style={{ color: extractedColor }}
              />
              <span style={{ color: darkColor }}>{experience.date}</span>
            </div>
            {experience.location && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-center">{experience.location}</span>
              </div>
            )}
            {experience.companyUrl && (
              <a
                href={experience.companyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-primary transition-colors"
                style={{ color: extractedColor }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Website</span>
              </a>
            )}
          </div>

          {/* Company description - Hidden on mobile, shown on larger screens */}
          <p className="hidden sm:block text-sm text-muted-foreground text-center mb-4 italic">
            {experience.companyDesc}
          </p>

          {/* Expandable content */}
          {(experience.desc ||
            otherBullets.length > 0 ||
            hashtags.length > 0 ||
            experience.role) && (
            <>
              <div
                className={cn(
                  "overflow-hidden transition-all duration-500",
                  isExpanded ? "max-h-[800px]" : "max-h-0",
                )}
              >
                {/* Mobile only: Role, Meta info, and Company description */}
                <div className="sm:hidden">
                  {/* Role */}
                  <h4 className="text-xl font-bold text-center mb-2">
                    {experience.role}
                  </h4>

                  {/* Meta information */}
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-4">
                    <div
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: ultraLightColor,
                        border: `1px solid ${lightColor}`,
                      }}
                    >
                      <Calendar
                        className="w-3.5 h-3.5"
                        style={{ color: extractedColor }}
                      />
                      <span style={{ color: darkColor }}>
                        {experience.date}
                      </span>
                    </div>
                    {experience.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="text-center">
                          {experience.location}
                        </span>
                      </div>
                    )}
                    {experience.companyUrl && (
                      <a
                        href={experience.companyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                        style={{ color: extractedColor }}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Website</span>
                      </a>
                    )}
                  </div>

                  {/* Company description */}
                  <p className="text-sm text-muted-foreground text-center mb-4 italic">
                    {experience.companyDesc}
                  </p>
                </div>

                {/* Main description */}
                {experience.desc && (
                  <p className="text-sm leading-relaxed mb-4">
                    {experience.desc}
                  </p>
                )}

                {/* Additional bullet points */}
                {otherBullets.length > 0 && (
                  <ul className="space-y-2 mb-4">
                    {otherBullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span
                          className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: extractedColor }}
                        />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Tech stack tags */}
                {hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {hashtags.map((tag, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 text-xs rounded-full transition-all duration-300 hover:scale-105"
                        style={{
                          backgroundColor: ultraLightColor,
                          color: darkColor,
                          border: `1px solid ${lightColor}`,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Expand/Collapse button - Show immediately on mobile */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors mx-auto hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-md px-2 py-1",
                  "sm:mt-4", // Only add margin-top on larger screens
                )}
                style={{
                  color: extractedColor,
                }}
                aria-expanded={isExpanded}
                aria-label={
                  isExpanded ? "Show less details" : "Show more details"
                }
              >
                <span>{isExpanded ? "Show less" : "Show more"}</span>
                <ChevronDown
                  className={cn(
                    "w-4 h-4 transition-transform duration-300",
                    isExpanded && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </button>
            </>
          )}
        </div>
      </article>
    </div>
  );
});

// Function to calculate optimal columns to avoid single-item rows
function getOptimalColumns(totalCards: number, screenWidth: number): number {
  // Define breakpoints and constraints
  if (screenWidth < 640) return 2; // Mobile - 2 columns for better space usage
  if (screenWidth < 1024) return 3; // iPad/Tablet - 3 columns as requested

  // For larger screens (desktop), use 4 columns
  const minCardWidth = 280;
  const maxCardWidth = 320;
  const containerPadding = 32;
  const gap = 32;

  // Calculate max possible columns based on screen width
  const availableWidth = screenWidth - containerPadding * 2;
  const maxColumns = Math.floor((availableWidth + gap) / (minCardWidth + gap));

  // For desktop, prefer 4 columns
  const desiredColumns = 4;

  // Check if 4 columns fit with reasonable card width
  const cardWidth =
    (availableWidth - (desiredColumns - 1) * gap) / desiredColumns;

  if (
    cardWidth >= minCardWidth &&
    cardWidth <= maxCardWidth &&
    maxColumns >= desiredColumns
  ) {
    return desiredColumns;
  }

  // If 4 columns don't fit well, find optimal column count
  const candidates = [];

  for (let cols = Math.min(maxColumns, 5); cols >= 3; cols--) {
    const lastRowItems = totalCards % cols;
    const colCardWidth = (availableWidth - (cols - 1) * gap) / cols;

    if (colCardWidth < minCardWidth || colCardWidth > maxCardWidth) continue;

    // Perfect distribution or at least 2 items in last row
    if (lastRowItems === 0 || lastRowItems > 1) {
      candidates.push({
        columns: cols,
        score: lastRowItems === 0 ? 100 : 50 - Math.abs(cols - lastRowItems),
      });
    }
  }

  // Sort by score and return best option
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].columns;
  }

  // Fallback to 3 columns if no good option found
  return 3;
}

export function Experience() {
  const [columns, setColumns] = useState(1);
  const [isMounted, setIsMounted] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);

  useEffect(() => {
    setIsMounted(true);

    const calculateColumns = () => {
      const width = window.innerWidth;
      setWindowWidth(width);
      const optimal = getOptimalColumns(
        workExperiences.experience.length,
        width,
      );
      setColumns(optimal);
    };

    calculateColumns();
    window.addEventListener("resize", calculateColumns);
    return () => window.removeEventListener("resize", calculateColumns);
  }, []);

  if (!workExperiences.display) {
    return null;
  }

  // Calculate animation delays for staggered appearance
  const getAnimationDelay = (index: number): number => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    return row * 50 + col * 30;
  };

  return (
    <div className="container mx-auto px-4 md:px-16 pt-20 pb-8 sm:pt-24 sm:pb-16 max-w-7xl relative">
      <SlideInUp className="text-center mb-8 sm:mb-16">
        <h2 className="section-title-gradient">{workExperiences.title}</h2>
        <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto">
          <span className="text-primary font-semibold">
            {workExperiences.subtitle.highlightedText}
          </span>
          {""}
          {workExperiences.subtitle.normalText}
        </p>
      </SlideInUp>

      {/* Smart Flexbox Container for proper last row centering */}
      <div
        className="flex flex-wrap justify-center gap-2 sm:gap-4 md:gap-8 lg:px-8"
        style={{
          maxWidth: "100%",
        }}
      >
        {workExperiences.experience.map((exp, index) => {
          const gap = windowWidth < 640 ? 8 : windowWidth < 768 ? 16 : 32;
          return (
            <div
              key={index}
              style={{
                flex: isMounted
                  ? `0 0 calc(${100 / columns}% - ${(gap * (columns - 1)) / columns}px)`
                  : "0 0 100%",
                maxWidth: windowWidth < 640 ? "none" : "320px",
              }}
            >
              <ExperienceCard
                experience={exp}
                index={index}
                animationDelay={getAnimationDelay(index)}
              />
            </div>
          );
        })}
      </div>

      {/* Career summary stats */}
      <SlideInUp delay={600} className="mt-16 text-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-4 md:gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span
              className="font-semibold"
              style={{ color: "rgb(14, 165, 233)" }}
            >
              {workExperiences.experience.length}
            </span>
            <span>Positions</span>
          </div>
          <div className="hidden md:block w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <span
              className="font-semibold"
              style={{ color: "rgb(245, 158, 11)" }}
            >
              {getFormattedExperienceYears(workExperiences.experience)}
            </span>
            <span>Years Experience</span>
          </div>
          <div className="hidden md:block w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <span
              className="font-semibold"
              style={{ color: "rgb(16, 185, 129)" }}
            >
              1
            </span>
            <span>Founded Company</span>
          </div>
        </div>
      </SlideInUp>

      {/* Add shimmer keyframe animation */}
      <style jsx global>{`
        @keyframes shimmer {
          to {
            transform: translateX(200%);
          }
        }
      `}</style>
    </div>
  );
}
