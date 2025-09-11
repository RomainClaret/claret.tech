"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GraduationCap } from "lucide-react";

interface MobileTimelineProps {
  currentIndex: number;
  totalItems: number;
  colors: string[];
  labels: string[];
  className?: string;
}

export function MobileTimeline({
  currentIndex,
  totalItems,
  colors,
  labels,
  className,
}: MobileTimelineProps) {
  return (
    <div
      className={cn("relative", className)}
      role="progressbar"
      aria-label="Education progress timeline"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={totalItems}
    >
      {/* Timeline track */}
      <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border/30" />

      {/* Progress indicator */}
      <motion.div
        className="absolute left-8 top-0 w-0.5 bg-gradient-to-b from-primary via-purple-600 to-primary"
        initial={{ height: "0%" }}
        animate={{
          height: `${((currentIndex + 1) / totalItems) * 100}%`,
        }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />

      {/* Timeline nodes */}
      {Array.from({ length: totalItems }).map((_, index) => {
        const isActive = index === currentIndex;
        const isPast = index < currentIndex;
        const color = colors[index] || "rgb(139, 92, 246)";

        return (
          <motion.div
            key={index}
            className="absolute left-8 -translate-x-1/2"
            style={{
              top: `${(index / (totalItems - 1)) * 100}%`,
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            {/* Node container */}
            <div className="relative">
              {/* Glow effect */}
              <motion.div
                className="absolute inset-0 rounded-full blur-md"
                style={{
                  background: color,
                  width: "24px",
                  height: "24px",
                  transform: "translate(-50%, -50%)",
                  left: "50%",
                  top: "50%",
                }}
                initial={{ opacity: 0.2 }}
                animate={{
                  opacity: isActive ? 0.6 : isPast ? 0.3 : 0.2,
                }}
              />

              {/* Node */}
              <motion.div
                className={cn(
                  "relative w-6 h-6 rounded-full",
                  "border-2 transition-all duration-300",
                  "flex items-center justify-center",
                )}
                style={{
                  borderColor: isPast || isActive ? color : "transparent",
                  backgroundColor:
                    isPast || isActive ? color : "rgb(var(--background))",
                }}
                animate={{
                  scale: isActive ? 1.2 : 1,
                }}
              >
                {(isPast || isActive) && (
                  <GraduationCap className="w-3 h-3 text-white" />
                )}
              </motion.div>

              {/* Pulse effect for active node */}
              {isActive && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2"
                  style={{
                    borderColor: color,
                    width: "32px",
                    height: "32px",
                    transform: "translate(-50%, -50%)",
                    left: "50%",
                    top: "50%",
                  }}
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 0, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}

              {/* Label (for active node) */}
              {isActive && labels[index] && (
                <motion.div
                  className="absolute left-10 top-1/2 -translate-y-1/2 whitespace-nowrap"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="text-xs font-semibold text-foreground/80">
                    {labels[index]}
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
