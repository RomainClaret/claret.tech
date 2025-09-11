"use client";

import { useEffect, useState, useRef } from "react";
import { DisplayLottie } from "./display-lottie";
import { splashScreen } from "@/data/portfolio";
import { useTheme } from "./theme-provider";
import graphNetworkWhiteAnimation from "../../../public/animations/graphNetworkWhiteAnimation.json";
import graphNetworkBlueAnimation from "../../../public/animations/graphNetworkBlueAnimation.json";
import { cn } from "@/lib/utils";
import { useProjects } from "@/contexts/projects-context";
import { useBackground } from "@/contexts/background-context";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import {
  detectSafari,
  storeSafariDetection,
  shouldResetAnimationPreference,
  storeAnimationPreference,
  clearAnimationPreference,
} from "@/lib/utils/safari-detection";
import { logError, logWarning } from "@/lib/utils/dev-logger";

interface SplashScreenProps {
  onComplete?: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const shouldReduceAnimations = useShouldReduceAnimations();
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const { theme } = useTheme();
  const animationFrameRef = useRef<number | null>(null);
  const { setAllProjects, setIsLoading } = useProjects();
  const { generateBackgroundData } = useBackground();
  const fetchStartedRef = useRef(false);
  const backgroundGeneratedRef = useRef(false);
  const browserDetectionRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);

    // Perform early browser detection and store in localStorage
    if (!browserDetectionRef.current) {
      browserDetectionRef.current = true;
      try {
        const detection = detectSafari();

        // Store the detection result for future use
        storeSafariDetection(detection.isSafari, detection.source);

        // Handle browser-aware animation preferences
        const isSafari = detection.isSafari;

        // Check if browser changed and clear preference if needed
        if (shouldResetAnimationPreference(isSafari)) {
          clearAnimationPreference();
        }

        // Set browser-appropriate default (Safari = false, others = true)
        const animationDefault = !isSafari;
        storeAnimationPreference(animationDefault, isSafari, false); // false = not user preference, just browser default
      } catch (error) {
        logWarning(
          `Failed browser detection during splash: ${error}`,
          "SplashScreen.browserDetection",
        );
      }
    }

    // Generate background data on mount
    if (!backgroundGeneratedRef.current) {
      backgroundGeneratedRef.current = true;
      // Use window dimensions with default fallback
      const width = typeof window !== "undefined" ? window.innerWidth : 1920;
      const height = typeof window !== "undefined" ? window.innerHeight : 1080;
      generateBackgroundData(width, height, 64); // 64px grid size
    }
  }, [generateBackgroundData]);

  // Fetch all projects during splash screen
  useEffect(() => {
    if (!splashScreen.enabled || !isMounted || fetchStartedRef.current) return;

    fetchStartedRef.current = true;
    setIsLoading(true);

    // Fetch all repositories in the background
    fetch("/api/fetch-all-repos")
      .then((response) => response.json())
      .then((result) => {
        if (result.success && result.data) {
          setAllProjects(result.data);
        }
      })
      .catch((error) => {
        logError(error, "SplashScreen.fetchAllProjects");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isMounted, setAllProjects, setIsLoading]);

  useEffect(() => {
    // Only show splash screen if enabled and mounted
    if (!splashScreen.enabled || !isMounted) {
      // If splash screen is disabled, immediately call onComplete
      if (!splashScreen.enabled && isMounted) {
        onComplete?.();
      }
      return;
    }

    // Reset progress to 0
    setProgress(0);

    // Small delay to ensure proper mounting
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 10);

    // Animations are now controlled by the unified animation state system
    // They start automatically based on browser detection and user preferences

    // Animate progress bar using requestAnimationFrame for better performance
    // Delay the animation start to ensure UI elements are visible
    const animationStartDelay = setTimeout(() => {
      let startTime: number | null = null;

      const animateProgress = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progressValue = Math.min(
          (elapsed / (splashScreen.duration - 400)) * 100,
          100,
        );

        setProgress(progressValue);

        if (progressValue < 100) {
          animationFrameRef.current = requestAnimationFrame(animateProgress);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animateProgress);
    }, 400); // Start after UI fade-in animations

    // Hide splash screen after duration + animation delay
    const hideTimer = setTimeout(() => {
      setIsExiting(true);
      // Wait for exit animation to complete
      setTimeout(() => {
        setIsVisible(false);
        // Ensure body scroll is enabled after splash
        document.body.style.overflow = "auto";
        // Notify parent that splash screen is complete
        onComplete?.();
      }, 600);
    }, splashScreen.duration + 100); // Add small buffer to ensure progress reaches 100%

    // Prevent scroll during splash
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(animationStartDelay);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      document.body.style.overflow = "auto";
    };
  }, [isMounted, onComplete]);

  if (!isMounted || (!isVisible && !splashScreen.enabled)) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[10000] bg-background flex items-center justify-center transition-all duration-500",
        isExiting ? "opacity-0 pointer-events-none" : "opacity-100",
        !isVisible && "hidden",
      )}
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Loading portfolio"
    >
      <div
        className={cn(
          "max-w-md w-full px-8 transition-all duration-700",
          isExiting ? "scale-90 opacity-0" : "scale-100 opacity-100",
          isVisible &&
            !isExiting &&
            !shouldReduceAnimations &&
            "animate-scale-in",
        )}
        style={
          !shouldReduceAnimations ? { willChange: "transform, opacity" } : {}
        }
      >
        <DisplayLottie
          animationData={
            theme === "light"
              ? graphNetworkBlueAnimation
              : graphNetworkWhiteAnimation
          }
          loop={false}
          className="w-full max-w-lg mx-auto"
        />

        {/* Loading text and progress */}
        <div className="text-center mt-8 space-y-4">
          <div
            className={cn(
              !shouldReduceAnimations &&
                "animate-slide-in-up animation-delay-200",
            )}
          >
            <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Romain Claret
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              PhD Researcher • Evolving Artificial Intelligence
            </p>
          </div>

          {/* Progress bar */}
          <div className={cn(!shouldReduceAnimations && "animate-fade-in")}>
            <div className="relative w-full max-w-xs mx-auto h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-purple-600 transition-[width] duration-100 ease-out rounded-full"
                style={{
                  width: `${progress}%`,
                  ...(shouldReduceAnimations
                    ? {}
                    : {
                        willChange: "width",
                        transform: "translateZ(0)",
                      }),
                }}
              />
            </div>
            <p
              className={cn(
                "text-xs text-muted-foreground mt-2",
                !shouldReduceAnimations && "animate-pulse",
              )}
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="sr-only">{progress}% loaded. </span>
              {progress < 100 ? "Initializing..." : "Ready!"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
