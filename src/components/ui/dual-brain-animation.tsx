"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { m } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useMotionGate } from "@/lib/hooks/useMotionGate";
import { useAnimationState } from "@/contexts/animation-state-context";
import { useQuality, NEURAL_CANVAS_PROFILE } from "@/contexts/quality-context";
import { withLoadFallback } from "@/lib/utils/load-fallback";
import { logError } from "@/lib/utils/dev-logger";

// Fills the box it is given; each use below gives it the canvas's size.
const CanvasPlaceholder = () => (
  <div className="w-full h-full bg-transparent animate-pulse" />
);

// When the canvas's chunk cannot be fetched, each brain's box keeps its
// placeholder: React.lazy threw while rendering, and the page's error
// boundary (error.tsx) replaced everything under the navigation.
const BrainNetworkVisualization = dynamic(
  withLoadFallback(
    () =>
      import("@/components/ui/brain-network-visualization").then(
        (mod) => mod.BrainNetworkVisualization,
      ),
    CanvasPlaceholder,
    { onError: (error) => logError(error, "Brain canvas chunk") },
  ),
  { ssr: false, loading: CanvasPlaceholder },
);

interface DualBrainAnimationProps {
  className?: string;
  isVisible?: boolean;
  onBrainNodesReady?: (nodes: { x: number; y: number; id: string }[]) => void;
}

export function DualBrainAnimation({
  className,
  isVisible = true,
  onBrainNodesReady,
}: DualBrainAnimationProps) {
  const [isPulsing, setIsPulsing] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  // Each pulse animates the scale around both canvases for two seconds;
  // nothing should under the splash or a modal.
  const { suspended } = useMotionGate();
  const { areAnimationsPlaying } = useAnimationState();
  const { getConfig } = useQuality();
  const config = getConfig(NEURAL_CANVAS_PROFILE);
  const pulseIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  // Ends the current pulse. Cleared with the loop: left running, an older
  // one cut a newer pulse short after a quick stop and start, and could
  // fire after unmount.
  const pulseEndRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  // True while the loop has run and is only paused by an overlay or a
  // hidden tab, which the pulse never stopped for before: it then picks its
  // rhythm up again rather than pulsing the moment a modal closes. Showing
  // first, or scrolling back into view, still pulses at once.
  const pausedRef = useRef(false);

  // Synchronized pulsing effect
  useEffect(() => {
    if (
      !isVisible ||
      suspended ||
      prefersReducedMotion ||
      !areAnimationsPlaying ||
      !config.animate
    ) {
      if (!suspended) pausedRef.current = false;
      return;
    }
    const resuming = pausedRef.current;
    pausedRef.current = true;

    const startPulsing = () => {
      setIsPulsing(true);
      clearTimeout(pulseEndRef.current);
      pulseEndRef.current = setTimeout(() => setIsPulsing(false), 2000);
    };

    if (!resuming) startPulsing();
    pulseIntervalRef.current = setInterval(startPulsing, 8000);

    return () => {
      clearInterval(pulseIntervalRef.current);
      clearTimeout(pulseEndRef.current);
      // A pulse cut off here would hold the brains scaled up until the
      // next one ended.
      setIsPulsing(false);
    };
  }, [
    isVisible,
    suspended,
    prefersReducedMotion,
    areAnimationsPlaying,
    config.animate,
  ]);

  const swaying =
    !prefersReducedMotion && areAnimationsPlaying && config.animate;

  return (
    // data-anim pauses the sway (an .anim-decor CSS loop) while the hero is
    // off-screen.
    <div
      className={cn("relative", className)}
      data-anim={isVisible ? "on" : "off"}
    >
      {/* Background Brain - Large, faded, rotating */}
      <m.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }} // Always show, just control animations separately
        transition={{ duration: 1.5, delay: 0.5 }}
      >
        {/* will-change-transform: this wrapper scales on every pulse, and the
            one inside rotates forever; they contain a 600x600 canvas. Without
            the hint the whole subtree is re-rasterized on each animation frame
            instead of the compositor transforming one cached texture. */}
        <m.div
          className="relative w-[150%] h-[150%] flex items-center justify-center will-change-transform"
          animate={{
            scale:
              isPulsing && areAnimationsPlaying && config.animate ? 1.05 : 1,
          }}
          transition={{
            scale: {
              duration: 2,
              ease: "easeInOut",
            },
          }}
        >
          {/* The sway: -3deg to 3deg and back, 6 s each way, easeInOut, as a
              CSS animation on the compositor (motion.css, .anim-sway). It
              was a framer loop, which cannot hand rotation to the compositor
              and so ran on the main thread every frame. Nested inside the
              scale wrapper: a uniform scale and a rotation commute, so the
              transform is the same as framer's combined one. */}
          <div
            className={cn(
              "relative w-full h-full flex items-center justify-center will-change-transform",
              swaying && "anim-decor anim-sway",
            )}
          >
            {/* No blur here on purpose. A Gaussian blur is a low-pass filter
                and this is already a radial gradient at 2% alpha fading to
                transparent, so blur-3xl (64px) had almost nothing left to
                smooth. What it did cost was a 556x485 blur render pass that
                Chromium re-ran every time the brain canvas underneath it
                repainted. */}
            <div className="absolute inset-0 bg-gradient-radial from-purple-500/2 via-blue-500/2 to-transparent" />
            <BrainNetworkVisualization
              className="w-full h-full opacity-[0.05] dark:opacity-[0.08] dual-brain-background"
              width={600}
              height={600}
              isPulsing={isPulsing}
              opacity={0.5}
              interactive={false}
              showInternalConnections={false}
            />
          </div>
        </m.div>
      </m.div>

      {/* Primary Brain - Original positioning */}
      {/* Same reason as the background wrapper: the entry animation scales
          0.8 -> 1 over two seconds and each pulse scales it again, over a
          subtree holding a 300x300 canvas and a 40px-blur glow. */}
      <m.div
        className="relative z-10 will-change-transform"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: 1, // Always show the brain
          scale: areAnimationsPlaying ? (isPulsing ? 1.02 : 1) : 1, // Static scale when animations off
        }}
        transition={{
          opacity: { duration: 0.8 },
          scale: { duration: 2, ease: "easeInOut" },
        }}
      >
        <div className="relative">
          {/* Glow effect for primary brain */}
          <m.div
            className="absolute inset-0 blur-2xl"
            animate={{
              opacity: isPulsing ? 0.8 : 0.4,
            }}
            transition={{ duration: 2 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full" />
          </m.div>

          {/* Main brain animation, in a box of the canvas's final size. The
              loading placeholder used to be a square up to 512 px, so the
              hero's brain column shrank to 300 px when the canvas arrived. */}
          <div className="w-full max-w-[200px] sm:max-w-[250px] lg:max-w-[300px] mx-auto aspect-square">
            <BrainNetworkVisualization
              className="w-full max-w-[200px] sm:max-w-[250px] lg:max-w-[300px] mx-auto dual-brain-primary"
              width={300}
              height={300}
              isPulsing={isPulsing}
              opacity={1}
              interactive={true}
              onNodesReady={onBrainNodesReady}
            />
          </div>
        </div>
      </m.div>

      {/* Mobile-only simplified version */}
      <div className="md:hidden">
        {/* On mobile, we only show the primary brain without the background effect */}
      </div>
    </div>
  );
}
