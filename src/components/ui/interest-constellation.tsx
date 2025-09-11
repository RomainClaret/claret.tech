"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useAnimationState } from "@/contexts/animation-state-context";
import { getTechIcon } from "@/components/icons";

interface Interest {
  interestName: string;
  fontAwesomeClassname: string;
}

interface BrainNodePosition {
  x: number;
  y: number;
  id: string;
}

interface InterestConstellationProps {
  interests: Interest[];
  className?: string;
  isVisible?: boolean;
  usePartialArc?: boolean; // When true, avoids top area for mobile layout
  brainNodes?: BrainNodePosition[]; // Optional brain node positions for connections
}

// Map interests to colors based on their theme
const getInterestColor = (interestName: string): string => {
  const colorMap: { [key: string]: string } = {
    "Artificial Life": "34, 197, 94", // Green
    "Bio-Inspired": "34, 197, 94", // Green
    Neuroevolution: "139, 92, 246", // Purple
    "Evolutionary Computation": "139, 92, 246", // Purple
    "Open-Endedness": "59, 130, 246", // Blue
    Space: "59, 130, 246", // Blue
  };
  return colorMap[interestName] || "107, 114, 128";
};

// Find the nearest brain node to a given position
const findNearestBrainNode = (
  interestX: number,
  interestY: number,
  brainNodes: BrainNodePosition[] | undefined,
): { x: number; y: number } => {
  // If no brain nodes provided, default to center
  if (!brainNodes || brainNodes.length === 0) {
    return { x: 0, y: 0 };
  }

  let nearestNode = brainNodes[0];
  let minDistance = Infinity;

  for (const node of brainNodes) {
    const distance = Math.sqrt(
      Math.pow(node.x - interestX, 2) + Math.pow(node.y - interestY, 2),
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearestNode = node;
    }
  }

  return { x: nearestNode.x, y: nearestNode.y };
};

// Calculate orbital positions for desktop (around the animation)
const getDesktopPosition = (
  index: number,
  total: number,
  radius: number,
  usePartialArc: boolean = false,
) => {
  let angle: number;

  if (usePartialArc) {
    // Partial arc mode: distribute avoiding top area
    // excludedAngle defines how much of the top to avoid (in degrees)
    const excludedAngleDegrees = 110; // Configurable: degrees to exclude at top (centered)
    const excludedAngleRadians = (excludedAngleDegrees * Math.PI) / 180;

    // Calculate start and end angles based on excluded top angle
    // Top is at -90° (-π/2), so we exclude half on each side
    const topAngle = -Math.PI / 2; // -90 degrees (top)
    const startAngle = topAngle + excludedAngleRadians / 2; // Start after excluded area

    // Calculate the available arc span
    const arcSpan = 2 * Math.PI - excludedAngleRadians;

    // Distribute nodes evenly across the available arc
    angle = startAngle + (index * arcSpan) / (total - 1);
  } else {
    // Full circle mode (default)
    angle = (index * 2 * Math.PI) / total - Math.PI / 2; // Start from top

    // Add offset for top and bottom nodes to avoid perfect vertical alignment
    const angleOffset = Math.PI / 180; // 1 degree in radians

    // Check if this is close to top position (first node, around -90 degrees)
    if (index === 0) {
      angle += angleOffset; // Shift top node 1° clockwise
    }

    // Check if this is close to bottom position (for 6 nodes, it's index 3)
    if (total === 6 && index === 3) {
      angle += angleOffset; // Shift bottom node 1° clockwise
    }
  }

  const centerX = 0;
  const centerY = 0;

  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle),
    angle: angle,
  };
};

// Measure actual text dimensions using canvas
const measureText = (
  text: string,
  fontSize: number,
  fontWeight: string = "600",
) => {
  if (typeof window === "undefined") {
    // Fallback for SSR
    return {
      width: text.length * fontSize * 0.6,
      height: fontSize * 1.2,
    };
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      width: text.length * fontSize * 0.6,
      height: fontSize * 1.2,
    };
  }

  // Set the exact font that will be used in the SVG
  ctx.font = `${fontWeight} ${fontSize}px system-ui, -apple-system, sans-serif`;
  const metrics = ctx.measureText(text);

  // Get actual text measurements
  const width = metrics.width;
  // Height calculation based on font metrics
  const height =
    metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent ||
    fontSize * 1.2; // Fallback if metrics not available

  return { width, height };
};

// Calculate text bounds and dynamic font size
const calculateTextBounds = (
  text: string,
  x: number,
  y: number,
  fontSize: number,
  textAnchor: string,
  viewBoxBounds: { minX: number; maxX: number; minY: number; maxY: number },
) => {
  // Get actual text measurements
  const { width: measuredWidth, height: measuredHeight } = measureText(
    text,
    fontSize,
    "600",
  );

  // Calculate text bounds based on anchor point
  let minX = x;
  let maxX = x;

  if (textAnchor === "start") {
    maxX = x + measuredWidth;
  } else if (textAnchor === "end") {
    minX = x - measuredWidth;
  } else {
    // middle
    minX = x - measuredWidth / 2;
    maxX = x + measuredWidth / 2;
  }

  const minY = y - measuredHeight / 2;
  const maxY = y + measuredHeight / 2;

  // Check if text exceeds viewBox bounds
  const exceedsLeft = minX < viewBoxBounds.minX;
  const exceedsRight = maxX > viewBoxBounds.maxX;
  const exceedsTop = minY < viewBoxBounds.minY;
  const exceedsBottom = maxY > viewBoxBounds.maxY;

  // Calculate scale factor to fit text within bounds
  let scaleFactor = 1;

  if (exceedsLeft || exceedsRight) {
    const availableWidth = exceedsLeft
      ? (x - viewBoxBounds.minX) * (textAnchor === "end" ? 1 : 2)
      : (viewBoxBounds.maxX - x) * (textAnchor === "start" ? 1 : 2);
    const widthScale = Math.min(1, availableWidth / measuredWidth);
    scaleFactor = Math.min(scaleFactor, widthScale);
  }

  if (exceedsTop || exceedsBottom) {
    const availableHeight = exceedsTop
      ? (y - viewBoxBounds.minY) * 2
      : (viewBoxBounds.maxY - y) * 2;
    const heightScale = Math.min(1, availableHeight / measuredHeight);
    scaleFactor = Math.min(scaleFactor, heightScale);
  }

  // Ensure minimum readable size
  const minFontSize = 12;
  const maxFontSize = fontSize;
  const adjustedFontSize = Math.max(minFontSize, maxFontSize * scaleFactor);

  return {
    fontSize: adjustedFontSize,
    measuredWidth: measuredWidth * (adjustedFontSize / fontSize),
    measuredHeight: measuredHeight * (adjustedFontSize / fontSize),
    needsAdjustment: scaleFactor < 1,
  };
};

// Calculate text label position based on orb position
const getLabelPosition = (
  orbX: number,
  orbY: number,
  angle: number,
  _containerScale: number = 1,
) => {
  // Responsive label distance based on container size and position
  // Reduce distance for nodes closer to edges
  const distanceFromCenter = Math.sqrt(orbX * orbX + orbY * orbY);
  const edgeFactor = Math.min(1, (250 - distanceFromCenter) / 100); // Reduce near edges
  const baseLabelDistance = 60;
  const labelDistance = baseLabelDistance * Math.max(0.7, edgeFactor);
  const normalizedAngle = (angle + Math.PI / 2) % (2 * Math.PI);

  // Determine text anchor and position based on angle
  let textAnchor = "middle";
  let dx = 0;
  let dy = 0;
  let position = "top"; // Track position for hit area calculation

  // Right side (3 o'clock ± 45°)
  if (normalizedAngle > Math.PI * 0.25 && normalizedAngle < Math.PI * 0.75) {
    textAnchor = "start";
    dx = labelDistance;
    dy = 0;
    position = "right";
  }
  // Bottom (6 o'clock ± 45°)
  else if (
    normalizedAngle >= Math.PI * 0.75 &&
    normalizedAngle <= Math.PI * 1.25
  ) {
    textAnchor = "middle";
    dx = 0;
    dy = labelDistance;
    position = "bottom";
  }
  // Left side (9 o'clock ± 45°)
  else if (
    normalizedAngle > Math.PI * 1.25 &&
    normalizedAngle < Math.PI * 1.75
  ) {
    textAnchor = "end";
    dx = -labelDistance;
    dy = 0;
    position = "left";
  }
  // Top (12 o'clock ± 45°)
  else {
    textAnchor = "middle";
    dx = 0;
    dy = -labelDistance;
    position = "top";
  }

  return {
    x: orbX + dx,
    y: orbY + dy,
    textAnchor,
    position,
  };
};

export function InterestConstellation({
  interests,
  className,
  isVisible: _isVisible = true,
  usePartialArc = false,
  brainNodes,
}: InterestConstellationProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  // Initialize with correct screen size
  const [screenSize, setScreenSize] = useState<"tablet" | "desktop">(
    typeof window !== "undefined" && window.innerWidth < 1024
      ? "tablet"
      : "desktop",
  );
  const [containerSize, setContainerSize] = useState({
    width: 1000,
    height: 1000,
  });
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { areAnimationsPlaying } = useAnimationState();

  // Override usePartialArc for tablet screens (where layout is single column)
  const shouldUsePartialArc = usePartialArc || screenSize === "tablet";

  useEffect(() => {
    setIsHydrated(true);

    // Determine screen size for radius adjustment
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        // lg breakpoint
        setScreenSize("desktop");
      } else {
        setScreenSize("tablet");
      }

      // Update container size
      if (svgContainerRef.current) {
        const rect = svgContainerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Use ResizeObserver for more accurate container size tracking
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });

    if (svgContainerRef.current) {
      resizeObserver.observe(svgContainerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, []);

  // Always render the container to prevent hydration mismatch
  if (!interests || interests.length === 0) {
    return <div className={cn("relative", className)} />;
  }

  // Calculate responsive values based on container size
  const minDimension = Math.min(
    containerSize.width || 1000,
    containerSize.height || 1000,
  );
  const containerScale = minDimension / 1000; // Scale relative to base 1000px

  // Use different radius for tablet vs desktop, adjusted for container size
  const baseRadius = screenSize === "desktop" ? 150 : 120;
  const orbitalRadius =
    baseRadius * Math.max(0.8, Math.min(1.2, containerScale));

  // Simple fixed viewBox for stability (unused but kept for future reference)

  return (
    <div className={cn("relative", className)}>
      {/* Desktop and Tablet: Orbital constellation */}
      <div
        ref={svgContainerRef}
        className="hidden md:block relative pointer-events-none"
        style={{ zIndex: 10 }}
      >
        {/* Combined SVG for connections, orbs, and labels */}
        <svg
          className="overflow-visible"
          width="1000"
          height="1000"
          viewBox="-500 -500 1000 1000"
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="textGlow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feComponentTransfer in="coloredBlur" result="brighterBlur">
                <feFuncA
                  type="discrete"
                  tableValues="0 .8 .8 .8 .8 .8 .8 .8 .8 .8 .8 .8 .8 .8 .8 .8 .8"
                />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode in="brighterBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {isHydrated &&
            interests.map((interest, index) => {
              const position = getDesktopPosition(
                index,
                interests.length,
                orbitalRadius,
                shouldUsePartialArc,
              );
              const color = getInterestColor(interest.interestName);
              const isActive = hoveredIndex === index;
              const labelPos = getLabelPosition(
                position.x,
                position.y,
                position.angle,
                containerScale,
              );

              // Find nearest brain node for this interest
              const connectionPoint = findNearestBrainNode(
                position.x,
                position.y,
                brainNodes,
              );

              // Calculate dynamic font size to keep text within bounds
              // Aggressive bounds checking to prevent overflow
              const distanceFromCenter = Math.sqrt(
                position.x * position.x + position.y * position.y,
              );
              const maxDistance = 250; // Maximum expected distance from center
              const edgeProximity = distanceFromCenter / maxDistance; // 0 at center, 1 at edge

              // More aggressive scaling near edges
              const edgeScale = 1 - edgeProximity * 0.3; // Reduce size by up to 30% at edges
              const baseFontSize = Math.max(14, Math.min(18, 18 * edgeScale));

              // Conservative viewBox bounds for text
              const viewBoxBounds = {
                minX: -450,
                maxX: 450,
                minY: -450,
                maxY: 450,
              };

              const textBounds = calculateTextBounds(
                interest.interestName,
                labelPos.x,
                labelPos.y,
                baseFontSize,
                labelPos.textAnchor,
                viewBoxBounds,
              );

              return (
                <g key={`interest-group-${index}`}>
                  {/* Connection line from nearest brain node to orb */}
                  <motion.line
                    x1={connectionPoint.x}
                    y1={connectionPoint.y}
                    x2={position.x}
                    y2={position.y}
                    stroke={`rgb(${color})`}
                    strokeWidth={isActive ? "1.5" : "0.5"}
                    strokeDasharray={isActive ? "0" : "3 3"}
                    opacity={isActive ? 0.6 : 0.2}
                    filter={isActive ? "url(#glow)" : ""}
                    initial={{
                      pathLength: areAnimationsPlaying ? 0 : 1,
                      opacity: areAnimationsPlaying ? 0 : isActive ? 0.6 : 0.2,
                    }} // Start at final values when animations disabled
                    animate={{
                      pathLength: 1, // Always show connection line
                      opacity: isActive ? 0.6 : 0.2, // Only vary by active state
                    }}
                    transition={{
                      pathLength: {
                        delay: areAnimationsPlaying ? 0.5 + index * 0.1 : 0,
                        duration: areAnimationsPlaying ? 1 : 0, // No duration when animations off
                      },
                      opacity: { duration: areAnimationsPlaying ? 0.3 : 0 }, // No duration when animations off
                    }}
                    style={{ pointerEvents: "none" }}
                  />

                  {/* Connection line from orb to label */}
                  <motion.line
                    x1={position.x}
                    y1={position.y}
                    x2={position.x + (labelPos.x - position.x) * 0.5}
                    y2={position.y + (labelPos.y - position.y) * 0.5}
                    stroke={`rgb(${color})`}
                    strokeWidth={isActive ? "1" : "0.5"}
                    opacity={isActive ? 0.7 : 0.4}
                    initial={{
                      opacity: areAnimationsPlaying ? 0 : isActive ? 0.7 : 0.4,
                    }} // Start at final opacity when animations disabled
                    animate={{
                      opacity: isActive ? 0.7 : 0.4, // Always show, only vary by active state
                    }}
                    transition={{
                      delay: areAnimationsPlaying ? 0.8 + index * 0.1 : 0,
                      duration: areAnimationsPlaying ? 0.5 : 0, // No duration when animations off
                    }}
                    style={{ pointerEvents: "none" }}
                  />

                  {/* Orb glow */}
                  <motion.circle
                    cx={position.x}
                    cy={position.y}
                    r={15}
                    fill={`rgb(${color})`}
                    opacity="0.2"
                    filter="url(#glow)"
                    initial={{
                      scale: areAnimationsPlaying ? 0 : isActive ? 1.5 : 1,
                    }} // Start at final scale when animations disabled
                    animate={{ scale: isActive ? 1.5 : 1 }} // Always show glow, just vary by active state
                    transition={{
                      delay: areAnimationsPlaying ? 0.8 + index * 0.1 : 0,
                      duration: areAnimationsPlaying ? 0.3 : 0, // No duration when animations off
                    }}
                    style={{ pointerEvents: "none" }}
                  />

                  {/* Main orb */}
                  <motion.g
                    initial={{
                      scale: areAnimationsPlaying ? 0 : 1,
                      opacity: areAnimationsPlaying ? 0 : 1,
                    }} // Start at final values when animations disabled
                    animate={{
                      scale: 1, // Always show orb
                      opacity: 1, // Always show orb
                    }}
                    transition={{
                      scale: {
                        delay: areAnimationsPlaying ? 0.8 + index * 0.1 : 0,
                        duration: areAnimationsPlaying ? 0.5 : 0, // No duration when animations off
                        type: areAnimationsPlaying ? "spring" : "tween",
                      },
                      opacity: {
                        delay: areAnimationsPlaying ? 0.8 + index * 0.1 : 0,
                        duration: areAnimationsPlaying ? 0.5 : 0, // No duration when animations off
                      },
                    }}
                    style={{ pointerEvents: "none" }}
                  >
                    {/* Orb background */}
                    <circle
                      cx={position.x}
                      cy={position.y}
                      r="10"
                      fill={`rgba(${color}, 0.1)`}
                      stroke={`rgba(${color}, 0.4)`}
                      strokeWidth="1.5"
                    />

                    {/* Icon */}
                    {(() => {
                      const IconComponent = getTechIcon(
                        interest.fontAwesomeClassname,
                      );
                      return (
                        <g
                          transform={`translate(${position.x - 8}, ${position.y - 8})`}
                        >
                          <IconComponent
                            width={16}
                            height={16}
                            color={`rgb(${color})`}
                          />
                        </g>
                      );
                    })()}

                    {/* Pulse animation */}
                    {!prefersReducedMotion && areAnimationsPlaying && (
                      <motion.circle
                        cx={position.x}
                        cy={position.y}
                        r={10}
                        fill="none"
                        stroke={`rgb(${color})`}
                        strokeWidth="1"
                        opacity="0"
                        animate={{
                          r: [10, 20, 20],
                          opacity: [0.5, 0, 0],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: index * 0.3,
                        }}
                      />
                    )}
                  </motion.g>

                  {/* Text background rectangle when hovered */}
                  {isActive && (
                    <>
                      {/* Create a properly positioned background based on text anchor */}
                      {(() => {
                        const horizontalPadding = 16;
                        const verticalPadding = 12; // Increased to account for text animation movement (±2px)

                        // Use the actual measured text dimensions
                        const textWidth =
                          textBounds.measuredWidth ||
                          textBounds.fontSize *
                            interest.interestName.length *
                            0.6;
                        const textHeight =
                          textBounds.measuredHeight ||
                          textBounds.fontSize * 1.2;

                        // Box dimensions with padding
                        // Add extra height to accommodate the text animation movement
                        const animationBuffer = 4; // Text moves ±2px, so we add 4px total
                        const boxWidth = textWidth + horizontalPadding;
                        const boxHeight =
                          textHeight + verticalPadding + animationBuffer;

                        // Calculate X position based on text anchor
                        let boxX = labelPos.x;

                        if (labelPos.textAnchor === "start") {
                          // Text starts at x, box starts slightly before for padding
                          boxX = labelPos.x - horizontalPadding / 2;
                        } else if (labelPos.textAnchor === "end") {
                          // Text ends at x, box ends slightly after for padding
                          boxX = labelPos.x - textWidth - horizontalPadding / 2;
                        } else {
                          // middle: text is centered at x
                          boxX = labelPos.x - boxWidth / 2;
                        }

                        // Calculate Y position - text is centered with dominantBaseline="middle"
                        // Center the box at the same y position
                        const boxY = labelPos.y - boxHeight / 2;

                        return (
                          <motion.rect
                            x={boxX}
                            y={boxY}
                            width={boxWidth}
                            height={boxHeight}
                            rx="6"
                            fill={`rgba(${color}, 0.08)`}
                            stroke={`rgba(${color}, 0.2)`}
                            strokeWidth="1.5"
                            initial={{
                              opacity: areAnimationsPlaying ? 0 : 1,
                              scale: areAnimationsPlaying ? 0.98 : 1,
                              y: 0,
                            }} // Start at final values when animations disabled
                            animate={{
                              opacity: 1,
                              scale: 1,
                              y:
                                areAnimationsPlaying && !prefersReducedMotion
                                  ? [0, -2, 0]
                                  : 0,
                            }}
                            transition={{
                              opacity: {
                                duration: areAnimationsPlaying ? 0.15 : 0,
                              },
                              scale: {
                                duration: areAnimationsPlaying ? 0.15 : 0,
                              },
                              y: {
                                duration: areAnimationsPlaying
                                  ? 4 + index * 0.3
                                  : 0, // No duration when animations off
                                repeat:
                                  areAnimationsPlaying && !prefersReducedMotion
                                    ? Infinity
                                    : 0, // Only repeat if animations enabled
                                ease: "easeInOut",
                                delay: 0, // Start immediately, same as text
                              },
                            }}
                            style={{
                              pointerEvents: "none",
                            }}
                          />
                        );
                      })()}
                    </>
                  )}

                  {/* Text label */}
                  <motion.text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor={labelPos.textAnchor}
                    dominantBaseline="middle"
                    className="select-none"
                    fill={`rgb(${color})`}
                    fontSize={textBounds.fontSize}
                    fontWeight="600"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    opacity={isActive ? 1 : 0.95}
                    initial={{
                      opacity: areAnimationsPlaying ? 0 : isActive ? 1 : 0.95,
                      scale: areAnimationsPlaying ? 0.8 : 1,
                    }} // Start at final values when animations disabled
                    animate={{
                      opacity: isActive ? 1 : 0.95, // Always show labels
                      scale: 1, // Always full scale
                      y:
                        areAnimationsPlaying && !prefersReducedMotion
                          ? [0, -2, 0]
                          : 0, // Only animate movement if animations enabled
                    }}
                    transition={{
                      opacity: {
                        delay: areAnimationsPlaying ? 1 + index * 0.1 : 0,
                        duration: areAnimationsPlaying ? 0.5 : 0, // No duration when animations off
                      },
                      scale: {
                        delay: areAnimationsPlaying ? 1 + index * 0.1 : 0,
                        duration: areAnimationsPlaying ? 0.5 : 0, // No duration when animations off
                      },
                      y: {
                        duration: areAnimationsPlaying ? 4 + index * 0.3 : 0, // No duration when animations off
                        repeat:
                          areAnimationsPlaying && !prefersReducedMotion
                            ? Infinity
                            : 0, // Only repeat if animations enabled
                        ease: "easeInOut",
                      },
                    }}
                    style={{
                      pointerEvents: "none",
                      letterSpacing: textBounds.needsAdjustment
                        ? "0.01em"
                        : "0.02em",
                    }}
                  >
                    {interest.interestName}
                  </motion.text>

                  {/* Hit area - rendered last so it's on top */}
                  <g
                    className="pointer-events-auto cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  >
                    {/* Thick invisible line from brain node to orb */}
                    <line
                      x1={connectionPoint.x}
                      y1={connectionPoint.y}
                      x2={position.x}
                      y2={position.y}
                      stroke="transparent"
                      strokeWidth="50"
                    />

                    {/* Large circle around orb */}
                    <circle
                      cx={position.x}
                      cy={position.y}
                      r="40"
                      fill="transparent"
                    />

                    {/* Thick invisible line from orb to text */}
                    <line
                      x1={position.x}
                      y1={position.y}
                      x2={labelPos.x}
                      y2={labelPos.y}
                      stroke="transparent"
                      strokeWidth="50"
                    />

                    {/* Large rectangle around text */}
                    <rect
                      x={labelPos.x - 100}
                      y={labelPos.y - 25}
                      width="200"
                      height="50"
                      fill="transparent"
                    />

                    {/* Extra coverage for vertical gaps */}
                    {(labelPos.position === "top" ||
                      labelPos.position === "bottom") && (
                      <rect
                        x={Math.min(position.x, labelPos.x) - 50}
                        y={Math.min(position.y, labelPos.y)}
                        width={Math.abs(labelPos.x - position.x) + 100}
                        height={Math.abs(labelPos.y - position.y)}
                        fill="transparent"
                      />
                    )}
                  </g>
                </g>
              );
            })}
        </svg>
      </div>

      {/* Mobile: Compact list with icons and text */}
      <div className="md:hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: areAnimationsPlaying ? 0.8 : 0,
            duration: areAnimationsPlaying ? 0.5 : 0,
          }}
          className="flex flex-wrap gap-2 justify-center"
        >
          {isHydrated &&
            interests.map((interest, index) => {
              const color = getInterestColor(interest.interestName);

              return (
                <motion.div
                  key={`mobile-interest-${index}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    delay: areAnimationsPlaying ? 0.9 + index * 0.05 : 0,
                    duration: areAnimationsPlaying ? 0.3 : 0,
                    type: areAnimationsPlaying ? "spring" : "tween",
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor: `rgba(${color}, 0.1)`,
                    border: `1px solid rgba(${color}, 0.3)`,
                  }}
                >
                  <i
                    className={cn(interest.fontAwesomeClassname, "text-xs")}
                    style={{ color: `rgb(${color})` }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: `rgb(${color})` }}
                  >
                    {interest.interestName}
                  </span>
                </motion.div>
              );
            })}
        </motion.div>
      </div>
    </div>
  );
}
