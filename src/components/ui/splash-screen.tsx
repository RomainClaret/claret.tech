"use client";

import { useEffect, useEffectEvent, useState, useRef } from "react";
import { DisplayLottie } from "./display-lottie";
import { splashScreen } from "@/data/portfolio";
import { useTheme } from "./theme-provider";
import { cn } from "@/lib/utils";
import { useProjects } from "@/contexts/projects-context";
import { useBackground } from "@/contexts/background-context";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import {
  detectSafari,
  storeSafariDetection,
  shouldResetAnimationPreference,
  clearAnimationPreference,
} from "@/lib/utils/safari-detection";
import { logError, logWarning } from "@/lib/utils/dev-logger";
import { useOverlayLock } from "@/lib/hooks/useMotionGate";
import { lockPageScroll } from "@/lib/utils/scroll-lock";
import { useHydrated } from "@/lib/hooks/useHydrated";

interface SplashScreenProps {
  onComplete?: () => void;
  /** Its content is on screen: the backdrop in the HTML can go. */
  onShow?: () => void;
  /**
   * The page reached the screen first (a slow connection; app-wrapper.tsx).
   * The splash still does its work (browser detection, the background, the
   * projects) but shows nothing, locks no scroll, and completes at once.
   */
  skip?: boolean;
}

export function SplashScreen({
  onComplete,
  onShow,
  skip = false,
}: SplashScreenProps) {
  const notifyShown = useEffectEvent(() => onShow?.());
  const shouldReduceAnimations = useShouldReduceAnimations();
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  // The bar is written through refs on each frame rather than through state,
  // which re-rendered the whole splash ~50 times in under a second. React
  // only hears about the one change it renders: "Initializing..." -> "Ready!".
  const [isReady, setIsReady] = useState(false);
  const progressRootRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressTextRef = useRef<HTMLSpanElement>(null);
  // Client-only (loaded with ssr: false), so true from its first render.
  const isMounted = useHydrated();
  // The opaque splash covers the page: nothing behind it needs to move.
  useOverlayLock(isVisible && !isExiting);
  const [animationData, setAnimationData] = useState<object | null>(null);
  const { theme } = useTheme();
  const animationFrameRef = useRef<number | null>(null);
  const { setAllProjects, setIsLoading } = useProjects();
  const { ensureBackgroundData } = useBackground();
  const fetchStartedRef = useRef(false);
  const browserDetectionRef = useRef(false);

  useEffect(() => {
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
        // No default is stored: the animation state provider works it out
        // from the browser on every load. Storing it here replaced a
        // visitor's own choice on every visit.
      } catch (error) {
        logWarning(
          `Failed browser detection during splash: ${error}`,
          "SplashScreen.browserDetection",
        );
      }
    }
  }, []);

  // The site grid needs a background on every route the splash plays on.
  // On / the hero generated one already (the splash mounts after it, once
  // its chunk loads) and this does nothing; generating again there drew a
  // second, different background over the first.
  useEffect(() => {
    ensureBackgroundData(window.innerWidth, window.innerHeight, 64);
  }, [ensureBackgroundData]);

  // Fetch the themed splash Lottie at runtime instead of bundling both
  // multi-MB JSONs into the splash chunk; /animations/* is immutable-cached
  // so repeat visits read it from disk cache. Which also means a file whose
  // content changes needs a new name: v2 is the minified data (8eaebe0),
  // which the old names kept from every visitor who had the 1.6 MB
  // originals cached, for up to a year.
  useEffect(() => {
    // Nobody would see it.
    if (skip) return;
    const file =
      theme === "light"
        ? "graphNetworkBlueAnimation.v2"
        : "graphNetworkWhiteAnimation.v2";
    let cancelled = false;
    fetch(`/animations/${file}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setAnimationData(data);
      })
      .catch((error) => {
        logError(error, "SplashScreen.lottieFetch");
      });
    return () => {
      cancelled = true;
    };
  }, [theme, skip]);

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

    // Told before it showed (or while it waited to): the cleanup of the run
    // that scheduled the show has cleared its timers and the scroll lock.
    if (skip) {
      onComplete?.();
      return;
    }

    // No scrolling under the splash. Released as it leaves, to whatever the
    // page had: it wrote "auto" there, which then stayed on the body.
    const releaseScroll = lockPageScroll();

    // Small delay to ensure proper mounting
    const showTimer = setTimeout(() => {
      setIsVisible(true);
      notifyShown();
    }, 10);

    // Animations are now controlled by the unified animation state system
    // They start automatically based on browser detection and user preferences

    // Animate progress bar using requestAnimationFrame for better performance
    // Delay the animation start to ensure UI elements are visible
    const animationStartDelay = setTimeout(() => {
      let startTime: number | null = null;
      let lastAnnounced = -Infinity;

      const animateProgress = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progressValue = Math.min(
          (elapsed / (splashScreen.duration - 400)) * 100,
          100,
        );

        // The bar every frame; its CSS width transition smooths it as before.
        if (progressBarRef.current) {
          progressBarRef.current.style.width = `${progressValue}%`;
        }
        // Assistive tech about 10 times a second, and at the end.
        if (timestamp - lastAnnounced >= 100 || progressValue >= 100) {
          lastAnnounced = timestamp;
          progressRootRef.current?.setAttribute(
            "aria-valuenow",
            String(progressValue),
          );
          // The text node React rendered, so React's own node stays in place.
          const textNode = progressTextRef.current?.firstChild;
          if (textNode) textNode.nodeValue = `${progressValue}% loaded. `;
        }
        if (progressValue >= 100) setIsReady(true);

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
        releaseScroll();
        // Notify parent that splash screen is complete
        onComplete?.();
      }, 600);
    }, splashScreen.duration + 100); // Add small buffer to ensure progress reaches 100%

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(animationStartDelay);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      releaseScroll();
    };
  }, [isMounted, onComplete, skip]);

  if (!isMounted || (!isVisible && !splashScreen.enabled)) return null;

  return (
    <div
      ref={progressRootRef}
      className={cn(
        "fixed inset-0 z-10000 bg-background items-center justify-center transition-all duration-500",
        isVisible ? "flex" : "hidden",
        isExiting ? "opacity-0 pointer-events-none" : "opacity-100",
      )}
      role="progressbar"
      // Written through the ref as the bar fills; React sets the start.
      aria-valuenow={0}
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
        {/* One square box from the first frame. The animation is 800x800
            and plays square at the box's width; before, the box was 200 px
            while the data loaded, 0 for a frame, 200 px again while the
            player loaded, then the width, and the name and progress bar
            below moved down with each step. */}
        {animationData ? (
          <DisplayLottie
            animationData={animationData}
            loop={false}
            className="w-full max-w-lg mx-auto aspect-square"
          />
        ) : (
          <div className="w-full max-w-lg mx-auto aspect-square" />
        )}

        {/* Loading text and progress */}
        <div className="text-center mt-8 space-y-4">
          <div
            className={cn(
              !shouldReduceAnimations &&
                "animate-slide-in-up animation-delay-200",
            )}
          >
            <div className="text-3xl md:text-4xl font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Romain Claret
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Neuroevolution Researcher & Lecturer • Evolving Artificial
              Intelligence
            </p>
          </div>

          {/* Progress bar */}
          <div className={cn(!shouldReduceAnimations && "animate-fade-in")}>
            <div className="relative w-full max-w-xs mx-auto h-2 bg-muted rounded-full overflow-hidden">
              <div
                ref={progressBarRef}
                className="absolute inset-y-0 left-0 bg-linear-to-r from-primary to-purple-600 transition-[width] duration-100 ease-out rounded-full"
                style={{
                  // Advanced through the ref; see animateProgress.
                  width: "0%",
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
              <span ref={progressTextRef} className="sr-only">
                {"0% loaded. "}
              </span>
              {isReady ? "Ready!" : "Initializing..."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
