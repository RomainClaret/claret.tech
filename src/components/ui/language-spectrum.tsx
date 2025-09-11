"use client";

import { useState } from "react";
import { motion } from "framer-motion";
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
    <motion.div
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
            <motion.div
              key={lang.language}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md",
                "text-xs font-medium transition-all duration-200 cursor-default",
                "border border-transparent",
                isHovered
                  ? "bg-muted/50 border-muted-foreground/20 text-foreground"
                  : "text-muted-foreground/70 hover:text-muted-foreground",
              )}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span className="text-sm opacity-80">{lang.flag}</span>
              <span>{lang.language}</span>
              {isHovered && (
                <motion.span
                  className="text-[10px] opacity-60 ml-1"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  ({lang.proficiency})
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
