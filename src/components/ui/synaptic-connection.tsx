"use client";

import { motion, MotionValue } from "framer-motion";
import { ResearchNodeData } from "./research-node";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useAnimationState } from "@/contexts/animation-state-context";
import { useQuality, NEURAL_SIGNAL_PROFILE } from "@/contexts/quality-context";
import { logWarning } from "@/lib/utils/dev-logger";

interface SynapticConnectionProps {
  startNode: ResearchNodeData;
  endNode: ResearchNodeData;
  strength: number; // 0-1, based on citation relationship strength
  isActive: boolean;
  isHighlighted: boolean;
  gradientId: string;
  animationProgress?: MotionValue<number>;
  bidirectional?: boolean;
  autoActive?: boolean; // Allow particles to show automatically without user interaction
}

export function SynapticConnection({
  startNode,
  endNode,
  strength = 0.5,
  isActive,
  isHighlighted,
  gradientId,
  bidirectional = false,
  autoActive = false,
}: SynapticConnectionProps) {
  const [particles, setParticles] = useState<
    { id: number; progress: number }[]
  >([]);

  const prefersReducedMotion = useReducedMotion();
  const { areAnimationsPlaying } = useAnimationState();
  const { getConfig } = useQuality();
  const config = getConfig(NEURAL_SIGNAL_PROFILE);

  // All hooks must be called before any early returns
  // Generate synaptic particles for active connections (either user-activated or auto-active)
  useEffect(() => {
    if (
      (!isActive && !autoActive) ||
      !areAnimationsPlaying ||
      prefersReducedMotion ||
      !config.animate
    ) {
      setParticles([]);
      return;
    }

    const interval = setInterval(() => {
      setParticles((prev) => {
        // Add new particle
        const newParticles = [...prev];
        if (newParticles.length < 3) {
          // Generate more unique IDs to prevent duplicate key errors
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 15);
          newParticles.push({
            id: parseFloat(`${timestamp}.${random.replace(/\D/g, "")}`),
            progress: 0,
          });
        }

        // Update particle positions and remove completed ones
        return newParticles
          .map((p) => ({ ...p, progress: p.progress + 0.02 }))
          .filter((p) => p.progress <= 1);
      });
    }, 50);

    return () => clearInterval(interval);
  }, [
    isActive,
    autoActive,
    areAnimationsPlaying,
    prefersReducedMotion,
    config.animate,
  ]);

  // Validate node positions
  if (
    !startNode ||
    !endNode ||
    typeof startNode.x !== "number" ||
    typeof startNode.y !== "number" ||
    typeof endNode.x !== "number" ||
    typeof endNode.y !== "number" ||
    isNaN(startNode.x) ||
    isNaN(startNode.y) ||
    isNaN(endNode.x) ||
    isNaN(endNode.y)
  ) {
    logWarning(
      "SynapticConnection: Invalid node positions",
      "synaptic-connection-validation",
    );
    return null;
  }

  // Calculate control points for organic bezier curve
  const deltaX = endNode.x - startNode.x;
  const deltaY = endNode.y - startNode.y;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  // Prevent division by zero and handle edge cases
  const safeDistance = Math.max(distance, 0.001);

  // Create more organic curves based on node positions
  const curveFactor = Math.min(0.3, 100 / safeDistance);
  const perpX = -deltaY * curveFactor;
  const perpY = deltaX * curveFactor;

  // Add some randomness for more organic feel
  const wobble = Math.sin(startNode.x + endNode.y) * 20;

  const controlPoint1X = startNode.x + deltaX * 0.3 + perpX + wobble;
  const controlPoint1Y = startNode.y + deltaY * 0.3 + perpY;
  const controlPoint2X = endNode.x - deltaX * 0.3 + perpX - wobble;
  const controlPoint2Y = endNode.y - deltaY * 0.3 + perpY;

  // Validate control points
  if (
    isNaN(controlPoint1X) ||
    isNaN(controlPoint1Y) ||
    isNaN(controlPoint2X) ||
    isNaN(controlPoint2Y)
  ) {
    logWarning(
      "SynapticConnection: Invalid control points calculated",
      "synaptic-connection-control-points",
    );
    return null;
  }

  // Generate SVG path
  const pathData = `
    M ${startNode.x} ${startNode.y}
    C ${controlPoint1X} ${controlPoint1Y},
      ${controlPoint2X} ${controlPoint2Y},
      ${endNode.x} ${endNode.y}
  `;

  // Calculate arrow position and angle for directional connections
  const arrowT = 0.95; // Position along path (near end)
  const arrowX =
    Math.pow(1 - arrowT, 3) * startNode.x +
    3 * Math.pow(1 - arrowT, 2) * arrowT * controlPoint1X +
    3 * (1 - arrowT) * Math.pow(arrowT, 2) * controlPoint2X +
    Math.pow(arrowT, 3) * endNode.x;
  const arrowY =
    Math.pow(1 - arrowT, 3) * startNode.y +
    3 * Math.pow(1 - arrowT, 2) * arrowT * controlPoint1Y +
    3 * (1 - arrowT) * Math.pow(arrowT, 2) * controlPoint2Y +
    Math.pow(arrowT, 3) * endNode.y;

  // Calculate tangent angle at arrow position
  const t = arrowT;
  const dx =
    3 * Math.pow(1 - t, 2) * (controlPoint1X - startNode.x) +
    6 * (1 - t) * t * (controlPoint2X - controlPoint1X) +
    3 * Math.pow(t, 2) * (endNode.x - controlPoint2X);
  const dy =
    3 * Math.pow(1 - t, 2) * (controlPoint1Y - startNode.y) +
    6 * (1 - t) * t * (controlPoint2Y - controlPoint1Y) +
    3 * Math.pow(t, 2) * (endNode.y - controlPoint2Y);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <g>
      {/* Define gradient for this connection */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={startNode.color} stopOpacity={0.8} />
          <stop offset="100%" stopColor={endNode.color} stopOpacity={0.8} />
        </linearGradient>

        {/* Glow filter */}
        <filter id={`glow-${gradientId}`}>
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background path (always visible) */}
      <motion.path
        d={pathData}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={Math.max(1, strength * 3)}
        strokeLinecap="round"
        opacity={0.2}
        initial={{
          pathLength:
            areAnimationsPlaying && !prefersReducedMotion && config.animate
              ? 0
              : 1,
        }}
        animate={{ pathLength: 1 }}
        transition={{
          duration:
            areAnimationsPlaying && !prefersReducedMotion && config.animate
              ? 1
              : 0,
          delay:
            areAnimationsPlaying && !prefersReducedMotion && config.animate
              ? 0.5
              : 0,
        }}
      />

      {/* Active/highlighted path */}
      <motion.path
        d={pathData}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={isHighlighted ? strength * 4 : strength * 2}
        strokeLinecap="round"
        opacity={isActive || isHighlighted || autoActive ? 0.6 : 0}
        initial={{
          pathLength:
            (isActive || isHighlighted || autoActive) &&
            areAnimationsPlaying &&
            !prefersReducedMotion &&
            config.animate
              ? 0
              : 1,
        }}
        animate={{
          opacity: isActive || isHighlighted || autoActive ? 0.6 : 0,
          strokeWidth: isHighlighted ? strength * 4 : strength * 2,
          pathLength: 1,
        }}
        transition={{
          opacity: { duration: 0.3 },
          strokeWidth: { duration: 0.3 },
          pathLength: {
            duration:
              (isActive || isHighlighted || autoActive) &&
              areAnimationsPlaying &&
              !prefersReducedMotion &&
              config.animate
                ? 0.8
                : 0,
            delay:
              (isActive || isHighlighted || autoActive) &&
              areAnimationsPlaying &&
              !prefersReducedMotion &&
              config.animate
                ? 0.2
                : 0,
          },
        }}
        filter={isHighlighted ? `url(#glow-${gradientId})` : undefined}
      />

      {/* Directional arrow */}
      {!bidirectional && (isActive || isHighlighted || autoActive) && (
        <motion.polygon
          points="-4,-2 4,0 -4,2"
          fill={endNode.color}
          opacity={0.8}
          transform={`translate(${arrowX}, ${arrowY}) rotate(${angle})`}
          initial={{ scale: 0 }}
          animate={{ scale: isActive || isHighlighted || autoActive ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
      )}

      {/* Synaptic signal particles */}
      {particles.map((particle) => {
        // Calculate position along bezier curve
        const t = particle.progress;
        const x =
          Math.pow(1 - t, 3) * startNode.x +
          3 * Math.pow(1 - t, 2) * t * controlPoint1X +
          3 * (1 - t) * Math.pow(t, 2) * controlPoint2X +
          Math.pow(t, 3) * endNode.x;
        const y =
          Math.pow(1 - t, 3) * startNode.y +
          3 * Math.pow(1 - t, 2) * t * controlPoint1Y +
          3 * (1 - t) * Math.pow(t, 2) * controlPoint2Y +
          Math.pow(t, 3) * endNode.y;

        // Validate particle position
        if (isNaN(x) || isNaN(y)) {
          logWarning(
            "SynapticConnection: Invalid particle position",
            "synaptic-connection-particle",
          );
          return null;
        }

        return (
          <motion.circle
            key={particle.id}
            r={3}
            fill={`url(#${gradientId})`}
            opacity={0.8}
            cx={x}
            cy={y}
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.5, 1, 0] }}
            transition={{ duration: 2, times: [0, 0.1, 0.9, 1] }}
          >
            {/* Particle glow */}
            <animate
              attributeName="r"
              values="3;5;3"
              dur="1s"
              repeatCount="indefinite"
            />
          </motion.circle>
        );
      })}

      {/* Pulse effect on active connections */}
      {isActive &&
        areAnimationsPlaying &&
        !prefersReducedMotion &&
        config.animate && (
          <motion.path
            d={pathData}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strength * 6}
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.3, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            filter={`url(#glow-${gradientId})`}
          />
        )}
    </g>
  );
}
