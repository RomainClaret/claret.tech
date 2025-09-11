"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useQuality, NEURAL_SIGNAL_PROFILE } from "@/contexts/quality-context";

interface NeuralSignalProps {
  path: string; // SVG path string
  duration: number; // Animation duration in seconds
  color?: string; // RGB color string
  intensity?: number; // 0-1 opacity
  onComplete?: () => void;
  className?: string;
}

export function NeuralSignal({
  path,
  duration,
  color = "59, 130, 246", // Default blue
  intensity = 0.8,
  onComplete,
  className,
}: NeuralSignalProps) {
  const [pathLength, setPathLength] = useState(0);
  const [uniqueId] = useState(
    () => `signal-${Math.random().toString(36).substr(2, 9)}`,
  );

  const { getConfig } = useQuality();
  const config = getConfig(NEURAL_SIGNAL_PROFILE);

  useEffect(() => {
    // Calculate path length for animation
    const tempPath = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    tempPath.setAttribute("d", path);
    const length = tempPath.getTotalLength();
    setPathLength(length);
  }, [path]);

  // Handle static signal completion callback
  // Always call hook to avoid conditional hook calls (React rules of hooks)
  useEffect(() => {
    if (!config.animate && onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, 100); // Short delay to simulate signal travel
      return () => clearTimeout(timer);
    }
  }, [config.animate, onComplete]);

  // CRITICAL: Always render something, even if path length calculation is pending
  // For graceful degradation: render static fallback immediately if animations disabled
  if (!config.animate) {
    return (
      <g className={cn("pointer-events-none signal-static", className)}>
        <path
          d={path}
          fill="none"
          stroke={`rgba(${color}, ${intensity * (config.opacity || 0.7)})`}
          strokeWidth={config.strokeWidth || 2}
          strokeLinecap="round"
          style={{ opacity: config.opacity || 0.7 }}
        />
      </g>
    );
  }

  // For animated signals, wait for path length calculation
  if (pathLength === 0) return null;

  // Apply effects based on quality level
  const hasGlow = config.effects?.includes("glow");
  const hasBlur = config.effects?.includes("blur");
  const hasRainbow = config.effects?.includes("rainbow");
  const showParticles = (config.particleCount || 0) > 0;
  const strokeWidth = config.strokeWidth || 4;
  const signalOpacity = config.opacity || 0.8;

  return (
    <g className={cn("pointer-events-none signal-animation", className)}>
      <defs>
        {hasRainbow ? (
          <linearGradient id={`signal-gradient-${uniqueId}`}>
            <stop offset="0%" stopColor="rgba(255, 0, 255, 0)" />
            <stop
              offset="16%"
              stopColor={`rgba(255, 0, 255, ${signalOpacity})`}
            />
            <stop
              offset="33%"
              stopColor={`rgba(0, 255, 255, ${signalOpacity})`}
            />
            <stop
              offset="50%"
              stopColor={`rgba(255, 255, 0, ${signalOpacity})`}
            />
            <stop
              offset="66%"
              stopColor={`rgba(255, 0, 0, ${signalOpacity})`}
            />
            <stop
              offset="83%"
              stopColor={`rgba(0, 255, 0, ${signalOpacity})`}
            />
            <stop offset="100%" stopColor="rgba(0, 0, 255, 0)" />
          </linearGradient>
        ) : (
          <linearGradient id={`signal-gradient-${uniqueId}`}>
            <stop offset="0%" stopColor={`rgba(${color}, 0)`} />
            <stop
              offset="30%"
              stopColor={`rgba(${color}, ${intensity * signalOpacity * 0.5})`}
            />
            <stop
              offset="50%"
              stopColor={`rgba(${color}, ${intensity * signalOpacity})`}
            />
            <stop
              offset="70%"
              stopColor={`rgba(${color}, ${intensity * signalOpacity * 0.5})`}
            />
            <stop offset="100%" stopColor={`rgba(${color}, 0)`} />
          </linearGradient>
        )}

        {hasGlow && (
          <filter id={`signal-glow-${uniqueId}`}>
            <feGaussianBlur
              stdDeviation={hasBlur ? "6" : "3"}
              result="coloredBlur"
            />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* Signal trail */}
      <motion.path
        d={path}
        fill="none"
        stroke={`url(#signal-gradient-${uniqueId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        filter={hasGlow ? `url(#signal-glow-${uniqueId})` : "none"}
        initial={{
          pathLength: 0,
          opacity: 0,
        }}
        animate={{
          pathLength: 1,
          opacity: [0, signalOpacity, signalOpacity, 0],
        }}
        transition={{
          pathLength: {
            duration: duration,
            ease: "easeInOut",
          },
          opacity: {
            duration: duration,
            times: [0, 0.1, 0.9, 1],
          },
        }}
        onAnimationComplete={onComplete}
      />

      {/* Multiple particles for maximum quality */}
      {showParticles &&
        Array.from({ length: config.particleCount || 1 }, (_, i) => (
          <circle
            key={i}
            r={hasRainbow ? "4" : "3"}
            fill={
              hasRainbow ? `url(#signal-gradient-${uniqueId})` : `rgb(${color})`
            }
            filter={hasGlow ? `url(#signal-glow-${uniqueId})` : "none"}
          >
            <animateMotion
              dur={`${duration + i * 0.1}s`}
              repeatCount="1"
              fill="freeze"
              begin={`${i * 0.05}s`}
            >
              <mpath href={`#path-${uniqueId}`} />
            </animateMotion>
            <animate
              attributeName="r"
              values={hasRainbow ? "4;7;4" : "3;5;3"}
              dur="0.4s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values={`0;${signalOpacity};${signalOpacity};0`}
              dur={`${duration + i * 0.1}s`}
              repeatCount="1"
            />
          </circle>
        ))}

      {/* Hidden path for animateMotion reference - only needed for particles */}
      {showParticles && (
        <path
          id={`path-${uniqueId}`}
          d={path}
          fill="none"
          stroke="none"
          style={{ display: "none" }}
        />
      )}
    </g>
  );
}

interface StraightSignalProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
  color?: string;
  intensity?: number;
  onComplete?: () => void;
  className?: string;
}

export function StraightSignal({
  startX,
  startY,
  endX,
  endY,
  duration,
  color = "59, 130, 246",
  intensity = 0.8,
  onComplete,
  className,
}: StraightSignalProps) {
  const path = `M${startX},${startY} L${endX},${endY}`;

  return (
    <NeuralSignal
      path={path}
      duration={duration}
      color={color}
      intensity={intensity}
      onComplete={onComplete}
      className={className}
    />
  );
}
