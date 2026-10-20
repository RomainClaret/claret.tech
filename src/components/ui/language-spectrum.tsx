"use client";

import { useState } from "react";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";

interface Language {
  language: string;
  proficiency: string;
  flag: string;
}

interface LanguageSpectrumProps {
  languages: Language[];
  className?: string;
}

export function LanguageSpectrum({
  languages,
  className,
}: LanguageSpectrumProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <m.div
      className={cn("w-full max-w-2xl mx-auto", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      {/* Subtle inline badges */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {languages.map((lang, index) => {
          const isHovered = hoveredIndex === index;

          return (
            <m.div
              key={lang.language}
              // Focusable: the proficiency shows on focus or a tap, as on
              // hover, which alone kept it from keyboards and touch screens.
              tabIndex={0}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md",
                "text-xs font-medium transition-all duration-200 cursor-default",
                "border",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                isHovered
                  ? "bg-muted/50 border-muted-foreground/20 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              onFocus={() => setHoveredIndex(index)}
              onBlur={() => setHoveredIndex(null)}
            >
              <span className="text-sm" aria-hidden="true">
                {lang.flag}
              </span>
              <span>{lang.language}</span>
              {/* Always there for a screen reader; shown when pointed at. */}
              {!isHovered && (
                <span className="sr-only">({lang.proficiency})</span>
              )}
              {isHovered && (
                <m.span
                  className="text-[10px] ml-1"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  ({lang.proficiency})
                </m.span>
              )}
            </m.div>
          );
        })}
      </div>
    </m.div>
  );
}
