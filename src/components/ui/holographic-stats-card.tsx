"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface HolographicStatsCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  insideBackgroundColor?: string;
  delay?: number;
}

export function HolographicStatsCard({
  children,
  className,
  glowColor = "139, 92, 246", // Purple in RGB
  insideBackgroundColor,
  delay = 0,
}: HolographicStatsCardProps) {
  return (
    <motion.div
      className={cn("relative group/statscard h-full", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ scale: 1.02 }}
    >
      {/* Neural glow effect */}
      <motion.div
        className="absolute -inset-1 rounded-lg blur-xl"
        style={{
          backgroundColor: `rgb(${glowColor})`,
        }}
        initial={{ opacity: 0.1 }}
        animate={{ opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Main card content */}
      <motion.div
        className={cn(
          "relative h-full p-3 sm:p-4 rounded-lg overflow-hidden",
          "bg-card/90",
          "border transition-all duration-300",
          "hover:shadow-lg",
        )}
        style={{
          backgroundColor: `rgba(${glowColor}, 0.05)`,
          borderColor: `rgba(${glowColor}, 0.3)`,
        }}
      >
        {/* Holographic shimmer effect */}
        <div
          className="absolute inset-0 opacity-0 group-hover/statscard:opacity-70 transition-opacity duration-300"
          style={{
            background: `linear-gradient(
              105deg,
              transparent 40%,
              rgba(${glowColor}, 0.2) 50%,
              transparent 60%
            )`,
            animation: "shimmer 2s ease-out",
          }}
        />

        {/* Rainbow holographic overlay */}
        <div
          className="absolute inset-0 opacity-0 group-hover/statscard:opacity-5 transition-opacity duration-500 rounded-lg"
          style={{
            backgroundImage: `linear-gradient(45deg,
              rgba(255, 0, 0, 0.1) 0%,
              rgba(255, 154, 0, 0.1) 10%,
              rgba(208, 222, 33, 0.1) 20%,
              rgba(79, 220, 74, 0.1) 30%,
              rgba(63, 218, 216, 0.1) 40%,
              rgba(47, 201, 226, 0.1) 50%,
              rgba(28, 127, 238, 0.1) 60%,
              rgba(95, 21, 242, 0.1) 70%,
              rgba(186, 12, 248, 0.1) 80%,
              rgba(251, 7, 217, 0.1) 90%,
              rgba(255, 0, 0, 0.1) 100%
            )`,
            backgroundSize: "200% 200%",
            animation: "holographic 4s linear infinite",
          }}
        />

        {/* Gradient background subtle animation */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            background: `radial-gradient(circle at 50% 50%, rgba(${glowColor}, 0.1), transparent 70%)`,
          }}
        />

        {/* Light reflection effect */}
        <div
          className="absolute top-0 left-0 w-full h-full opacity-0 group-hover/statscard:opacity-5 transition-opacity pointer-events-none duration-300"
          style={{
            background: `radial-gradient(
              ellipse at 50% 0%,
              rgba(255, 255, 255, 0.3) 0%,
              transparent 70%
            )`,
          }}
        />

        {/* Inside background color overlay */}
        {insideBackgroundColor && (
          <div
            className="absolute inset-0 pointer-events-none rounded-lg"
            style={{
              backgroundColor: `rgba(${insideBackgroundColor}, 0.03)`,
              mixBlendMode: "multiply",
            }}
          />
        )}

        {/* Content */}
        <div className="relative z-10">{children}</div>

        {/* Border gradient */}
        <motion.div
          className="absolute inset-0 rounded-lg p-[1px] -z-10 opacity-0 group-hover/statscard:opacity-100 transition-opacity duration-300"
          style={{
            backgroundImage: `linear-gradient(135deg,
              rgba(${glowColor}, 0.5) 0%,
              rgba(255, 255, 255, 0.3) 25%,
              rgba(${glowColor}, 0.5) 50%,
              rgba(255, 255, 255, 0.3) 75%,
              rgba(${glowColor}, 0.5) 100%
            )`,
            backgroundSize: "200% 200%",
          }}
        />
      </motion.div>
    </motion.div>
  );
}
