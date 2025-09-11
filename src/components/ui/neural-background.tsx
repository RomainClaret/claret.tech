"use client";

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  startTransition,
  useDeferredValue,
  memo,
} from "react";
import { cn } from "@/lib/utils";
import { useBackground } from "@/contexts/background-context";
import { NeuralSignal } from "./neural-signal";
import {
  DEFAULT_SPIKING_CONFIG,
  getRandomInterval,
  getRandomColor,
  calculateSignalDuration,
} from "@/lib/utils/neural-animations";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useAnimationManager } from "@/lib/animation-manager";
import { validateRadius } from "@/lib/utils/svg-validation";
import { generateStableId } from "@/lib/utils/stable-ids";
import { useAnimationState } from "@/contexts/animation-state-context";
import {
  useQuality,
  NEURAL_BACKGROUND_PROFILE,
  ComponentConfig,
} from "@/contexts/quality-context";

interface NeuralBackgroundProps {
  className?: string;
}

interface SpikingNode {
  gridX: number;
  gridY: number;
  nextSpikeTime: number;
  isSpiking: boolean;
}

interface ActiveSignal {
  id: string;
  path: string;
  color: string;
  duration: number;
}

interface PatternNode {
  gridX: number;
  gridY: number;
}

interface Pattern {
  id: string;
  type: string;
  nodes: PatternNode[];
  opacity: number;
}

interface NeuralNodeProps {
  node: {
    gridX: number;
    gridY: number;
  };
  nodeKey: string;
  gridCellSize: number;
  isSpiking: boolean;
  nodeOpacity: number;
  nodeRadius: number;
  qualityConfig: ComponentConfig;
  areAnimationsPlaying: boolean;
}

// Memoized component for rendering pattern connections
const PatternConnections = memo(
  ({
    pattern,
    gridCellSize,
    opacity,
  }: {
    pattern: Pattern;
    gridCellSize: number;
    opacity: number;
  }) => {
    return (
      <g opacity={opacity}>
        {pattern.type === "triangle" && (
          <>
            <line
              x1={pattern.nodes[0].gridX * gridCellSize}
              y1={pattern.nodes[0].gridY * gridCellSize}
              x2={pattern.nodes[1].gridX * gridCellSize}
              y2={pattern.nodes[1].gridY * gridCellSize}
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-primary"
            />
            <line
              x1={pattern.nodes[1].gridX * gridCellSize}
              y1={pattern.nodes[1].gridY * gridCellSize}
              x2={pattern.nodes[2].gridX * gridCellSize}
              y2={pattern.nodes[2].gridY * gridCellSize}
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-primary"
            />
            <line
              x1={pattern.nodes[2].gridX * gridCellSize}
              y1={pattern.nodes[2].gridY * gridCellSize}
              x2={pattern.nodes[0].gridX * gridCellSize}
              y2={pattern.nodes[0].gridY * gridCellSize}
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-primary"
            />
          </>
        )}

        {pattern.type === "square" &&
          pattern.nodes.map((node: PatternNode, i: number) => {
            const nextNode = pattern.nodes[(i + 1) % pattern.nodes.length];
            return (
              <line
                key={`${pattern.id}-line-${i}`}
                x1={node.gridX * gridCellSize}
                y1={node.gridY * gridCellSize}
                x2={nextNode.gridX * gridCellSize}
                y2={nextNode.gridY * gridCellSize}
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-primary"
              />
            );
          })}

        {(pattern.type === "pentagon" || pattern.type === "hexagon") &&
          pattern.nodes.map((node: PatternNode, i: number) => {
            const nextNode = pattern.nodes[(i + 1) % pattern.nodes.length];
            return (
              <line
                key={`${pattern.id}-line-${i}`}
                x1={node.gridX * gridCellSize}
                y1={node.gridY * gridCellSize}
                x2={nextNode.gridX * gridCellSize}
                y2={nextNode.gridY * gridCellSize}
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-primary"
              />
            );
          })}

        {pattern.type === "star" && (
          <>
            {pattern.nodes.slice(1).map((node: PatternNode, i: number) => (
              <line
                key={`${pattern.id}-line-${i}`}
                x1={pattern.nodes[0].gridX * gridCellSize}
                y1={pattern.nodes[0].gridY * gridCellSize}
                x2={node.gridX * gridCellSize}
                y2={node.gridY * gridCellSize}
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-primary"
              />
            ))}
            {pattern.nodes.slice(1, 5).map((node: PatternNode, i: number) => {
              const nextNode = pattern.nodes[1 + ((i + 1) % 4)];
              return (
                <line
                  key={`${pattern.id}-outer-${i}`}
                  x1={node.gridX * gridCellSize}
                  y1={node.gridY * gridCellSize}
                  x2={nextNode.gridX * gridCellSize}
                  y2={nextNode.gridY * gridCellSize}
                  stroke="currentColor"
                  strokeWidth="0.3"
                  className="text-primary opacity-50"
                />
              );
            })}
          </>
        )}
      </g>
    );
  },
);
PatternConnections.displayName = "PatternConnections";

// Memoized component for rendering neural nodes
const NeuralNode = memo(
  ({
    node,
    nodeKey,
    gridCellSize,
    isSpiking,
    nodeOpacity,
    nodeRadius,
    qualityConfig,
    areAnimationsPlaying,
  }: NeuralNodeProps) => {
    const radiusValue = isSpiking
      ? Math.min(nodeRadius * 1.5, gridCellSize * 0.4)
      : nodeRadius;

    return (
      <g key={nodeKey}>
        {/* Background circle to block visual bleeding */}
        <circle
          cx={node.gridX * gridCellSize}
          cy={node.gridY * gridCellSize}
          r={validateRadius(
            radiusValue * (qualityConfig.nodeScale || 1.0) * 2,
            "4",
            "NeuralBackground-bg",
            { nodeKey, isSpiking },
          )}
          fill="#000000"
          opacity={nodeOpacity}
        />

        {/* Main node circle */}
        <circle
          cx={node.gridX * gridCellSize}
          cy={node.gridY * gridCellSize}
          r={validateRadius(
            radiusValue * (qualityConfig.nodeScale || 1.0),
            "4",
            "NeuralBackground",
            { nodeKey, isSpiking },
          )}
          fill="currentColor"
          className={cn(
            "text-primary transition-all duration-300",
            isSpiking && areAnimationsPlaying && "animate-pulse",
          )}
          opacity={nodeOpacity}
          filter={
            qualityConfig.effects?.includes("glow") && isSpiking
              ? "url(#neuralGlow)"
              : undefined
          }
        />
      </g>
    );
  },
);
NeuralNode.displayName = "NeuralNode";

export function NeuralBackground({ className }: NeuralBackgroundProps) {
  const [dimensions, setDimensions] = useState({ width: 1152, height: 768 });
  const { backgroundData } = useBackground();
  const [spikingNodes, setSpikingNodes] = useState<Map<string, SpikingNode>>(
    new Map(),
  );
  const [activeSignals, setActiveSignals] = useState<ActiveSignal[]>([]);

  // Use deferred values for non-critical visual updates
  const deferredSpikingNodes = useDeferredValue(spikingNodes);
  const deferredActiveSignals = useDeferredValue(activeSignals);
  const animationFrameRef = useRef<number>();
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const animationControl = useAnimationManager("neural-background", "low");
  const [isAnimationActive, setIsAnimationActive] = useState(false);
  const pendingSignalRemovals = useRef<string[]>([]);
  const signalUpdateFrameRef = useRef<number>();
  const spikeTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const spikingNodesRef = useRef<Map<string, SpikingNode>>(new Map());
  const [isMounted, setIsMounted] = useState(false);
  const { areAnimationsPlaying } = useAnimationState();
  const { getConfig, qualityMetrics } = useQuality();
  const qualityConfig = getConfig(NEURAL_BACKGROUND_PROFILE);

  // Keep ref in sync with state
  useEffect(() => {
    spikingNodesRef.current = spikingNodes;
  }, [spikingNodes]);

  // Clear active signals when animations stop
  useEffect(() => {
    if (!areAnimationsPlaying) {
      startTransition(() => {
        setActiveSignals([]);
        // Also clear any spiking state
        setSpikingNodes((nodes) => {
          const updated = new Map(nodes);
          updated.forEach((node, key) => {
            if (node.isSpiking) {
              updated.set(key, {
                ...node,
                isSpiking: false,
                nextSpikeTime:
                  Date.now() +
                  getRandomInterval(
                    DEFAULT_SPIKING_CONFIG.minInterval * 1000,
                    DEFAULT_SPIKING_CONFIG.maxInterval * 1000,
                  ),
              });
            }
          });
          return updated;
        });
      });
    }
  }, [areAnimationsPlaying]);

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

  // Get neural patterns from context with viewport culling
  const patterns = useMemo(() => {
    if (!backgroundData?.neuralPatterns) return [];

    // Add viewport culling to only render visible patterns
    const viewportPadding = 100; // Render patterns slightly outside viewport
    const minX = -viewportPadding / gridCellSize;
    const maxX = (dimensions.width + viewportPadding) / gridCellSize;
    const minY = -viewportPadding / gridCellSize;
    const maxY = (dimensions.height + viewportPadding) / gridCellSize;

    return backgroundData.neuralPatterns.filter((pattern) => {
      // Check if any node of the pattern is within viewport
      return pattern.nodes.some(
        (node) =>
          node.gridX >= minX &&
          node.gridX <= maxX &&
          node.gridY >= minY &&
          node.gridY <= maxY,
      );
    });
  }, [backgroundData?.neuralPatterns, dimensions, gridCellSize]);

  const connections = useMemo(() => {
    if (!backgroundData?.connections) return [];

    // Add viewport culling for connections
    const viewportPadding = 100;
    const minX = -viewportPadding / gridCellSize;
    const maxX = (dimensions.width + viewportPadding) / gridCellSize;
    const minY = -viewportPadding / gridCellSize;
    const maxY = (dimensions.height + viewportPadding) / gridCellSize;

    return backgroundData.connections.filter((conn) => {
      // Check if either endpoint is within viewport
      return (
        (conn.fromX >= minX &&
          conn.fromX <= maxX &&
          conn.fromY >= minY &&
          conn.fromY <= maxY) ||
        (conn.toX >= minX &&
          conn.toX <= maxX &&
          conn.toY >= minY &&
          conn.toY <= maxY)
      );
    });
  }, [backgroundData?.connections, dimensions, gridCellSize]);

  // Initialize spiking nodes - ALWAYS create nodes when patterns exist
  useEffect(() => {
    if (!patterns.length) return; // Only check if we have patterns

    const nodes = new Map<string, SpikingNode>();
    patterns.forEach((pattern) => {
      pattern.nodes.forEach((node) => {
        const key = `${node.gridX}-${node.gridY}`;
        if (!nodes.has(key)) {
          nodes.set(key, {
            gridX: node.gridX,
            gridY: node.gridY,
            nextSpikeTime:
              Date.now() +
              getRandomInterval(
                DEFAULT_SPIKING_CONFIG.minInterval * 1000,
                DEFAULT_SPIKING_CONFIG.maxInterval * 1000,
              ),
            isSpiking: false,
          });
        }
      });
    });
    setSpikingNodes(nodes);
  }, [patterns]); // Only depend on patterns, not animation state

  // Handle node spiking with batched updates
  const handleNodeSpike = useCallback(
    (node: SpikingNode) => {
      const nodeKey = `${node.gridX}-${node.gridY}`;

      // Find all connections from this node
      const nodeConnections = connections.filter(
        (conn) =>
          (conn.fromX === node.gridX && conn.fromY === node.gridY) ||
          (conn.toX === node.gridX && conn.toY === node.gridY),
      );

      // Create signals for each connection
      const newSignals: ActiveSignal[] = nodeConnections.map((conn) => {
        const isReversed = conn.toX === node.gridX && conn.toY === node.gridY;
        const path = isReversed
          ? `M${conn.toX * gridCellSize},${conn.toY * gridCellSize} L${conn.fromX * gridCellSize},${conn.fromY * gridCellSize}`
          : conn.path;

        const pathLength = Math.sqrt(
          Math.pow((conn.toX - conn.fromX) * gridCellSize, 2) +
            Math.pow((conn.toY - conn.fromY) * gridCellSize, 2),
        );

        return {
          id: generateStableId("signal", nodeKey),
          path,
          color: getRandomColor(DEFAULT_SPIKING_CONFIG.signalColors),
          duration: calculateSignalDuration(
            pathLength,
            DEFAULT_SPIKING_CONFIG.signalSpeed,
          ),
        };
      });

      // Batch signal updates with startTransition for better performance
      startTransition(() => {
        setActiveSignals((prev) => [...prev, ...newSignals]);
      });
    },
    [connections, gridCellSize],
  );

  // Animation loop with FPS limiting
  useEffect(() => {
    // Store ref values at effect start for cleanup
    const timeouts = spikeTimeoutsRef.current;

    // Quality-based FPS limiting using qualityMetrics.rafCalls
    const targetFPS = qualityConfig.updateFrequency || qualityMetrics.rafCalls;
    const frameInterval = 1000 / targetFPS;
    let lastFrameTime = 0;

    const animate = (currentTime: number) => {
      // Skip entirely if not visible
      if (!isVisible) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // FPS limiting - skip frame if too soon
      if (currentTime - lastFrameTime < frameInterval) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = currentTime;

      // Stop processing spikes if animations are not playing
      if (!areAnimationsPlaying) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const now = Date.now();
      const nodesToSpike: { key: string; node: SpikingNode }[] = [];

      // Check if any nodes need to spike before updating state
      let hasChanges = false;
      spikingNodesRef.current.forEach((node, key) => {
        if (now >= node.nextSpikeTime && !node.isSpiking) {
          hasChanges = true;
          nodesToSpike.push({ key, node: { ...node, isSpiking: true } });
        }
      });

      // Only update state if there are actual changes
      if (hasChanges) {
        setSpikingNodes((nodes) => {
          const updatedNodes = new Map(nodes);

          nodesToSpike.forEach(({ key, node }) => {
            updatedNodes.set(key, node);
          });

          return updatedNodes;
        });
      }

      // Handle spikes and schedule resets outside of state update
      nodesToSpike.forEach(({ key, node }) => {
        // ALWAYS create signals when nodes spike - let NeuralSignal component handle animation state
        handleNodeSpike(node);

        // Clear any existing timeout for this node
        const existingTimeout = spikeTimeoutsRef.current.get(key);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        // Schedule spike reset
        const timeout = setTimeout(() => {
          setSpikingNodes((n) => {
            const updated = new Map(n);
            const currentNode = updated.get(key);
            if (currentNode) {
              updated.set(key, {
                ...currentNode,
                isSpiking: false,
                nextSpikeTime:
                  Date.now() +
                  getRandomInterval(
                    DEFAULT_SPIKING_CONFIG.minInterval * 1000,
                    DEFAULT_SPIKING_CONFIG.maxInterval * 1000,
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
    handleNodeSpike,
    isVisible,
    prefersReducedMotion,
    isAnimationActive,
    areAnimationsPlaying,
    qualityConfig,
    qualityMetrics,
  ]);

  // Clean up completed signals with batching
  const handleSignalComplete = useCallback((signalId: string) => {
    // Add to pending removals
    pendingSignalRemovals.current.push(signalId);

    // Cancel any existing frame request
    if (signalUpdateFrameRef.current) {
      cancelAnimationFrame(signalUpdateFrameRef.current);
    }

    // Schedule batch update
    signalUpdateFrameRef.current = requestAnimationFrame(() => {
      const signalsToRemove = [...pendingSignalRemovals.current];
      pendingSignalRemovals.current = [];

      if (signalsToRemove.length > 0) {
        setActiveSignals((prev) =>
          prev.filter((s) => !signalsToRemove.includes(s.id)),
        );
      }
    });
  }, []);

  // For Safari: render static version with no animations but keep visual structure

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-0 overflow-hidden pointer-events-none",
        className,
      )}
      suppressHydrationWarning
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="absolute inset-0"
      >
        <defs>
          {/* Always render filter to prevent hydration mismatch */}
          <filter id="neuralGlow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Layer 1: Render connections between nodes */}
        {patterns.map((pattern) => (
          <PatternConnections
            key={`${pattern.id}-connections`}
            pattern={pattern}
            gridCellSize={gridCellSize}
            opacity={pattern.opacity * (qualityConfig.connectionOpacity || 0.4)}
          />
        ))}

        {/* Layer 2: Render active signals - using deferred values */}
        <g>
          {deferredActiveSignals.map((signal) => (
            <NeuralSignal
              key={signal.id}
              path={signal.path}
              duration={signal.duration}
              color={signal.color}
              intensity={0.8}
              onComplete={() => handleSignalComplete(signal.id)}
            />
          ))}
        </g>

        {/* Layer 3: Render nodes on top (to prevent visual corruption from signals) */}
        {patterns.map((pattern) => (
          <g key={`${pattern.id}-nodes`}>
            {/* Draw nodes with spiking animation - using deferred values */}
            {isMounted &&
              pattern.nodes.map((node, i) => {
                const nodeKey = `${node.gridX}-${node.gridY}`;
                const spikingNode = deferredSpikingNodes.get(nodeKey);
                const isSpiking = Boolean(spikingNode?.isSpiking);
                const nodeOpacity =
                  pattern.opacity * (qualityConfig.connectionOpacity || 0.4);

                return (
                  <NeuralNode
                    key={`${pattern.id}-node-${i}`}
                    node={node}
                    nodeKey={nodeKey}
                    gridCellSize={gridCellSize}
                    isSpiking={isSpiking}
                    nodeOpacity={nodeOpacity}
                    nodeRadius={2}
                    qualityConfig={qualityConfig}
                    areAnimationsPlaying={areAnimationsPlaying}
                  />
                );
              })}
          </g>
        ))}
      </svg>
    </div>
  );
}
