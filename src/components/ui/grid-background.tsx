"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useBackground } from "@/contexts/background-context";
import { StraightSignal } from "./neural-signal";
import {
  DEFAULT_SPIKING_CONFIG,
  getRandomInterval,
  getRandomColor,
} from "@/lib/utils/neural-animations";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useAnimationManager } from "@/lib/animation-manager";
import { validateRadius } from "@/lib/utils/svg-validation";
import { generateStableId } from "@/lib/utils/stable-ids";
import { useAnimationState } from "@/contexts/animation-state-context";
import {
  useQuality,
  GRID_BACKGROUND_PROFILE,
} from "@/contexts/quality-context";

interface GridBackgroundProps {
  className?: string;
}

interface GridNodeSpike {
  x: number;
  y: number;
  nextSpikeTime: number;
  isSpiking: boolean;
}

interface GridSignal {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  path: string;
  color: string;
  duration: number;
}

export function GridBackground({ className }: GridBackgroundProps) {
  const [dimensions, setDimensions] = useState({ width: 1152, height: 768 });
  const { backgroundData } = useBackground();
  const [spikingGridNodes, setSpikingGridNodes] = useState<
    Map<string, GridNodeSpike>
  >(new Map());
  const [activeGridSignals, setActiveGridSignals] = useState<GridSignal[]>([]);
  const animationFrameRef = useRef<number>();
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { areAnimationsPlaying } = useAnimationState();
  const animationControl = useAnimationManager("grid-background", "medium");
  const [isAnimationActive, setIsAnimationActive] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const activeSignalsRef = useRef<GridSignal[]>([]);
  const { getConfig, quality } = useQuality();
  const config = getConfig(GRID_BACKGROUND_PROFILE);
  const spikeTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pendingSignalsRef = useRef<string[]>([]);
  const signalUpdateFrameRef = useRef<number>();
  const spikingGridNodesRef = useRef<Map<string, GridNodeSpike>>(new Map());

  // Keep refs in sync with state
  useEffect(() => {
    activeSignalsRef.current = activeGridSignals;
  }, [activeGridSignals]);

  useEffect(() => {
    spikingGridNodesRef.current = spikingGridNodes;
  }, [spikingGridNodes]);

  useEffect(() => {
    setIsMounted(true);
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

  // Register with animation manager
  useEffect(() => {
    animationControl.register(
      () => setIsAnimationActive(false), // onPause
      () => setIsAnimationActive(true), // onResume
    );
  }, [animationControl]);

  // Intersection Observer for visibility-based pausing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting) {
          animationControl.requestStart();
        } else {
          animationControl.requestStop();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [animationControl]);

  const gridCellSize = 64;
  const cols = Math.ceil(dimensions.width / gridCellSize);
  const rows = Math.ceil(dimensions.height / gridCellSize);

  // Use data from context or empty arrays if not yet generated
  const nodes = useMemo(
    () => backgroundData?.nodes || [],
    [backgroundData?.nodes],
  );
  const curves = useMemo(
    () => backgroundData?.curves || [],
    [backgroundData?.curves],
  );
  const lines = useMemo(
    () => backgroundData?.lines || [],
    [backgroundData?.lines],
  );
  const connections = useMemo(
    () => backgroundData?.connections || [],
    [backgroundData?.connections],
  );

  // Initialize spiking nodes - only if animations are playing, not reduced motion, and quality allows animation
  useEffect(() => {
    if (
      !nodes.length ||
      !areAnimationsPlaying ||
      prefersReducedMotion ||
      !config.animate
    )
      return;

    const spikingNodes = new Map<string, GridNodeSpike>();
    nodes.forEach((node) => {
      const key = `${node.x}-${node.y}`;
      spikingNodes.set(key, {
        x: node.x,
        y: node.y,
        nextSpikeTime:
          Date.now() +
          getRandomInterval(
            DEFAULT_SPIKING_CONFIG.minInterval * 1000,
            DEFAULT_SPIKING_CONFIG.maxInterval * 1000,
          ),
        isSpiking: false,
      });
    });
    setSpikingGridNodes(spikingNodes);
  }, [
    nodes,
    areAnimationsPlaying,
    prefersReducedMotion,
    config.animate,
    quality,
  ]);

  // Handle grid node spike
  const handleGridNodeSpike = useCallback(
    (node: GridNodeSpike) => {
      // Find connections that involve this node
      const nodeConnections = connections.filter(
        (conn) =>
          (Math.abs(conn.fromX - node.x) < 0.1 &&
            Math.abs(conn.fromY - node.y) < 0.1) ||
          (Math.abs(conn.toX - node.x) < 0.1 &&
            Math.abs(conn.toY - node.y) < 0.1),
      );

      // Also find nearby nodes to send signals to
      const nearbyNodes = nodes.filter((n) => {
        const distance = Math.sqrt(
          Math.pow(n.x - node.x, 2) + Math.pow(n.y - node.y, 2),
        );
        return distance > 0 && distance <= 3; // Within 3 grid cells
      });

      // Create signals - limit for performance
      const newSignals: GridSignal[] = [];
      const MAX_SIGNALS_PER_SPIKE = 3;

      // Signals along existing connections (limit to first few)
      nodeConnections.slice(0, 2).forEach((conn) => {
        const isFromNode =
          Math.abs(conn.fromX - node.x) < 0.1 &&
          Math.abs(conn.fromY - node.y) < 0.1;
        const targetX = isFromNode ? conn.toX : conn.fromX;
        const targetY = isFromNode ? conn.toY : conn.fromY;

        newSignals.push({
          id: generateStableId("gridSignal"),
          startX: node.x * gridCellSize,
          startY: node.y * gridCellSize,
          endX: targetX * gridCellSize,
          endY: targetY * gridCellSize,
          path: `M${node.x * gridCellSize},${node.y * gridCellSize} L${targetX * gridCellSize},${targetY * gridCellSize}`,
          color: getRandomColor(DEFAULT_SPIKING_CONFIG.signalColors),
          duration: 1.5,
        });
      });

      // Random signals to nearby nodes (only if under limit)
      if (newSignals.length < MAX_SIGNALS_PER_SPIKE) {
        nearbyNodes.slice(0, 1).forEach((nearbyNode) => {
          // Reduced to 1 random signal
          newSignals.push({
            id: generateStableId("gridSignal"),
            startX: node.x * gridCellSize,
            startY: node.y * gridCellSize,
            endX: nearbyNode.x * gridCellSize,
            endY: nearbyNode.y * gridCellSize,
            path: `M${node.x * gridCellSize},${node.y * gridCellSize} L${nearbyNode.x * gridCellSize},${nearbyNode.y * gridCellSize}`,
            color: getRandomColor(DEFAULT_SPIKING_CONFIG.signalColors),
            duration: 2,
          });
        });
      }

      setActiveGridSignals((prev) => [...prev, ...newSignals]);
    },
    [connections, nodes, gridCellSize],
  );

  // Animation loop for grid nodes with FPS limiting
  useEffect(() => {
    // Store ref values at effect start for cleanup
    const timeouts = spikeTimeoutsRef.current;

    // FPS limiting configuration - based on quality settings
    const FPS_LIMIT = config.updateFrequency || 10;
    const frameInterval = 1000 / FPS_LIMIT;
    let lastFrameTime = 0;
    const MAX_ACTIVE_SIGNALS = 10; // Limit simultaneous animations

    const animate = (currentTime: number) => {
      // Only animate if visible, motion is allowed, animation manager allows it, animations are playing, and quality allows animation
      if (
        !isVisible ||
        prefersReducedMotion ||
        !isAnimationActive ||
        !areAnimationsPlaying ||
        !config.animate
      ) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Skip if too many signals are active for performance
      if (activeSignalsRef.current.length > MAX_ACTIVE_SIGNALS) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // FPS limiting - skip frame if too soon
      if (currentTime - lastFrameTime < frameInterval) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = currentTime;

      const now = Date.now();
      const nodesToSpike: { key: string; node: GridNodeSpike }[] = [];

      // Check if any nodes need to spike before updating state
      let hasChanges = false;
      spikingGridNodesRef.current.forEach((node, key) => {
        if (now >= node.nextSpikeTime && !node.isSpiking) {
          hasChanges = true;
          nodesToSpike.push({ key, node: { ...node, isSpiking: true } });
        }
      });

      // Only update state if there are actual changes
      if (hasChanges) {
        setSpikingGridNodes((nodes) => {
          const updatedNodes = new Map(nodes);

          nodesToSpike.forEach(({ key, node }) => {
            updatedNodes.set(key, node);
          });

          return updatedNodes;
        });
      }

      // Handle spikes and schedule resets outside of state update
      nodesToSpike.forEach(({ key, node }) => {
        // Trigger spike effects
        handleGridNodeSpike(node);

        // Clear any existing timeout for this node
        const existingTimeout = spikeTimeoutsRef.current.get(key);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        // Schedule spike reset
        const timeout = setTimeout(() => {
          setSpikingGridNodes((n) => {
            const updated = new Map(n);
            const currentNode = updated.get(key);
            if (currentNode) {
              updated.set(key, {
                ...currentNode,
                isSpiking: false,
                nextSpikeTime:
                  Date.now() +
                  getRandomInterval(
                    DEFAULT_SPIKING_CONFIG.minInterval * 1000 * 2, // Slower for grid nodes
                    DEFAULT_SPIKING_CONFIG.maxInterval * 1000 * 1.5,
                  ),
              });
            }
            return updated;
          });
          spikeTimeoutsRef.current.delete(key);
        }, DEFAULT_SPIKING_CONFIG.spikeDuration);

        spikeTimeoutsRef.current.set(key, timeout);
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Clear all spike timeouts using stored ref value
      if (timeouts) {
        timeouts.forEach((timeout) => clearTimeout(timeout));
        timeouts.clear();
      }
    };
  }, [
    handleGridNodeSpike,
    isVisible,
    prefersReducedMotion,
    isAnimationActive,
    areAnimationsPlaying,
    config.animate,
    config.updateFrequency,
    quality, // Add quality to trigger animation loop re-initialization
  ]);

  // Clean up completed signals with batching
  const handleSignalComplete = useCallback((signalId: string) => {
    // Add to pending removals
    pendingSignalsRef.current.push(signalId);

    // Cancel any existing frame request
    if (signalUpdateFrameRef.current) {
      cancelAnimationFrame(signalUpdateFrameRef.current);
    }

    // Schedule batch update
    signalUpdateFrameRef.current = requestAnimationFrame(() => {
      const signalsToRemove = [...pendingSignalsRef.current];
      pendingSignalsRef.current = [];

      if (signalsToRemove.length > 0) {
        setActiveGridSignals((prev) =>
          prev.filter((s) => !signalsToRemove.includes(s.id)),
        );
      }
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-0 overflow-hidden grid-background-container",
        className,
      )}
      suppressHydrationWarning
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
        style={{ filter: "blur(0.5px)" }}
      >
        <defs>
          {/* Gradient for background */}
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--grid-gradient-start)" />
            <stop offset="100%" stopColor="var(--grid-gradient-end)" />
          </linearGradient>

          {/* Glow filter for nodes */}
          <filter id="nodeGlow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background gradient */}
        <rect width="100%" height="100%" fill="url(#bgGradient)" />

        {/* Grid lines */}
        <g
          className="opacity-15 dark:opacity-20"
          style={{ opacity: config.backgroundOpacity || 0.15 }}
          suppressHydrationWarning
        >
          {/* Vertical lines */}
          {Array.from({ length: cols + 1 }).map((_, i) => (
            <line
              key={`v-${i}`}
              x1={i * gridCellSize}
              y1={0}
              x2={i * gridCellSize}
              y2={dimensions.height}
              className="stroke-blue-400 dark:stroke-blue-400"
              strokeWidth="1"
            />
          ))}
          {/* Horizontal lines */}
          {Array.from({ length: rows + 1 }).map((_, i) => (
            <line
              key={`h-${i}`}
              x1={0}
              y1={i * gridCellSize}
              x2={dimensions.width}
              y2={i * gridCellSize}
              className="stroke-blue-400 dark:stroke-blue-400"
              strokeWidth="1"
            />
          ))}
        </g>

        {/* Curved lines */}
        <g
          className="opacity-25 dark:opacity-25"
          style={{ opacity: (config.backgroundOpacity || 0.25) * 1.5 }}
          suppressHydrationWarning
        >
          {curves.map((curve) => (
            <path
              key={curve.id}
              d={curve.path}
              fill="none"
              className="stroke-blue-300 dark:stroke-blue-400"
              strokeWidth="1"
            />
          ))}
        </g>

        {/* Nodes with spiking animation */}
        <g>
          {isMounted &&
            nodes.map((node, i) => {
              const nodeKey = `${node.x}-${node.y}`;
              const spikingNode = spikingGridNodes.get(nodeKey);
              const isSpiking = Boolean(spikingNode?.isSpiking);

              // Ensure isSpiking is always a boolean to prevent undefined issues
              const radiusValue = isSpiking === true ? 6 : 4;

              return (
                <g key={`node-${i}`}>
                  <circle
                    cx={node.x * gridCellSize}
                    cy={node.y * gridCellSize}
                    r={validateRadius(radiusValue, "4", "GridBackground", {
                      nodeKey,
                      isSpiking,
                    })}
                    className="fill-orange-500/60 dark:fill-orange-400/50"
                    filter="url(#nodeGlow)"
                    style={{
                      transition: `all ${DEFAULT_SPIKING_CONFIG.spikeDuration}ms ease-out`,
                      transform: isSpiking
                        ? `scale(${DEFAULT_SPIKING_CONFIG.spikeScale})`
                        : "scale(1)",
                      transformOrigin: `${node.x * gridCellSize}px ${node.y * gridCellSize}px`,
                    }}
                  >
                    {!isSpiking &&
                      !prefersReducedMotion &&
                      areAnimationsPlaying && (
                        <>
                          <animate
                            attributeName="r"
                            values="4;5;4"
                            dur="3s"
                            begin={`${typeof node.animationDelay === "number" && isFinite(node.animationDelay) ? node.animationDelay : 0}s`}
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="opacity"
                            values="0.8;1;0.8"
                            dur="3s"
                            begin={`${typeof node.animationDelay === "number" && isFinite(node.animationDelay) ? node.animationDelay : 0}s`}
                            repeatCount="indefinite"
                          />
                        </>
                      )}
                  </circle>
                  {isSpiking &&
                    !prefersReducedMotion &&
                    areAnimationsPlaying && (
                      <circle
                        cx={node.x * gridCellSize}
                        cy={node.y * gridCellSize}
                        r="10"
                        className="fill-orange-500/40 dark:fill-orange-400/30"
                        opacity="0"
                      >
                        <animate
                          attributeName="r"
                          values="6;16;20"
                          dur={`${typeof DEFAULT_SPIKING_CONFIG.spikeDuration === "number" && isFinite(DEFAULT_SPIKING_CONFIG.spikeDuration) ? DEFAULT_SPIKING_CONFIG.spikeDuration : 300}ms`}
                          repeatCount="1"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.8;0.4;0"
                          dur={`${typeof DEFAULT_SPIKING_CONFIG.spikeDuration === "number" && isFinite(DEFAULT_SPIKING_CONFIG.spikeDuration) ? DEFAULT_SPIKING_CONFIG.spikeDuration : 300}ms`}
                          repeatCount="1"
                        />
                      </circle>
                    )}
                </g>
              );
            })}
        </g>

        {/* Straight lines */}
        <g
          className="opacity-30 dark:opacity-35"
          style={{ opacity: (config.backgroundOpacity || 0.3) * 1.8 }}
          suppressHydrationWarning
        >
          {lines.map((line) => (
            <g key={line.id}>
              <line
                x1={line.startX * gridCellSize}
                y1={line.startY * gridCellSize}
                x2={line.endX * gridCellSize}
                y2={line.endY * gridCellSize}
                className="stroke-blue-400 dark:stroke-blue-300"
                strokeWidth="1"
              />
              {line.hasEndpoint && (
                <circle
                  cx={line.endX * gridCellSize}
                  cy={line.endY * gridCellSize}
                  r="3"
                  className="fill-blue-400 dark:fill-blue-500"
                />
              )}
            </g>
          ))}
        </g>

        {/* Render active signals */}
        {activeGridSignals.map((signal) => (
          <StraightSignal
            key={signal.id}
            startX={signal.startX}
            startY={signal.startY}
            endX={signal.endX}
            endY={signal.endY}
            duration={signal.duration}
            color={signal.color}
            intensity={0.6}
            onComplete={() => handleSignalComplete(signal.id)}
          />
        ))}
      </svg>
    </div>
  );
}
