"use client";

import { m } from "framer-motion";
import { cn } from "@/lib/utils";

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
                isCompleted && "bg-green-700 text-white",
                isActive && "bg-primary text-primary-foreground",
                isPending && "bg-muted text-muted-foreground",
                phase.status === "error" && "bg-red-700 text-white",
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
                    isPending && "text-muted-foreground",
                    phase.status === "error" &&
                      "text-red-700 dark:text-red-400",
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
                  <m.div
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
