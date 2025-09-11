"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  progress: number; // 0-100
  phase: string;
  className?: string;
  showPercentage?: boolean;
  showETA?: boolean;
  eta?: number; // seconds
  animated?: boolean;
}

export function ProgressBar({
  progress,
  phase,
  className,
  showPercentage = true,
  showETA = false,
  eta,
  animated = true,
}: ProgressBarProps) {
  const formatETA = (seconds: number) => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getPhaseColor = (progress: number) => {
    if (progress >= 90) return "bg-green-500";
    if (progress >= 70) return "bg-blue-500";
    if (progress >= 40) return "bg-yellow-500";
    return "bg-primary";
  };

  return (
    <div className={cn("w-full space-y-2", className)}>
      {/* Phase and status */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{phase}</span>
        <div className="flex items-center gap-2 text-xs">
          {showPercentage && (
            <span className="font-mono">{Math.round(progress)}%</span>
          )}
          {showETA && eta !== undefined && (
            <span className="text-muted-foreground">ETA: {formatETA(eta)}</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        {animated ? (
          <motion.div
            className={cn("h-full rounded-full", getPhaseColor(progress))}
            initial={{ width: "0%" }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{
              duration: 0.5,
              ease: "easeOut",
            }}
          />
        ) : (
          <div
            className={cn("h-full rounded-full", getPhaseColor(progress))}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        )}

        {/* Shimmer effect for active progress */}
        {progress > 0 && progress < 100 && (
          <motion.div
            className="absolute top-0 left-0 h-full w-8 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{
              x: ["-100%", "400%"],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}
      </div>

      {/* Progress indicators */}
      <div className="flex justify-between">
        {[0, 25, 50, 75, 100].map((marker) => (
          <div
            key={marker}
            className={cn(
              "w-1 h-1 rounded-full transition-colors",
              progress >= marker ? "bg-primary" : "bg-muted-foreground/30",
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ASCII progress bar for terminal output
export function generateASCIIProgressBar(
  progress: number,
  width: number = 40,
): string {
  // Clamp progress between 0 and 100 to prevent negative values
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const filled = Math.round((clampedProgress / 100) * width);
  const empty = Math.max(0, width - filled);

  const filledChars = "█".repeat(filled);
  const emptyChars = "░".repeat(empty);

  return `[${filledChars}${emptyChars}] ${Math.round(clampedProgress)}%`;
}

// Multi-phase progress component
interface MultiPhaseProgressProps {
  phases: Array<{
    name: string;
    progress: number; // 0-100 for this phase
    status: "pending" | "active" | "completed" | "error";
  }>;
  currentPhase: number;
  className?: string;
}

export function MultiPhaseProgress({
  phases,
  currentPhase,
  className,
}: MultiPhaseProgressProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {phases.map((phase, index) => {
        const isActive = index === currentPhase;
        const isCompleted = index < currentPhase;
        const isPending = index > currentPhase;

        return (
          <div key={index} className="flex items-center gap-3">
            {/* Phase indicator */}
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                isCompleted && "bg-green-500 text-white",
                isActive && "bg-primary text-primary-foreground",
                isPending && "bg-muted text-muted-foreground",
                phase.status === "error" && "bg-red-500 text-white",
              )}
            >
              {isCompleted ? "✓" : index + 1}
            </div>

            {/* Phase details */}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-sm font-medium",
                    isActive && "text-foreground",
                    isCompleted && "text-muted-foreground",
                    isPending && "text-muted-foreground/70",
                    phase.status === "error" && "text-red-500",
                  )}
                >
                  {phase.name}
                </span>
                {isActive && (
                  <span className="text-xs text-muted-foreground">
                    {Math.round(phase.progress)}%
                  </span>
                )}
              </div>

              {/* Progress bar for active phase */}
              {isActive && (
                <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: `${phase.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
