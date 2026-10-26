"use client";

import { useId, useState, type CSSProperties } from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Award,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  Calendar,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { accentStyle } from "@/components/ui/accent-text";

interface Certification {
  name: string;
  issuer: string;
  year: string;
}

interface CertificationTimelineProps {
  certifications: Certification[];
  /** One icon for every badge, in place of the one picked from its name. */
  icon?: LucideIcon;
  /**
   * On phones, how many badges show, newest first, before "Show all": the
   * rest are a tap away. Wider screens show every badge, oldest first.
   */
  phoneCount?: number;
  /** What the badges are, for the button's name: "Show all 8 memberships". */
  itemsLabel?: string;
  className?: string;
}

// Each badge is drawn once, for every width. There were three copies, a
// desktop, a tablet and a phone one, two hidden by CSS: 524 elements in the
// two grids where 200 showed, each copy with its own entrance (2026-10-26).
// The issuer line wraps rather than ending in an ellipsis: a membership's
// body ("Association Suisse Alémanique & Friends") is wider than a badge.
// A badge fills its grid cell, so a row of them stays even, and a year
// range on the issuer line wraps whole, never after "2015-".

// On a phone the two grids stacked 15 badges, 1,038 px at 390 px wide, so a
// phone shows the newest few and "Show all", 440 px less (2026-10-26,
// Romain's choice). CSS `order` puts the newest first there; the folded
// badges stay in the HTML, hidden by `max-sm:hidden`, and layout.tsx's
// <noscript> style shows them, and hides the button, when scripts are off.

// The badges have no backdrop blur: their 3% tint lies over the section's
// plain background, where blurring changed 45 of 132,804 pixels in Chromium
// (by 13/255 at most) and none in WebKit. Their 21 filters, with the page's
// other backdrop filters, held Linux WebKit (Playwright 1.64) at 1 frame a
// second on the homepage; without them it draws 50.

// Get icon for certification based on name
const getCertIcon = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("surviving") || lowerName.includes("ph.d")) {
    return Sparkles;
  } else if (lowerName.includes("training") || lowerName.includes("students")) {
    return GraduationCap;
  } else if (
    lowerName.includes("entrepreneurship") ||
    lowerName.includes("inventor")
  ) {
    return ShieldCheck;
  } else if (lowerName.includes("writing") || lowerName.includes("academic")) {
    return Award;
  } else if (
    lowerName.includes("summer") ||
    lowerName.includes("winter") ||
    lowerName.includes("school")
  ) {
    return Calendar;
  }
  return Award;
};

// Get color based on certification type
const getCertColor = (cert: Certification) => {
  const yearStr = cert.year.toString();

  // Ongoing/present certifications
  if (yearStr.includes("present") || yearStr.includes("-")) {
    return "139, 92, 246"; // Purple for ongoing
  }

  // Try to extract the first year
  const yearMatch = yearStr.match(/\d{4}/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0]);
    if (year <= 2013) {
      return "59, 130, 246"; // Blue for early certifications
    } else if (year >= 2022) {
      return "34, 197, 94"; // Green for recent certifications
    }
  }

  return "107, 114, 128"; // Gray fallback
};

export function CertificationTimeline({
  certifications,
  icon,
  phoneCount,
  itemsLabel = "badges",
  className,
}: CertificationTimelineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  // Sort certifications by year
  const sortedCerts = [...certifications].sort((a, b) => {
    const getYear = (yearStr: string) => {
      const match = yearStr.match(/\d{4}/);
      return match ? parseInt(match[0]) : 9999;
    };
    return getYear(a.year) - getYear(b.year);
  });
  const total = sortedCerts.length;
  const folds = phoneCount !== undefined && phoneCount < total;

  return (
    <m.div
      className={cn("w-full", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      {/* One grid for every width: a column on phones, two from tablets, up
          to four on wide screens. */}
      <div
        id={listId}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3"
      >
        {sortedCerts.map((cert, index) => {
          const isHovered = hoveredIndex === index;
          const color = getCertColor(cert);
          const Icon = icon ?? getCertIcon(cert.name);
          // 0 for the newest: its place on a phone.
          const rank = total - 1 - index;
          const folded = folds && !expanded && rank >= phoneCount;

          return (
            <m.div
              key={index}
              className={cn(
                "relative max-sm:order-(--rank)",
                folded && "max-sm:hidden",
              )}
              style={{ "--rank": rank } as CSSProperties}
              data-fold={folded ? "" : undefined}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              // A mouse alone lights a badge: phones fire mouse events on a
              // tap, which left the tapped badge lit until the next tap.
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setHoveredIndex(index);
              }}
              onPointerLeave={() => setHoveredIndex(null)}
            >
              {/* Badge */}
              <m.div
                className={cn(
                  "relative h-full px-3 py-2.5 rounded-lg border transition-all duration-300",
                  "cursor-default overflow-hidden",
                  "flex items-center gap-3 sm:gap-2",
                )}
                style={{
                  backgroundColor: `rgba(${color}, ${isHovered ? 0.08 : 0.03})`,
                  borderColor: `rgba(${color}, ${isHovered ? 0.4 : 0.2})`,
                }}
                whileHover={{ scale: 1.02 }}
              >
                {/* Background gradient effect */}
                <m.div
                  className="absolute inset-0 opacity-0"
                  style={{
                    background: `linear-gradient(135deg, transparent, rgba(${color}, 0.1))`,
                  }}
                  animate={{
                    opacity: isHovered ? 1 : 0,
                  }}
                  transition={{ duration: 0.3 }}
                />

                {/* Icon: a size smaller on tablets */}
                <div
                  className="relative z-10 shrink-0 w-8 h-8 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: `rgba(${color}, 0.1)`,
                  }}
                >
                  <Icon
                    size={14}
                    className="sm:size-3 md:size-3.5"
                    style={{
                      color: `rgb(${color})`,
                    }}
                  />
                </div>

                {/* Content: below tablets' md the year follows the issuer;
                    from md it has a line of its own, in the badge's color. */}
                <div className="relative z-10 flex-1 min-w-0">
                  <div
                    className={cn(
                      "text-sm sm:text-xs font-medium sm:truncate transition-colors",
                      isHovered
                        ? "text-foreground"
                        : "text-foreground/80 md:text-foreground/70",
                    )}
                  >
                    {cert.name}
                  </div>
                  <div className="text-xs sm:text-[10px] sm:leading-normal text-muted-foreground break-words">
                    {cert.issuer}
                    <span className="md:hidden">
                      {" "}
                      <span className="whitespace-nowrap">• {cert.year}</span>
                    </span>
                  </div>
                  <div
                    className="hidden md:block text-[9px] font-medium mt-0.5 accent-text"
                    style={accentStyle(`rgb(${color})`)}
                  >
                    {cert.year}
                  </div>
                </div>

                {/* Hover glow effect */}
                {isHovered && (
                  <m.div
                    className="absolute inset-0 pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div
                      className="absolute inset-0 blur-xl"
                      style={{
                        background: `radial-gradient(circle at center, rgba(${color}, 0.15), transparent)`,
                      }}
                    />
                  </m.div>
                )}
              </m.div>
            </m.div>
          );
        })}
      </div>
      {folds && (
        <div data-fold-toggle className="mt-3 flex justify-center sm:hidden">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-label={
              expanded
                ? `Show fewer ${itemsLabel}`
                : `Show all ${total} ${itemsLabel}`
            }
            onClick={() => setExpanded((open) => !open)}
            className="inline-flex min-h-10 items-center gap-1 px-3 text-sm font-medium text-primary hover:underline"
          >
            {expanded ? "Show fewer" : `Show all ${total}`}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-4 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>
        </div>
      )}
    </m.div>
  );
}
