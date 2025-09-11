"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Award,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  Calendar,
} from "lucide-react";

interface Certification {
  name: string;
  issuer: string;
  year: string;
}

interface CertificationTimelineProps {
  certifications: Certification[];
  className?: string;
}

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
  className,
}: CertificationTimelineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Sort certifications by year
  const sortedCerts = [...certifications].sort((a, b) => {
    const getYear = (yearStr: string) => {
      const match = yearStr.match(/\d{4}/);
      return match ? parseInt(match[0]) : 9999;
    };
    return getYear(a.year) - getYear(b.year);
  });

  return (
    <motion.div
      className={cn("w-full", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
    >
      {/* Desktop: Badge Grid */}
      <div className="hidden md:block">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sortedCerts.map((cert, index) => {
            const isHovered = hoveredIndex === index;
            const color = getCertColor(cert);
            const Icon = getCertIcon(cert.name);

            return (
              <motion.div
                key={index}
                className="relative"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Badge */}
                <motion.div
                  className={cn(
                    "relative px-3 py-2.5 rounded-lg border transition-all duration-300",
                    "backdrop-blur-sm cursor-default overflow-hidden",
                    "flex items-center gap-2",
                  )}
                  style={{
                    backgroundColor: `rgba(${color}, ${isHovered ? 0.08 : 0.03})`,
                    borderColor: `rgba(${color}, ${isHovered ? 0.4 : 0.2})`,
                  }}
                  whileHover={{ scale: 1.02 }}
                >
                  {/* Background gradient effect */}
                  <motion.div
                    className="absolute inset-0 opacity-0"
                    style={{
                      background: `linear-gradient(135deg, transparent, rgba(${color}, 0.1))`,
                    }}
                    animate={{
                      opacity: isHovered ? 1 : 0,
                    }}
                    transition={{ duration: 0.3 }}
                  />

                  {/* Icon */}
                  <div
                    className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: `rgba(${color}, 0.1)`,
                    }}
                  >
                    <Icon
                      size={14}
                      style={{
                        color: `rgb(${color})`,
                      }}
                    />
                  </div>

                  {/* Content */}
                  <div className="relative z-10 flex-1 min-w-0">
                    <div
                      className={cn(
                        "text-xs font-medium truncate transition-colors",
                        isHovered ? "text-foreground" : "text-foreground/70",
                      )}
                    >
                      {cert.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 truncate">
                      {cert.issuer}
                    </div>
                    <div
                      className="text-[9px] font-medium mt-0.5"
                      style={{
                        color: `rgba(${color}, 0.8)`,
                      }}
                    >
                      {cert.year}
                    </div>
                  </div>

                  {/* Hover glow effect */}
                  {isHovered && (
                    <motion.div
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
                    </motion.div>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Tablet: 2-Column Grid */}
      <div className="hidden sm:block md:hidden">
        <div className="grid grid-cols-2 gap-3">
          {sortedCerts.map((cert, index) => {
            const color = getCertColor(cert);
            const Icon = getCertIcon(cert.name);

            return (
              <motion.div
                key={index}
                className={cn(
                  "relative px-3 py-2.5 rounded-lg border",
                  "backdrop-blur-sm flex items-center gap-2",
                )}
                style={{
                  backgroundColor: `rgba(${color}, 0.03)`,
                  borderColor: `rgba(${color}, 0.2)`,
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.05 }}
              >
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: `rgba(${color}, 0.1)`,
                  }}
                >
                  <Icon
                    size={12}
                    style={{
                      color: `rgb(${color})`,
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground/80 truncate">
                    {cert.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 truncate">
                    {cert.issuer} • {cert.year}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Mobile: Vertical List */}
      <div className="sm:hidden">
        <div className="space-y-2">
          {sortedCerts.map((cert, index) => {
            const color = getCertColor(cert);
            const Icon = getCertIcon(cert.name);

            return (
              <motion.div
                key={index}
                className={cn(
                  "relative px-3 py-2.5 rounded-lg border",
                  "backdrop-blur-sm flex items-center gap-3",
                )}
                style={{
                  backgroundColor: `rgba(${color}, 0.03)`,
                  borderColor: `rgba(${color}, 0.2)`,
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
              >
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: `rgba(${color}, 0.1)`,
                  }}
                >
                  <Icon
                    size={14}
                    style={{
                      color: `rgb(${color})`,
                    }}
                  />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground/80">
                    {cert.name}
                  </div>
                  <div className="text-xs text-muted-foreground/60">
                    {cert.issuer} • {cert.year}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
