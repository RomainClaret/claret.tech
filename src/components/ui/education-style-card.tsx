"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface EducationStyleCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  insideBackgroundColor?: string;
  delay?: number;
}

export function EducationStyleCard({
  children,
  className,
  glowColor = "139, 92, 246", // Purple in RGB
  insideBackgroundColor,
  delay = 0,
}: EducationStyleCardProps) {
  return (
    <motion.div
      className={cn("relative group/card h-full", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
    >
      {/* Soft ambient glow */}
      <div
        className="absolute -inset-1 rounded-xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at 50% 50%, rgba(${glowColor}, 0.15), transparent 70%)`,
          filter: "blur(20px)",
        }}
      />

      {/* Main card content */}
      <div
        className={cn(
          "relative bg-gradient-to-br from-card to-card/90",
          "backdrop-blur-sm rounded-lg overflow-hidden",
          "shadow-lg border border-border/50",
          "transition-all duration-300",
          "hover:shadow-xl hover:border-border/80",
          "h-full",
        )}
      >
        {/* Subtle gradient overlay */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            background: `linear-gradient(135deg, rgba(${glowColor}, 0.1) 0%, transparent 50%, rgba(${glowColor}, 0.05) 100%)`,
          }}
        />

        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] opacity-60"
          style={{
            background: `linear-gradient(90deg, transparent 10%, rgba(${glowColor}, 0.8) 50%, transparent 90%)`,
          }}
        />

        {/* Soft inner glow on hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `radial-gradient(
              ellipse at 50% 50%,
              rgba(${glowColor}, 0.03) 0%,
              transparent 60%
            )`,
          }}
        />

        {/* Inside background color overlay */}
        {insideBackgroundColor && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor: `rgba(${insideBackgroundColor}, 0.03)`,
              mixBlendMode: "multiply",
            }}
          />
        )}

        {children}
      </div>
    </motion.div>
  );
}
