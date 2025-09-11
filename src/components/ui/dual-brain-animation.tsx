"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useAnimationState } from "@/contexts/animation-state-context";
import { useQuality, NEURAL_CANVAS_PROFILE } from "@/contexts/quality-context";

const BrainNetworkVisualization = dynamic(
  () =>
    import("@/components/ui/brain-network-visualization").then(
      (mod) => mod.BrainNetworkVisualization,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full max-w-lg mx-auto aspect-square bg-transparent animate-pulse" />
    ),
  },
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
  const { areAnimationsPlaying } = useAnimationState();
  const { getConfig } = useQuality();
  const config = getConfig(NEURAL_CANVAS_PROFILE);
  const pulseIntervalRef = useRef<NodeJS.Timeout>();

  // Synchronized pulsing effect
  useEffect(() => {
    if (
      !isVisible ||
      prefersReducedMotion ||
      !areAnimationsPlaying ||
      !config.animate
    )
      return;

    const startPulsing = () => {
      setIsPulsing(true);
      setTimeout(() => setIsPulsing(false), 2000);
    };

    // Initial pulse
    startPulsing();

    // Set up interval for regular pulsing
    pulseIntervalRef.current = setInterval(() => {
      startPulsing();
    }, 8000);

    return () => {
      if (pulseIntervalRef.current) {
        clearInterval(pulseIntervalRef.current);
      }
    };
  }, [isVisible, prefersReducedMotion, areAnimationsPlaying, config.animate]);

  return (
    <div className={cn("relative", className)}>
      {/* Background Brain - Large, faded, rotating */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }} // Always show, just control animations separately
        transition={{ duration: 1.5, delay: 0.5 }}
      >
        <motion.div
          className="relative w-[150%] h-[150%] flex items-center justify-center"
          animate={{
            rotate:
              prefersReducedMotion || !areAnimationsPlaying || !config.animate
                ? 0
                : [-3, 3],
            scale:
              isPulsing && areAnimationsPlaying && config.animate ? 1.05 : 1,
          }}
          transition={{
            rotate: {
              duration: 6,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "reverse",
            },
            scale: {
              duration: 2,
              ease: "easeInOut",
            },
          }}
        >
          <div className="absolute inset-0 bg-gradient-radial from-purple-500/2 via-blue-500/2 to-transparent blur-3xl" />
          <BrainNetworkVisualization
            className="w-full h-full opacity-[0.05] dark:opacity-[0.08] dual-brain-background"
            width={600}
            height={600}
            isPulsing={isPulsing}
            opacity={0.5}
            interactive={false}
            showInternalConnections={false}
          />
        </motion.div>
      </motion.div>

      {/* Primary Brain - Original positioning */}
      <motion.div
        className="relative z-10"
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
          <motion.div
            className="absolute inset-0 blur-2xl"
            animate={{
              opacity: isPulsing ? 0.8 : 0.4,
            }}
            transition={{ duration: 2 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-full" />
          </motion.div>

          {/* Main brain animation */}
          <BrainNetworkVisualization
            className="w-full max-w-[200px] sm:max-w-[250px] lg:max-w-[300px] mx-auto dual-brain-primary"
            width={300}
            height={300}
            isPulsing={isPulsing}
            opacity={1}
            interactive={true}
            onNodesReady={onBrainNodesReady}
          />

          {/* Neural connection effect */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: -1 }}
          >
            <defs>
              <linearGradient
                id="neural-gradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop
                  offset="0%"
                  stopColor="rgb(59, 130, 246)"
                  stopOpacity="0.3"
                >
                  <animate
                    attributeName="stop-opacity"
                    values="0.3;0.6;0.3"
                    dur="4s"
                    repeatCount="indefinite"
                  />
                </stop>
                <stop
                  offset="100%"
                  stopColor="rgb(139, 92, 246)"
                  stopOpacity="0.3"
                >
                  <animate
                    attributeName="stop-opacity"
                    values="0.3;0.6;0.3"
                    dur="4s"
                    repeatCount="indefinite"
                    begin="2s"
                  />
                </stop>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </motion.div>

      {/* Mobile-only simplified version */}
      <div className="md:hidden">
        {/* On mobile, we only show the primary brain without the background effect */}
      </div>
    </div>
  );
}
