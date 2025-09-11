"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useBackground } from "@/contexts/background-context";
import {
  DEFAULT_SPIKING_CONFIG,
  getRandomInterval,
} from "@/lib/utils/neural-animations";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { validateRadius } from "@/lib/utils/svg-validation";
import { useAnimationState } from "@/contexts/animation-state-context";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useQuality, NEURAL_CANVAS_PROFILE } from "@/contexts/quality-context";
import { logWarning } from "@/lib/utils/dev-logger";

// Interface for icon concepts
interface IconConcept {
  id: string;
  icon: string;
  tooltip?: string;
  category?: string;
}

// Interface for text concepts
interface TextConcept {
  text: string;
  category?: string;
}

// Combined neural cloud concepts
interface NeuralCloudConcepts {
  iconConcepts: IconConcept[];
  textConcepts: TextConcept[];
}

interface SkillsNeuralCloudProps {
  concepts: NeuralCloudConcepts;
  className?: string;
  isVisible?: boolean;
  gridCellSize?: number;
  brainCenterX?: number; // Center X position of brain in pixels
  brainCenterY?: number; // Center Y position of brain in pixels
  exclusionRadius?: number; // Radius around brain to avoid (in pixels)
}

// Node type for internal representation
interface ConceptNode {
  type: "icon" | "text";
  content: IconConcept | TextConcept;
  gridX: number;
  gridY: number;
  nodeKey: string;
  isSpiking: boolean;
  nextSpikeTime: number;
}

// Get color based on category
const getCategoryColor = (category?: string): string => {
  switch (category) {
    case "technical":
      return "59, 130, 246"; // Blue
    case "evolution":
      return "139, 92, 246"; // Purple
    case "creative":
      return "34, 197, 94"; // Green
    case "warning":
      return "245, 158, 11"; // Amber
    default:
      return "107, 114, 128"; // Gray
  }
};

// Get Lucide icon component by name
const getIconComponent = (iconName: string): LucideIcon => {
  // Type assertion to access icons dynamically
  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  return icons[iconName] || LucideIcons.Code2;
};

// Calculate text width approximation
const calculateTextWidth = (text: string, fontSize: number): number => {
  const avgCharWidth = fontSize * 0.6;
  return text.length * avgCharWidth;
};

export function SkillsNeuralCloud({
  concepts,
  className,
  isVisible = true,
  gridCellSize = 64,
  brainCenterX,
  brainCenterY,
  exclusionRadius = 200,
}: SkillsNeuralCloudProps) {
  const { backgroundData } = useBackground();
  const { areAnimationsPlaying } = useAnimationState();
  const prefersReducedMotion = useReducedMotion();
  const { getConfig } = useQuality();
  const config = getConfig(NEURAL_CANVAS_PROFILE);
  const [conceptNodes, setConceptNodes] = useState<ConceptNode[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const animationFrameRef = useRef<number>();
  const conceptNodesRef = useRef<ConceptNode[]>([]);
  const [dimensions, setDimensions] = useState({ width: 1152, height: 768 });
  const spikeTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Keep ref in sync with state
  useEffect(() => {
    conceptNodesRef.current = conceptNodes;
  }, [conceptNodes]);

  // Update dimensions
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Map concepts to neural pattern nodes
  useEffect(() => {
    if (!backgroundData?.neuralPatterns || !concepts) return;

    // Helper function to check if a node is outside the brain exclusion zone
    const isNodeOutsideBrain = (gridX: number, gridY: number): boolean => {
      // If brain center is not defined, include all nodes
      if (brainCenterX === undefined || brainCenterY === undefined) {
        return true;
      }

      // Calculate pixel position of the node
      const nodeX = gridX * gridCellSize;
      const nodeY = gridY * gridCellSize;

      // Calculate distance from node to brain center
      const distance = Math.sqrt(
        Math.pow(nodeX - brainCenterX, 2) + Math.pow(nodeY - brainCenterY, 2),
      );

      // Return true if node is outside the exclusion radius
      return distance > exclusionRadius;
    };

    // Collect all unique node positions from neural patterns
    const nodePositions = new Map<string, { gridX: number; gridY: number }>();

    backgroundData.neuralPatterns.forEach((pattern) => {
      pattern.nodes.forEach((node) => {
        // Only add nodes that are outside the brain exclusion zone
        if (isNodeOutsideBrain(node.gridX, node.gridY)) {
          const key = `${node.gridX}-${node.gridY}`;
          if (!nodePositions.has(key)) {
            nodePositions.set(key, { gridX: node.gridX, gridY: node.gridY });
          }
        }
      });
    });

    // Convert to array and shuffle for random assignment
    const availableNodes = Array.from(nodePositions.entries());
    const shuffledNodes = availableNodes.sort(() => Math.random() - 0.5);

    // Calculate how many of each type to display (2/3 icons, 1/3 text)
    const totalSlots = shuffledNodes.length;
    const iconSlots = Math.floor(totalSlots * (2 / 3));
    const textSlots = totalSlots - iconSlots;

    // Shuffle icon concepts and text concepts separately
    const shuffledIconConcepts = [...concepts.iconConcepts].sort(
      () => Math.random() - 0.5,
    );
    const shuffledTextConcepts = [...concepts.textConcepts].sort(
      () => Math.random() - 0.5,
    );

    // Select the appropriate number of each type
    const selectedIconConcepts = shuffledIconConcepts
      .slice(0, Math.min(iconSlots, shuffledIconConcepts.length))
      .map((concept) => ({
        type: "icon" as const,
        content: concept,
      }));

    const selectedTextConcepts = shuffledTextConcepts
      .slice(0, Math.min(textSlots, shuffledTextConcepts.length))
      .map((concept) => ({
        type: "text" as const,
        content: concept,
      }));

    // Combine and shuffle the selected concepts for random distribution
    const conceptsToDisplay = [
      ...selectedIconConcepts,
      ...selectedTextConcepts,
    ].sort(() => Math.random() - 0.5);

    // Map the selected concepts to node positions
    const mappedConcepts: ConceptNode[] = conceptsToDisplay.map(
      (concept, index) => {
        const [nodeKey, position] = shuffledNodes[index];
        return {
          type: concept.type,
          content: concept.content,
          gridX: position.gridX,
          gridY: position.gridY,
          nodeKey,
          isSpiking: false,
          nextSpikeTime:
            Date.now() +
            getRandomInterval(
              DEFAULT_SPIKING_CONFIG.minInterval * 1000,
              DEFAULT_SPIKING_CONFIG.maxInterval * 1000,
            ),
        };
      },
    );

    setConceptNodes(mappedConcepts);
  }, [
    backgroundData,
    concepts,
    brainCenterX,
    brainCenterY,
    exclusionRadius,
    gridCellSize,
  ]);

  // Animation loop for spiking - only when animations are enabled
  useEffect(() => {
    // Store ref values at effect start for cleanup
    const timeouts = spikeTimeoutsRef.current;

    if (
      !isVisible ||
      !areAnimationsPlaying ||
      prefersReducedMotion ||
      !config.animate
    )
      return;

    const animate = () => {
      // Check if nodes exist using ref
      if (conceptNodesRef.current.length === 0) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      const now = Date.now();

      // Process nodes and schedule spike resets outside of state update
      const nodesToSpike: string[] = [];

      // Check if any nodes need to spike before updating state
      let hasChanges = false;
      conceptNodesRef.current.forEach((node) => {
        if (now >= node.nextSpikeTime && !node.isSpiking) {
          nodesToSpike.push(node.nodeKey);
          hasChanges = true;
        }
      });

      // Only update state if there are actual changes
      if (hasChanges) {
        setConceptNodes((prevNodes) => {
          return prevNodes.map((node) => {
            // Check if should spike
            if (now >= node.nextSpikeTime && !node.isSpiking) {
              return { ...node, isSpiking: true };
            }
            return node;
          });
        });
      }

      // Schedule spike resets outside of the state update
      nodesToSpike.forEach((nodeKey) => {
        // Clear any existing timeout for this node
        const existingTimeout = spikeTimeoutsRef.current.get(nodeKey);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        // Schedule new timeout
        const timeout = setTimeout(() => {
          setConceptNodes((nodes) =>
            nodes.map((n) =>
              n.nodeKey === nodeKey
                ? {
                    ...n,
                    isSpiking: false,
                    nextSpikeTime:
                      Date.now() +
                      getRandomInterval(
                        DEFAULT_SPIKING_CONFIG.minInterval * 1000,
                        DEFAULT_SPIKING_CONFIG.maxInterval * 1000,
                      ),
                  }
                : n,
            ),
          );
          // Remove timeout from ref map
          spikeTimeoutsRef.current.delete(nodeKey);
        }, DEFAULT_SPIKING_CONFIG.spikeDuration);

        // Store timeout reference
        spikeTimeoutsRef.current.set(nodeKey, timeout);
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Clear all spike timeouts on cleanup using stored ref value
      if (timeouts) {
        timeouts.forEach((timeout) => clearTimeout(timeout));
        timeouts.clear();
      }
    };
  }, [isVisible, areAnimationsPlaying, prefersReducedMotion, config.animate]);

  // Always render container to prevent hydration mismatch
  const shouldRenderContent = isVisible && conceptNodes.length > 0;

  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none overflow-hidden",
        className,
      )}
    >
      {/* Desktop: Concepts positioned on grid nodes */}
      <div className="hidden md:block relative w-full h-full">
        <svg
          width={dimensions.width}
          height={dimensions.height}
          className="absolute inset-0"
        >
          <defs>
            {/* Glow filter for spiking concepts */}
            <filter id="conceptGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {shouldRenderContent &&
            conceptNodes.map((node, index) => {
              const x = node.gridX * gridCellSize;
              const y = node.gridY * gridCellSize;

              // Validate coordinates
              if (
                typeof x !== "number" ||
                typeof y !== "number" ||
                isNaN(x) ||
                isNaN(y) ||
                !isFinite(x) ||
                !isFinite(y)
              ) {
                logWarning(
                  "SkillsNeuralCloud: Invalid node coordinates",
                  "skills-neural-cloud-coordinates",
                );
                return null;
              }

              const category =
                node.type === "icon"
                  ? (node.content as IconConcept).category
                  : (node.content as TextConcept).category;
              const color = getCategoryColor(category);
              const isHovered = hoveredIndex === index;

              // Ensure isSpiking is always a boolean and respect animation state
              const isSpiking = Boolean(
                node.isSpiking && areAnimationsPlaying && !prefersReducedMotion,
              );

              // Ensure isSpiking is always a boolean to prevent undefined issues

              // Calculate badge dimensions based on content
              const fontSize = isSpiking ? 11 : 9;
              const iconSize = 18;
              const padding = 8;

              let badgeWidth: number = 24; // Default width
              let badgeHeight: number = 20; // Ensure it's always a number
              let isCircular = false;

              if (node.type === "icon") {
                // Icon nodes are circular
                badgeWidth = 24;
                badgeHeight = 24;
                isCircular = true;
              } else {
                // Text nodes are rectangular
                const textContent = (node.content as TextConcept).text;
                badgeWidth =
                  calculateTextWidth(textContent, fontSize) + padding * 2;
                badgeHeight = 20; // Explicitly set for text nodes
              }

              // Scale up when spiking
              if (node.isSpiking && !isCircular) {
                badgeWidth *= 1.2;
              }

              // Ensure badgeHeight is valid
              if (
                !badgeHeight ||
                isNaN(badgeHeight) ||
                !isFinite(badgeHeight) ||
                badgeHeight <= 0
              ) {
                badgeHeight = 20; // Safe fallback
              }

              return (
                <g
                  key={`${node.nodeKey}-${index}`}
                  className="pointer-events-auto cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {/* Spike pulse effect - only when animations are enabled */}
                  {isSpiking &&
                    areAnimationsPlaying &&
                    !prefersReducedMotion &&
                    config.animate && (
                      <motion.circle
                        cx={x}
                        cy={y}
                        r={20}
                        fill={`rgba(${color}, 0.3)`}
                        initial={{ scale: 0.5, opacity: 0.8 }}
                        animate={{
                          scale: [0.5, 2, 2.5],
                          opacity: [0.8, 0.4, 0],
                        }}
                        transition={{
                          duration: DEFAULT_SPIKING_CONFIG.spikeDuration / 1000,
                          ease: "easeOut",
                        }}
                      />
                    )}

                  {/* Concept badge container - motion only when animations are enabled */}
                  {areAnimationsPlaying && !prefersReducedMotion ? (
                    <motion.g
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{
                        scale: isSpiking ? 1.3 : isHovered ? 1.1 : 1,
                        opacity: isSpiking ? 1 : isHovered ? 0.95 : 0.7,
                      }}
                      transition={{
                        scale: { type: "spring", stiffness: 300, damping: 20 },
                        opacity: { duration: 0.2 },
                      }}
                    >
                      {/* Badge background */}
                      {isCircular ? (
                        <circle
                          cx={x}
                          cy={y}
                          r={validateRadius("12", "12", "SkillsNeuralCloud", {
                            nodeKey: node.nodeKey,
                            isSpiking,
                          })}
                          fill={`rgba(${color}, ${isSpiking ? 0.2 : 0.1})`}
                          stroke={`rgba(${color}, ${isSpiking ? 0.8 : 0.4})`}
                          strokeWidth={isSpiking ? "2" : "1"}
                          filter={isSpiking ? "url(#conceptGlow)" : undefined}
                        />
                      ) : (
                        <rect
                          x={x - badgeWidth / 2}
                          y={y - badgeHeight / 2}
                          width={badgeWidth}
                          height={badgeHeight}
                          rx="10"
                          fill={`rgba(${color}, ${isSpiking ? 0.2 : 0.1})`}
                          stroke={`rgba(${color}, ${isSpiking ? 0.8 : 0.4})`}
                          strokeWidth={isSpiking ? "2" : "1"}
                          filter={isSpiking ? "url(#conceptGlow)" : undefined}
                        />
                      )}

                      {/* Content rendering */}
                      {node.type === "icon" &&
                        (() => {
                          const iconConcept = node.content as IconConcept;
                          const IconComponent = getIconComponent(
                            iconConcept.icon,
                          );
                          return (
                            <>
                              <g
                                transform={`translate(${x - iconSize / 2}, ${y - iconSize / 2})`}
                              >
                                <IconComponent
                                  width={iconSize}
                                  height={iconSize}
                                  color={`rgb(${color})`}
                                />
                              </g>
                              {/* Tooltip on hover */}
                              {isHovered && iconConcept.tooltip && (
                                <text
                                  x={x}
                                  y={y - 20}
                                  fill={`rgb(${color})`}
                                  fontSize="10"
                                  fontFamily="system-ui, -apple-system, sans-serif"
                                  fontWeight="600"
                                  textAnchor="middle"
                                  className="select-none"
                                >
                                  {iconConcept.tooltip}
                                </text>
                              )}
                            </>
                          );
                        })()}

                      {node.type === "text" && (
                        <text
                          x={x}
                          y={y + fontSize / 3}
                          fill={`rgb(${color})`}
                          fontSize={fontSize}
                          fontFamily="system-ui, -apple-system, sans-serif"
                          fontWeight={isSpiking ? "600" : "500"}
                          textAnchor="middle"
                          className="select-none"
                        >
                          {(node.content as TextConcept).text}
                        </text>
                      )}
                    </motion.g>
                  ) : (
                    <g style={{ opacity: 0.7 }}>
                      {/* Badge background */}
                      {isCircular ? (
                        <circle
                          cx={x}
                          cy={y}
                          r={validateRadius("12", "12", "SkillsNeuralCloud", {
                            nodeKey: node.nodeKey,
                            isSpiking,
                          })}
                          fill={`rgba(${color}, ${isSpiking ? 0.2 : 0.1})`}
                          stroke={`rgba(${color}, ${isSpiking ? 0.8 : 0.4})`}
                          strokeWidth={isSpiking ? "2" : "1"}
                          filter={isSpiking ? "url(#conceptGlow)" : undefined}
                        />
                      ) : (
                        <rect
                          x={x - badgeWidth / 2}
                          y={y - badgeHeight / 2}
                          width={badgeWidth}
                          height={badgeHeight}
                          rx="10"
                          fill={`rgba(${color}, ${isSpiking ? 0.2 : 0.1})`}
                          stroke={`rgba(${color}, ${isSpiking ? 0.8 : 0.4})`}
                          strokeWidth={isSpiking ? "2" : "1"}
                          filter={isSpiking ? "url(#conceptGlow)" : undefined}
                        />
                      )}

                      {/* Content rendering */}
                      {node.type === "icon" &&
                        (() => {
                          const iconConcept = node.content as IconConcept;
                          const IconComponent = getIconComponent(
                            iconConcept.icon,
                          );
                          return (
                            <>
                              <g
                                transform={`translate(${x - iconSize / 2}, ${y - iconSize / 2})`}
                              >
                                <IconComponent
                                  width={iconSize}
                                  height={iconSize}
                                  color={`rgb(${color})`}
                                />
                              </g>
                              {/* Tooltip on hover */}
                              {isHovered && iconConcept.tooltip && (
                                <text
                                  x={x}
                                  y={y - 20}
                                  fill={`rgb(${color})`}
                                  fontSize="10"
                                  fontFamily="system-ui, -apple-system, sans-serif"
                                  fontWeight="600"
                                  textAnchor="middle"
                                  className="select-none"
                                >
                                  {iconConcept.tooltip}
                                </text>
                              )}
                            </>
                          );
                        })()}

                      {node.type === "text" && (
                        <text
                          x={x}
                          y={y + fontSize / 3}
                          fill={`rgb(${color})`}
                          fontSize={fontSize}
                          fontFamily="system-ui, -apple-system, sans-serif"
                          fontWeight={isSpiking ? "600" : "500"}
                          textAnchor="middle"
                          className="select-none"
                        >
                          {(node.content as TextConcept).text}
                        </text>
                      )}
                    </g>
                  )}

                  {/* Invisible hit area for better interaction */}
                  <rect
                    x={x - 40}
                    y={y - 20}
                    width="80"
                    height="40"
                    fill="transparent"
                  />
                </g>
              );
            })}
        </svg>
      </div>
    </div>
  );
}
