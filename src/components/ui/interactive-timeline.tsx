"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useAnimationState } from "@/contexts/animation-state-context";
import { useQuality, NEURAL_CANVAS_PROFILE } from "@/contexts/quality-context";

export interface TimelineNode {
  id: string;
  y: number;
  color: string;
}

interface InteractiveTimelineProps {
  nodes: TimelineNode[];
  activeNodeId: string | null;
  onNodeHover: (id: string | null) => void;
}

export function InteractiveTimeline({
  nodes,
  activeNodeId,
  onNodeHover,
}: InteractiveTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(48);
  const prefersReducedMotion = useReducedMotion();
  const { areAnimationsPlaying } = useAnimationState();
  const { getConfig } = useQuality();
  const config = getConfig(NEURAL_CANVAS_PROFILE);

  useEffect(() => {
    if (containerRef.current) {
      setWidth(containerRef.current.offsetWidth);
    }
  }, []);

  return (
    <div ref={containerRef} className="relative w-12 h-full ml-4 sm:ml-8">
      {/* Dynamic Connections (Axons/Dendrites) */}
      <svg
        width={width}
        height="100%"
        className="absolute top-0 left-0 pointer-events-none"
      >
        {nodes.map((node, index) => {
          const nextNode = nodes[index + 1];

          if (!nextNode) return null;

          // Draw a subtle background connection with fluctuating opacity
          return (
            <motion.line
              key={`conn-${node.id}`}
              x1={width / 2}
              y1={node.y}
              x2={width / 2}
              y2={nextNode.y}
              stroke="#374151"
              strokeWidth="1"
              initial={{ opacity: 0.3 }}
              animate={
                areAnimationsPlaying && !prefersReducedMotion && config.animate
                  ? { opacity: [0.3, 0.4, 0.3] }
                  : { opacity: 0.3 }
              }
              transition={{
                duration: 5 + Math.random() * 5,
                repeat:
                  areAnimationsPlaying &&
                  !prefersReducedMotion &&
                  config.animate
                    ? Infinity
                    : 0,
                repeatType: "mirror",
              }}
            />
          );
        })}

        {/* Active Connection Pulse */}
        {nodes.map((node, index) => {
          const isActive = activeNodeId === node.id;
          const nextNode = nodes[index + 1];

          if (!nextNode) return null;

          return (
            <motion.line
              key={`pulse-${node.id}`}
              x1={width / 2}
              y1={node.y}
              x2={width / 2}
              y2={nextNode.y}
              stroke={node.color}
              strokeWidth="2"
              initial={{
                pathLength:
                  areAnimationsPlaying &&
                  !prefersReducedMotion &&
                  config.animate
                    ? 0
                    : 1,
                opacity: 0,
              }}
              animate={
                isActive
                  ? {
                      pathLength: 1,
                      opacity: 1,
                    }
                  : {
                      pathLength:
                        areAnimationsPlaying &&
                        !prefersReducedMotion &&
                        config.animate
                          ? 0
                          : 1,
                      opacity: 0,
                    }
              }
              transition={{
                duration:
                  areAnimationsPlaying &&
                  !prefersReducedMotion &&
                  config.animate
                    ? 0.5
                    : 0,
                ease: "easeInOut",
              }}
            />
          );
        })}
      </svg>

      {/* Synaptic Nodes */}
      {nodes.map((node) => {
        return (
          <div
            key={node.id}
            className="absolute"
            style={{
              top: `${node.y}px`,
              left: `${width / 2}px`,
              transform: "translate(-50%, -50%)",
            }}
            onMouseEnter={() => onNodeHover(node.id)}
            onMouseLeave={() => onNodeHover(null)}
          >
            {/* Connector to Card (Organic Tendril) */}
            <motion.div
              className="absolute left-full top-1/2 h-0.5 w-8 sm:w-16 bg-gray-700 opacity-50"
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: activeNodeId === node.id ? 1 : 0 }}
              transition={{
                duration:
                  areAnimationsPlaying &&
                  !prefersReducedMotion &&
                  config.animate
                    ? 0.3
                    : 0,
              }}
            />

            {/* Node (Synapse) */}
            <motion.div
              className="relative w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-background border-2"
              style={{ borderColor: node.color }}
              animate={
                areAnimationsPlaying && !prefersReducedMotion && config.animate
                  ? {
                      scale:
                        activeNodeId === node.id ? [1, 1.6, 1] : [1, 1.05, 1],
                      x: [0, Math.random() * 5 - 2.5, 0],
                      y: [0, Math.random() * 5 - 2.5, 0],
                    }
                  : {
                      scale: activeNodeId === node.id ? 1.6 : 1,
                      x: 0,
                      y: 0,
                    }
              }
              transition={
                areAnimationsPlaying && !prefersReducedMotion && config.animate
                  ? {
                      duration:
                        activeNodeId === node.id ? 0.5 : 2 + Math.random() * 2,
                      repeat: Infinity,
                      repeatType: "mirror",
                      x: {
                        duration: 2 + Math.random() * 3,
                        repeat: Infinity,
                        repeatType: "mirror",
                      },
                      y: {
                        duration: 2 + Math.random() * 3,
                        repeat: Infinity,
                        repeatType: "mirror",
                      },
                    }
                  : {
                      duration: 0,
                      repeat: 0,
                    }
              }
            />

            {/* Synapse Glow */}
            <motion.div
              className="absolute inset-0 rounded-full blur-md"
              style={{ backgroundColor: node.color }}
              animate={
                areAnimationsPlaying && !prefersReducedMotion && config.animate
                  ? {
                      opacity:
                        activeNodeId === node.id
                          ? [0.9, 1.2, 0.9]
                          : [0.3, 0.4, 0.3],
                      scale:
                        activeNodeId === node.id
                          ? [0.8, 1.8, 0.8]
                          : [0.8, 0.9, 0.8],
                    }
                  : {
                      opacity: activeNodeId === node.id ? 1.2 : 0.4,
                      scale: activeNodeId === node.id ? 1.8 : 0.9,
                    }
              }
              transition={
                areAnimationsPlaying && !prefersReducedMotion && config.animate
                  ? {
                      duration:
                        activeNodeId === node.id ? 0.5 : 2 + Math.random() * 2,
                      repeat: Infinity,
                      repeatType: "mirror",
                    }
                  : {
                      duration: 0,
                      repeat: 0,
                    }
              }
            />
          </div>
        );
      })}
    </div>
  );
}
