"use client";

import { useEffect, useEffectEvent } from "react";
import { useTheme } from "./theme-provider";
import { useQuality } from "@/contexts/quality-context";
import { useAnimationStateOptional } from "@/contexts/animation-state-context";
import { logError } from "@/lib/utils/dev-logger";

interface FaviconRenderer {
  drawFrame: (frame: number) => void;
  updatePattern?: (pattern: FaviconPattern) => void;
}

interface FaviconPattern {
  length: number;
}

interface CascadeItem {
  x: number;
  y: number;
  age: number;
  strength: number;
}

interface FaviconWindow extends Window {
  generateHybrid2?: () => FaviconPattern;
  generateContinuousHybrid2?: (
    initialState?: number[][],
    initialCascades?: CascadeItem[],
    frameCount?: number,
    generation?: number,
  ) => {
    frames: FaviconPattern;
    finalState: number[][];
    finalCascades: CascadeItem[];
  };
  OptimizedHybrid2Renderer?: new (
    canvas: HTMLCanvasElement,
    pattern: FaviconPattern,
    options: { theme: string; highContrast: boolean },
  ) => FaviconRenderer;
}

// Helper function to load scripts dynamically
/**
 * The favicon links: rel containing the token "icon". `rel*='icon'` also
 * matched the five apple-touch-icon links, which every frame then rewrote
 * with a 32 px data URL, and which iOS would have saved as the home-screen
 * icon in place of the 180 px PNG.
 */
const ICON_LINKS = "link[rel~='icon']";

// One request per script per page. A run superseded while the scripts
// loaded (a dark visitor's theme settles after hydration) found them not yet
// loaded and appended both again. A failed load can be asked for again.
const scriptLoads = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  let load = scriptLoads.get(src);
  if (!load) {
    load = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
    load.catch(() => scriptLoads.delete(src));
    scriptLoads.set(src, load);
  }
  return load;
}

export function AnimatedFavicon() {
  const { theme } = useTheme();
  const { quality } = useQuality();
  const isLowQuality = quality === "battery" || quality === "low";
  // Honor the site-wide animation switch. Read through an effect event so
  // toggling pauses the loop in place instead of tearing down and reloading
  // the favicon scripts (optional hook: tests may render without the
  // provider).
  const animationState = useAnimationStateOptional();
  const areAnimationsPlaying = animationState?.areAnimationsPlaying ?? true;
  const animationsPlaying = useEffectEvent(() => areAnimationsPlaying);

  useEffect(() => {
    let animationId: number | null = null;
    let cleanup: (() => void) | null = null;
    let faviconLink: HTMLLinkElement | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let renderer: FaviconRenderer | null = null;
    let isPaused = false; // Track if we're in a pause between loops
    let pauseTimeout: NodeJS.Timeout | null = null;
    // Set when this run is torn down. The scripts load asynchronously, and
    // cleanup is only assigned once they have: a theme or tier change while
    // they loaded left the superseded run free to start a second loop.
    let cancelled = false;

    // Dynamic import to avoid SSR issues
    const loadFaviconAnimator = async () => {
      try {
        // Check if modules are already loaded
        let generateHybrid2 = (window as FaviconWindow).generateHybrid2;
        let generateContinuousHybrid2 = (window as FaviconWindow)
          .generateContinuousHybrid2;
        let OptimizedHybrid2Renderer = (window as FaviconWindow)
          .OptimizedHybrid2Renderer;

        // Only load scripts if they haven't been loaded yet, both at once:
        // neither depends on the other.
        await Promise.all([
          !generateHybrid2 || !generateContinuousHybrid2
            ? loadScript("/favicons/animated/patterns.js")
            : null,
          !OptimizedHybrid2Renderer
            ? loadScript("/favicons/animated/renderer.js")
            : null,
        ]);
        if (cancelled) return;
        generateHybrid2 = (window as FaviconWindow).generateHybrid2;
        generateContinuousHybrid2 = (window as FaviconWindow)
          .generateContinuousHybrid2;
        OptimizedHybrid2Renderer = (window as FaviconWindow)
          .OptimizedHybrid2Renderer;

        if (
          !generateHybrid2 ||
          !generateContinuousHybrid2 ||
          !OptimizedHybrid2Renderer
        ) {
          throw new Error("Failed to load favicon animation modules");
        }

        // Set static favicon as fallback
        const setStaticFavicon = () => {
          if (!faviconLink) {
            const links = document.querySelectorAll(ICON_LINKS);
            if (links.length > 0) {
              faviconLink = links[0] as HTMLLinkElement;
            } else {
              faviconLink = document.createElement("link");
              faviconLink.type = "image/x-icon";
              faviconLink.rel = "icon";
              document.getElementsByTagName("head")[0].appendChild(faviconLink);
            }
          }

          // Use theme-appropriate static favicon
          const staticFavicon =
            theme === "dark" ? "/favicon-dark.png" : "/favicon-light.png";
          if (faviconLink) {
            faviconLink.href = staticFavicon;
          }
        };

        // Create canvas for favicon
        canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;

        // Generate initial pattern and create renderer with theme support
        // Use static pattern in low quality mode to save resources
        let patternData = isLowQuality
          ? { frames: generateHybrid2(), finalState: null, finalCascades: [] }
          : generateContinuousHybrid2(undefined, [], 12, 1);
        let pattern = patternData.frames;
        let finalState = patternData.finalState;
        let finalCascades = patternData.finalCascades;
        let generation = 1; // Track pattern evolution

        renderer = new OptimizedHybrid2Renderer(canvas, pattern, {
          theme: theme,
          highContrast: false,
        });

        let currentFrame = 0;
        // Quality-aware frame rate: low quality = 1fps, high quality = 3fps
        const fps = isLowQuality ? 1 : 3;
        const frameInterval = 1000 / fps;
        const pauseDuration = 3000; // 3 second pause between loops
        const totalFrames = pattern.length; // 12 frames for current pattern
        let isGeneratingNewPattern = false; // Prevent concurrent pattern generation

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        if (prefersReducedMotion) {
          // Set static favicon for users who prefer reduced motion
          setStaticFavicon();
          return;
        }

        // Set initial frame
        renderer.drawFrame(0);
        const initialDataUrl = canvas.toDataURL();

        // Update all favicon links
        const links = document.querySelectorAll(ICON_LINKS);
        links.forEach((link) => {
          (link as HTMLLinkElement).href = initialDataUrl;
        });

        // If no favicon links exist, create one
        if (links.length === 0) {
          const link = document.createElement("link");
          link.type = "image/x-icon";
          link.rel = "icon";
          link.href = initialDataUrl;
          document.getElementsByTagName("head")[0].appendChild(link);
        }

        // Update favicon function - render on demand
        const updateFavicon = () => {
          if (isPaused || !renderer || !canvas) {
            return;
          }

          // Render the current frame directly
          renderer.drawFrame(currentFrame);

          // Convert canvas to data URL and update all favicon links
          const dataUrl = canvas.toDataURL();

          // Update all favicon links
          const links = document.querySelectorAll(ICON_LINKS);
          links.forEach((link) => {
            (link as HTMLLinkElement).href = dataUrl;
          });

          // If no favicon links exist, create one
          if (links.length === 0) {
            const link = document.createElement("link");
            link.type = "image/x-icon";
            link.rel = "icon";
            link.href = dataUrl;
            document.getElementsByTagName("head")[0].appendChild(link);
          }

          // Frame update completed

          // Advance to next frame
          currentFrame++;

          // Check if we've completed a loop
          if (currentFrame >= totalFrames) {
            currentFrame = 0;
            isPaused = true;

            // Generate next pattern during pause (only in high quality mode)
            if (!isGeneratingNewPattern && !isLowQuality) {
              isGeneratingNewPattern = true;

              // Use setTimeout to avoid blocking the main thread
              setTimeout(() => {
                try {
                  // Generate evolved pattern from final state with generation number
                  patternData = generateContinuousHybrid2(
                    finalState || undefined,
                    finalCascades,
                    12,
                    generation + 1,
                  );

                  pattern = patternData.frames;
                  finalState = patternData.finalState;
                  finalCascades = patternData.finalCascades;
                  generation++;

                  // Update renderer pattern (memory optimized - reuse existing renderer)
                  if (renderer && renderer.updatePattern) {
                    renderer.updatePattern(pattern);
                  }
                } catch (error) {
                  logError(error, "animated-favicon-pattern-generation");
                  // Fallback to static pattern
                  pattern = generateHybrid2();
                  if (renderer && renderer.updatePattern) {
                    renderer.updatePattern(pattern);
                  }
                }
                isGeneratingNewPattern = false;
              }, 100); // Small delay to let UI settle
            }

            // Pause for a few seconds before starting the next loop
            pauseTimeout = setTimeout(() => {
              isPaused = false;
              pauseTimeout = null;
            }, pauseDuration);
          }
        };

        // Tick at the favicon's real frame rate (1-3fps) with setTimeout:
        // the previous requestAnimationFrame loop woke 60 times per second
        // only to skip ~95% of those on a frame-interval check.
        const animate = () => {
          if (!document.hidden && animationsPlaying()) {
            updateFavicon();
          }

          animationId = window.setTimeout(animate, frameInterval);
        };

        // Handle visibility change - animation continues but skips updates when hidden
        const handleVisibilityChange = () => {
          // Animation will automatically resume when tab becomes visible
          // No need to reset timing since we removed performance monitoring
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        // Start animation
        animate();

        // Store cleanup function
        cleanup = () => {
          if (animationId !== null) {
            window.clearTimeout(animationId);
            animationId = null;
          }
          if (pauseTimeout !== null) {
            clearTimeout(pauseTimeout);
            pauseTimeout = null;
          }
          document.removeEventListener(
            "visibilitychange",
            handleVisibilityChange,
          );
        };
      } catch (error) {
        if (cancelled) return;
        logError(error, "animated-favicon-load");
        // Fallback to static favicon
        const staticFavicon =
          theme === "dark" ? "/favicon-dark.png" : "/favicon-light.png";
        const links = document.querySelectorAll(ICON_LINKS);
        if (links.length > 0) {
          (links[0] as HTMLLinkElement).href = staticFavicon;
        } else {
          const fallbackLink = document.createElement("link");
          fallbackLink.type = "image/png";
          fallbackLink.rel = "icon";
          fallbackLink.href = staticFavicon;
          document.getElementsByTagName("head")[0].appendChild(fallbackLink);
        }
      }
    };

    loadFaviconAnimator();

    // Return cleanup function
    return () => {
      cancelled = true;
      if (cleanup) {
        cleanup();
      }
    };
  }, [theme, quality, isLowQuality]);

  return null; // This component doesn't render anything
}
