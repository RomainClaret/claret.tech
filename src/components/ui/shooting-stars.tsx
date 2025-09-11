"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { usePageVisibility } from "@/lib/hooks/useVisibility";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useAnimationState } from "@/contexts/animation-state-context";
import { useQuality, SHOOTING_STARS_PROFILE } from "@/contexts/quality-context";
import { generateStableId } from "@/lib/utils/stable-ids";

interface ShootingStarsProps {
  minDelay?: number; // Minimum delay between stars in seconds
  maxDelay?: number; // Maximum delay between stars in seconds
  className?: string;
}

interface Star {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
  angle: number;
  size: number;
}

export function ShootingStars({
  minDelay = 30,
  maxDelay = 120,
  className,
}: ShootingStarsProps) {
  const [stars, setStars] = useState<Star[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const starTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isPageVisible = usePageVisibility();
  const prefersReducedMotion = useReducedMotion();
  const { areAnimationsPlaying } = useAnimationState();
  const { getConfig } = useQuality();
  const config = getConfig(SHOOTING_STARS_PROFILE);

  // Hydration-safe visibility state to prevent mismatch errors
  const [hydratedVisibility, setHydratedVisibility] = useState(true);

  // Update visibility state after hydration to sync with actual animation state
  useEffect(() => {
    setHydratedVisibility(
      !prefersReducedMotion && areAnimationsPlaying && config.animate,
    );
  }, [prefersReducedMotion, areAnimationsPlaying, config.animate]);

  // Clean up all stars when quality config changes to prevent key duplication
  useEffect(() => {
    // Clear all existing stars when quality changes
    setStars([]);
    starTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
    starTimeoutsRef.current.clear();

    // Clear main timeout as well
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, [config.animate, config.updateFrequency]);

  useEffect(() => {
    // Store ref values at effect start for cleanup
    const starTimeouts = starTimeoutsRef.current;

    // Don't create stars if page is not visible, user prefers reduced motion, animations are stopped, or quality disables animation
    if (
      !isPageVisible ||
      prefersReducedMotion ||
      !areAnimationsPlaying ||
      !config.animate
    ) {
      return;
    }

    const createStar = () => {
      // Additional check in case state changed
      if (
        !isPageVisible ||
        prefersReducedMotion ||
        !areAnimationsPlaying ||
        !config.animate
      ) {
        return;
      }
      const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
      let startX, startY, endX, endY;

      // Set starting position based on side
      switch (side) {
        case 0: // Top
          startX = Math.random() * window.innerWidth;
          startY = -10;
          endX = startX + (Math.random() - 0.5) * 400;
          endY = window.innerHeight + 10;
          break;
        case 1: // Right
          startX = window.innerWidth + 10;
          startY = Math.random() * window.innerHeight;
          endX = -10;
          endY = startY + (Math.random() - 0.5) * 400;
          break;
        case 2: // Bottom
          startX = Math.random() * window.innerWidth;
          startY = window.innerHeight + 10;
          endX = startX + (Math.random() - 0.5) * 400;
          endY = -10;
          break;
        case 3: // Left
          startX = -10;
          startY = Math.random() * window.innerHeight;
          endX = window.innerWidth + 10;
          endY = startY + (Math.random() - 0.5) * 400;
          break;
      }

      // Calculate angle for tail orientation
      const deltaX = endX! - startX!;
      const deltaY = endY! - startY!;
      const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

      // Generate stable unique ID
      const uniqueId = generateStableId("star");

      const newStar: Star = {
        id: uniqueId,
        startX: startX!,
        startY: startY!,
        endX: endX!,
        endY: endY!,
        duration: 1.5 + Math.random() * 1, // 1.5-2.5 seconds
        angle: angle,
        size: 0.6 + Math.random() * 0.2, // Smaller size: 0.6-0.8
      };

      setStars((prev) => [...prev, newStar]);

      // Remove star after animation with cleanup tracking
      const removeTimeout = setTimeout(
        () => {
          setStars((prev) => prev.filter((s) => s.id !== newStar.id));
          starTimeoutsRef.current.delete(newStar.id);
        },
        (newStar.duration + 0.1) * 1000,
      );
      starTimeoutsRef.current.set(newStar.id, removeTimeout);

      // Schedule next star only if page is still visible and animations are playing
      if (
        isPageVisible &&
        !prefersReducedMotion &&
        areAnimationsPlaying &&
        config.animate
      ) {
        // Adjust delay based on quality updateFrequency
        const qualityMultiplier = config.updateFrequency
          ? 10 / config.updateFrequency
          : 1;
        const adjustedMinDelay = minDelay * qualityMultiplier;
        const adjustedMaxDelay = maxDelay * qualityMultiplier;
        const nextDelay =
          adjustedMinDelay +
          Math.random() * (adjustedMaxDelay - adjustedMinDelay);
        timeoutRef.current = setTimeout(createStar, nextDelay * 1000);
      }
    };

    // Create first star after initial delay
    const initialDelay = minDelay + Math.random() * (maxDelay - minDelay);
    timeoutRef.current = setTimeout(createStar, initialDelay * 1000);

    return () => {
      // Clear main timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Clear all star removal timeouts using stored ref value
      if (starTimeouts) {
        starTimeouts.forEach((timeout) => clearTimeout(timeout));
        starTimeouts.clear();
      }
    };
  }, [
    minDelay,
    maxDelay,
    isPageVisible,
    prefersReducedMotion,
    areAnimationsPlaying,
    config.animate,
    config.updateFrequency,
  ]);

  // Use hydration-safe visibility state for rendering
  const shouldShowStars = hydratedVisibility;

  return (
    <div
      className={cn(
        "fixed inset-0 pointer-events-none overflow-hidden transition-opacity duration-300",
        !shouldShowStars && "opacity-0",
        className,
      )}
    >
      {shouldShowStars &&
        stars.map((star) => (
          <div
            key={star.id}
            className="absolute will-change-transform shooting-star"
            style={
              {
                left: star.startX,
                top: star.startY,
                "--star-end-x": `${star.endX - star.startX}px`,
                "--star-end-y": `${star.endY - star.startY}px`,
                animation: `shooting-star ${star.duration}s cubic-bezier(0.4, 0, 0.2, 1) forwards`,
              } as React.CSSProperties
            }
          >
            {/* Simple star container */}
            <div
              className="relative"
              style={{
                transform: `scale(${star.size})`,
              }}
            >
              {/* Star core - single element */}
              <div
                className="w-1.5 h-1.5 bg-slate-700 dark:bg-white rounded-full"
                style={{
                  boxShadow: "0 0 6px currentColor, 0 0 12px currentColor",
                }}
              />

              {/* Simple tail */}
              <div
                className="absolute top-[3px] left-[3px] origin-left"
                style={{
                  transform: `rotate(${star.angle + 180}deg)`,
                  width: `${50 * star.size}px`,
                  height: "1px",
                }}
              >
                <div className="h-full w-full bg-gradient-to-r from-slate-700/80 via-slate-700/40 to-transparent dark:from-white/80 dark:via-white/40 dark:to-transparent" />
              </div>
            </div>
          </div>
        ))}

      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes shooting-star {
            0% {
              transform: translate(0, 0);
              opacity: 0;
            }
            10% {
              opacity: 1;
            }
            90% {
              opacity: 1;
            }
            100% {
              transform: translate(var(--star-end-x), var(--star-end-y));
              opacity: 0;
            }
          }
        `,
        }}
      />
    </div>
  );
}
