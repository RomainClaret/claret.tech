"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { validateRadius } from "@/lib/utils/svg-validation";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  className?: string;
  showPercentage?: boolean;
  animate?: boolean;
  label?: string;
}

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 6,
  color = "rgb(139, 92, 246)",
  backgroundColor = "rgba(139, 92, 246, 0.1)",
  className,
  showPercentage = true,
  animate = true,
  label,
}: ProgressRingProps) {
  const shouldReduceAnimations = useShouldReduceAnimations();
  const [animatedProgress, setAnimatedProgress] = useState(
    animate ? 0 : progress,
  );

  // All hooks must be called before any early returns
  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => {
        setAnimatedProgress(progress);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [progress, animate]);

  // Validate and sanitize size and strokeWidth
  const validSize =
    typeof size === "number" && !isNaN(size) && isFinite(size) && size > 0
      ? size
      : 80;
  const validStrokeWidth =
    typeof strokeWidth === "number" &&
    !isNaN(strokeWidth) &&
    isFinite(strokeWidth) &&
    strokeWidth > 0
      ? strokeWidth
      : 6;

  // Ensure strokeWidth is not larger than size
  const finalStrokeWidth = Math.min(validStrokeWidth, validSize / 2);

  // Calculate radius with robust fallback protection
  const safeRadius =
    validSize &&
    finalStrokeWidth &&
    isFinite(validSize) &&
    isFinite(finalStrokeWidth)
      ? Math.max(1, (validSize - finalStrokeWidth) / 2)
      : 40;

  const radius = safeRadius; // Use calculated radius
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (animatedProgress / 100) * circumference;

  // Safety check for radius
  if (!isFinite(radius) || isNaN(radius) || radius <= 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center transition-transform duration-300 hover:scale-125",
        className,
      )}
    >
      {/* Background glow */}
      {animatedProgress === 100 && (
        <div
          className={cn(
            "absolute inset-0 rounded-full blur-xl",
            !shouldReduceAnimations && "animate-pulse",
          )}
          style={{
            backgroundColor: color,
            opacity: 0.2,
          }}
        />
      )}

      <svg
        width={validSize}
        height={validSize}
        className="transform -rotate-90"
        style={{
          filter: `drop-shadow(0 0 10px ${color}40)`,
        }}
      >
        {/* Background circle */}
        <circle
          cx={validSize / 2}
          cy={validSize / 2}
          r={validateRadius(radius, "40", "ProgressRing-background", {
            size: validSize,
            strokeWidth: finalStrokeWidth,
          })}
          stroke={backgroundColor}
          strokeWidth={finalStrokeWidth}
          fill="none"
        />

        {/* Progress circle */}
        <circle
          cx={validSize / 2}
          cy={validSize / 2}
          r={validateRadius(radius, "40", "ProgressRing-progress", {
            size: validSize,
            strokeWidth: finalStrokeWidth,
          })}
          stroke={color}
          strokeWidth={finalStrokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: animate ? "stroke-dashoffset 1.5s ease-in-out" : "none",
          }}
        />

        {/* Animated dots */}
        {animatedProgress > 0 && animatedProgress < 100 && (
          <circle
            cx={validSize / 2}
            cy={validSize / 2}
            r={validateRadius(radius, "40", "ProgressRing-animate", {
              size: validSize,
              strokeWidth: finalStrokeWidth,
            })}
            stroke="transparent"
            strokeWidth={finalStrokeWidth}
            fill="none"
          >
            <animate
              attributeName="stroke"
              values={`transparent;${color};transparent`}
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="stroke-dasharray"
              values={`0 ${circumference};5 ${circumference};0 ${circumference}`}
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        )}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showPercentage && (
          <div
            className={cn(
              "font-bold tabular-nums leading-none",
              size <= 60 ? "text-[10px]" : "text-sm",
            )}
            style={{ color }}
          >
            {Math.round(animatedProgress)}%
          </div>
        )}
        {label && (
          <div
            className={cn(
              "text-muted-foreground leading-none",
              size <= 60 ? "text-[6px] mt-0.5" : "text-[10px] mt-1",
            )}
          >
            {label}
          </div>
        )}
      </div>

      {/* Completion checkmark - only show for larger rings */}
      {animatedProgress === 100 && size > 60 && (
        <div
          className="absolute top-0 right-0 w-5 h-5 rounded-full flex items-center justify-center animate-scale-in"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}60`,
          }}
        >
          <svg
            className="w-3 h-3 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      )}

      <style jsx>{`
        @keyframes scale-in {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

// Preset configurations for education progress
export const educationProgress = {
  phd: {
    current: 85, // Ongoing
    label: "In Progress",
    color: "rgb(34, 197, 94)", // Green for active
  },
  master: {
    current: 100, // Completed
    label: "Completed",
    color: "rgb(59, 130, 246)", // Blue for completed
  },
  bachelor: {
    current: 100, // Completed
    label: "Completed",
    color: "rgb(59, 130, 246)", // Blue for completed
  },
};
