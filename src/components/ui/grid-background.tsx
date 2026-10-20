"use client";

import { memo, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useBackground } from "@/contexts/background-context";
import { StraightSignal } from "./neural-signal";
import {
  DEFAULT_SPIKING_CONFIG,
  getRandomInterval,
  getRandomColor,
} from "@/lib/utils/neural-animations";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useMotionGate } from "@/lib/hooks/useMotionGate";
import {
  useGridCoverRegistration,
  useRowsAboveCover,
} from "@/lib/hooks/useGridCover";
import { validateRadius } from "@/lib/utils/svg-validation";
import { generateStableId } from "@/lib/utils/stable-ids";
import { useAnimationState } from "@/contexts/animation-state-context";
import {
  useQuality,
  GRID_BACKGROUND_PROFILE,
} from "@/contexts/quality-context";
import { latestEntry } from "@/lib/utils/intersection";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { useWindowSize } from "@/lib/hooks/useWindowSize";

interface GridBackgroundProps {
  /**
   * Its place, which the caller sets: the site grid is fixed to the
   * viewport, the hero's fills the hero. A default `absolute` lost to the
   * site grid's `fixed` only through tailwind-merge.
   */
  className?: string;
  /**
   * This grid's opaque background hides the fixed site grid wherever it
   * spans the viewport (the hero's grid), so it registers as the cover.
   */
  covers?: boolean;
  /**
   * The fixed site grid: while a covering grid spans the viewport, it clips
   * itself to the band still showing above the cover, and the nodes below
   * rest (no pulse, no spike). What the cover hides is never drawn, so
   * nothing visible changes.
   */
  restUnderCover?: boolean;
}

/** A node is parked while hidden: due to spike only once it shows again. */
const PARKED = Infinity;

/** A node in row `nodeRow` is hidden when it lies below the rows still showing. */
const isHidden = (nodeRow: number, rowsAbove: number | null) =>
  rowsAbove !== null && nodeRow > rowsAbove;

/** When a grid node that has just settled, or shows again, spikes next. */
const nextGridSpikeTime = () =>
  Date.now() +
  getRandomInterval(
    DEFAULT_SPIKING_CONFIG.minInterval * 1000 * 2, // Slower for grid nodes
    DEFAULT_SPIKING_CONFIG.maxInterval * 1000 * 1.5,
  );

interface GridNodeSpike {
  x: number;
  y: number;
  nextSpikeTime: number;
  isSpiking: boolean;
  /** The node's own pulse offset in seconds (GridNode.animationDelay). */
  baseDelay: number;
  /**
   * The CSS animation-delay for the node's pulse. A CSS animation restarts
   * when it is re-applied after a spike, so the delay is shifted back by the
   * time elapsed since the pulses started: the node resumes in phase, as the
   * SMIL animation it replaces did (SMIL times run from the SVG's own clock).
   * Computed once when the spike ends, so re-renders never move it.
   */
  pulseDelay: number;
}

/** A finite delay in seconds, or 0. */
const safeDelay = (delay: unknown) =>
  typeof delay === "number" && isFinite(delay) ? delay : 0;

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

function GridBackgroundImpl({
  className,
  covers = false,
  restUnderCover = false,
}: GridBackgroundProps) {
  const dimensions = useWindowSize();
  const { backgroundData } = useBackground();
  const [spikingGridNodes, setSpikingGridNodes] = useState<
    Map<string, GridNodeSpike>
  >(new Map());
  const [activeGridSignals, setActiveGridSignals] = useState<GridSignal[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { areAnimationsPlaying } = useAnimationState();
  // Splash, modals or a hidden tab: nothing on the page needs to move.
  const { suspended } = useMotionGate();
  const isMounted = useHydrated();
  const activeSignalsRef = useRef<GridSignal[]>([]);
  const { getConfig, quality } = useQuality();
  const config = getConfig(GRID_BACKGROUND_PROFILE);
  const spikeTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pendingSignalsRef = useRef<string[]>([]);
  const signalUpdateFrameRef = useRef<number | undefined>(undefined);
  const spikingGridNodesRef = useRef<Map<string, GridNodeSpike>>(new Map());
  // When the current set of pulses started: the origin of their shared phase.
  const pulseOriginRef = useRef(0);
  const [svgElement, setSvgElement] = useState<SVGSVGElement | null>(null);
  useGridCoverRegistration(svgElement, covers);
  // Lets the cover effect wake the spike scheduler for nodes it unparks.
  const wakeSchedulerRef = useRef<(() => void) | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    activeSignalsRef.current = activeGridSignals;
  }, [activeGridSignals]);

  useEffect(() => {
    spikingGridNodesRef.current = spikingGridNodes;
  }, [spikingGridNodes]);

  // Intersection Observer for visibility-based pausing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = latestEntry(entries);
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 },
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  const gridCellSize = 64;
  const cols = Math.ceil(dimensions.width / gridCellSize);
  const rows = Math.ceil(dimensions.height / gridCellSize);

  // Rows still showing above a covering grid, or null while none covers this
  // one. A node in a row below them is hidden.
  const rowsAboveCover = useRowsAboveCover(
    restUnderCover,
    gridCellSize,
    containerRef,
  );
  const rowsAboveCoverRef = useRef(rowsAboveCover);

  // The cover moved: tell the scheduler, and give the nodes that show again
  // a fresh wait, so the ones that came due while hidden do not all spike at
  // once.
  useEffect(() => {
    rowsAboveCoverRef.current = rowsAboveCover;
    const shown = [...spikingGridNodesRef.current].filter(
      ([, node]) =>
        node.nextSpikeTime === PARKED && !isHidden(node.y, rowsAboveCover),
    );
    if (!shown.length) return;
    // An updater, not a replacement: the ref can lag a settle that is
    // queued but not yet committed (a cover change renders first), and a
    // map copied from it would put that node back to spiking, with its
    // reset timer gone, until the next pause. Only nodes still parked move.
    const waits = new Map(shown.map(([key]) => [key, nextGridSpikeTime()]));
    const unpark = (nodes: Map<string, GridNodeSpike>) => {
      const next = new Map(nodes);
      waits.forEach((nextSpikeTime, key) => {
        const node = next.get(key);
        if (node?.nextSpikeTime === PARKED) {
          next.set(key, { ...node, nextSpikeTime });
        }
      });
      return next;
    };
    spikingGridNodesRef.current = unpark(spikingGridNodesRef.current);
    setSpikingGridNodes(unpark);
    wakeSchedulerRef.current?.();
  }, [rowsAboveCover]);

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

  // New nodes start their pulses now, so their shared phase starts now too.
  useEffect(() => {
    pulseOriginRef.current = performance.now();
  }, [nodes]);

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
      const baseDelay = safeDelay(node.animationDelay);
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
        baseDelay,
        pulseDelay: baseDelay,
      });
    });
    // The scheduler reads the ref, which the sync effect above would update
    // only after the next render. It re-runs right after this effect, and
    // with only the old nodes, all parked, it would set no timer and miss
    // these. The wake covers a scheduler that does not re-run. Rendered
    // from what the scheduler holds.
    spikingGridNodesRef.current = spikingNodes;
    setSpikingGridNodes(spikingGridNodesRef.current);
    wakeSchedulerRef.current?.();
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

  // Spike scheduler: a timer set for the next node due to spike. It used to
  // check on every animation frame; spikes are seconds apart, and requesting
  // a frame per vsync made the browser produce one per vsync for nothing.
  useEffect(() => {
    // Store ref values at effect start for cleanup
    const timeouts = spikeTimeoutsRef.current;

    // Only animate if visible, nothing covers the page, motion is allowed,
    // animations are playing, and quality allows animation
    if (
      !isVisible ||
      suspended ||
      prefersReducedMotion ||
      !areAnimationsPlaying ||
      !config.animate
    ) {
      return;
    }

    // Nodes that came due while the scheduler was stopped (scrolled away,
    // under an overlay, a hidden tab, or not yet seen at all) get a fresh
    // wait. Left overdue, after any stop longer than the longest interval
    // they all spiked in the same tick: one synchronized flash, and a burst
    // of updates, instead of the staggered rhythm.
    const startedAt = Date.now();
    const overdue = [...spikingGridNodesRef.current].filter(
      ([, node]) => !node.isSpiking && node.nextSpikeTime <= startedAt,
    );
    if (overdue.length > 0) {
      const updated = new Map(spikingGridNodesRef.current);
      overdue.forEach(([key, node]) =>
        updated.set(key, { ...node, nextSpikeTime: nextGridSpikeTime() }),
      );
      spikingGridNodesRef.current = updated;
      setSpikingGridNodes(spikingGridNodesRef.current);
    }

    const MAX_ACTIVE_SIGNALS = 10; // Limit simultaneous animations
    // With too many signals in flight, look again one profile tick later
    // (the old loop's frame interval).
    const retryMs = 1000 / (config.updateFrequency || 10);
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNext = () => {
      let due = Infinity;
      spikingGridNodesRef.current.forEach((node) => {
        if (!node.isSpiking && node.nextSpikeTime < due) {
          due = node.nextSpikeTime;
        }
      });
      // Nothing to wait for: no nodes yet, every node mid-spike, or every
      // waiting one parked under the cover. Each ends in a wake: the node
      // setup hands new nodes over and wakes the scheduler, a spike calls
      // scheduleNext as it settles, and the cover effect wakes it for the
      // nodes it unparks. A timer meanwhile only polled, four times a
      // second (on /pdf/<slug>, with no nodes at all, for as long as the
      // reader was open).
      if (due === Infinity) {
        timer = undefined;
        return;
      }
      timer = setTimeout(tick, Math.max(0, due - Date.now()));
    };

    const tick = () => {
      // Skip if too many signals are active for performance
      if (activeSignalsRef.current.length > MAX_ACTIVE_SIGNALS) {
        timer = setTimeout(tick, retryMs);
        return;
      }

      const now = Date.now();
      const rowsAbove = rowsAboveCoverRef.current;
      const nodesToSpike: { key: string; node: GridNodeSpike }[] = [];
      // Due but hidden under a cover: parked until the cover effect shows it.
      const nodesToPark: { key: string; node: GridNodeSpike }[] = [];

      // Check if any nodes need to spike before updating state
      let hasChanges = false;
      spikingGridNodesRef.current.forEach((node, key) => {
        if (now >= node.nextSpikeTime && !node.isSpiking) {
          hasChanges = true;
          if (isHidden(node.y, rowsAbove)) {
            nodesToPark.push({ key, node: { ...node, nextSpikeTime: PARKED } });
          } else {
            nodesToSpike.push({ key, node: { ...node, isSpiking: true } });
          }
        }
      });

      // Only update state if there are actual changes
      if (hasChanges) {
        const changed = [...nodesToSpike, ...nodesToPark];
        setSpikingGridNodes((nodes) => {
          const updatedNodes = new Map(nodes);

          changed.forEach(({ key, node }) => {
            updatedNodes.set(key, node);
          });

          return updatedNodes;
        });
        // Mirror it into the ref now rather than after React renders, so the
        // next schedule does not see these nodes as still due.
        const mirrored = new Map(spikingGridNodesRef.current);
        changed.forEach(({ key, node }) => mirrored.set(key, node));
        spikingGridNodesRef.current = mirrored;
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
          const elapsed = (performance.now() - pulseOriginRef.current) / 1000;
          const nextSpikeTime = nextGridSpikeTime();
          const settle = (current: GridNodeSpike): GridNodeSpike => ({
            ...current,
            isSpiking: false,
            nextSpikeTime,
            pulseDelay: current.baseDelay - elapsed,
          });
          setSpikingGridNodes((n) => {
            const updated = new Map(n);
            const currentNode = updated.get(key);
            if (currentNode) updated.set(key, settle(currentNode));
            return updated;
          });
          const mirroredNode = spikingGridNodesRef.current.get(key);
          if (mirroredNode) {
            const mirrored = new Map(spikingGridNodesRef.current);
            mirrored.set(key, settle(mirroredNode));
            spikingGridNodesRef.current = mirrored;
          }
          spikeTimeoutsRef.current.delete(key);
          // This node waits again; wake for it if it is due before the
          // timer currently set.
          if (timer !== undefined) clearTimeout(timer);
          scheduleNext();
        }, DEFAULT_SPIKING_CONFIG.spikeDuration);

        spikeTimeoutsRef.current.set(key, timeout);
      });

      scheduleNext();
    };

    scheduleNext();
    wakeSchedulerRef.current = () => {
      if (timer !== undefined) clearTimeout(timer);
      scheduleNext();
    };

    return () => {
      wakeSchedulerRef.current = null;
      if (timer !== undefined) clearTimeout(timer);
      // Clear all spike timeouts using stored ref value
      if (timeouts) {
        timeouts.forEach((timeout) => clearTimeout(timeout));
        timeouts.clear();
      }
      // Those timeouts were the only way out of a spike, and the scheduler
      // skips spiking nodes: settle the nodes caught mid-spike, or they stay
      // large, scaled and without a pulse for good. Every pause (an overlay,
      // a hidden tab, the splash ending) runs this cleanup.
      const elapsed = (performance.now() - pulseOriginRef.current) / 1000;
      const settled = new Map<string, GridNodeSpike>();
      spikingGridNodesRef.current.forEach((node, key) => {
        if (!node.isSpiking) return;
        settled.set(key, {
          ...node,
          isSpiking: false,
          nextSpikeTime: nextGridSpikeTime(),
          pulseDelay: node.baseDelay - elapsed,
        });
      });
      if (settled.size) {
        spikingGridNodesRef.current = new Map([
          ...spikingGridNodesRef.current,
          ...settled,
        ]);
        setSpikingGridNodes((nodes) => {
          const updated = new Map(nodes);
          settled.forEach((node, key) => {
            if (updated.has(key)) updated.set(key, node);
          });
          return updated;
        });
      }
    };
  }, [
    handleGridNodeSpike,
    isVisible,
    suspended,
    prefersReducedMotion,
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
      className={cn("overflow-hidden grid-background-container", className)}
      // Pauses the node pulses while the grid is out of view (motion.css)
      data-anim={isVisible ? "on" : "off"}
      // Under a cover only the band above it is drawn; the cover hides the
      // rest, so this leaves every visible pixel as it was.
      style={
        rowsAboveCover === null
          ? undefined
          : {
              clipPath: `inset(0 0 calc(100% - ${rowsAboveCover * gridCellSize}px) 0)`,
            }
      }
      suppressHydrationWarning
    >
      <svg
        ref={setSvgElement}
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
              const isPulsing =
                !isSpiking && !prefersReducedMotion && areAnimationsPlaying;
              const pulseDelay =
                spikingNode?.pulseDelay ?? safeDelay(node.animationDelay);

              return (
                <g
                  key={`node-${i}`}
                  // Hidden under a cover: its pulse rests (motion.css).
                  data-anim={
                    isHidden(node.y, rowsAboveCover) ? "off" : undefined
                  }
                >
                  <circle
                    cx={node.x * gridCellSize}
                    cy={node.y * gridCellSize}
                    r={validateRadius(radiusValue, "4", "GridBackground", {
                      nodeKey,
                      isSpiking,
                    })}
                    className={cn(
                      "fill-orange-500/60 dark:fill-orange-400/50",
                      // r 4 -> 5 -> 4 and opacity 0.8 -> 1 -> 0.8 over 3 s
                      // (motion.css); this was a pair of SMIL <animate>s.
                      // anim-decor: pauses with the page or the grid.
                      isPulsing && "grid-pulse anim-decor",
                    )}
                    filter="url(#nodeGlow)"
                    style={{
                      // Only `transform` changes here, and it must stay a
                      // transition so a spike eases rather than snaps.
                      //
                      // `all` cannot be used: `r` and `opacity` on this same
                      // circle are animated (by SMIL until 2026-10, now by the
                      // grid-pulse keyframes). With SMIL, `transition: all`
                      // started a fresh transition on every sample: ~66
                      // CSSTransitions ran permanently on the two mounted
                      // grids and drove ~43 style recalculations per frame,
                      // each of which re-rasterized a viewport-sized filtered
                      // SVG layer.
                      transition: `transform ${DEFAULT_SPIKING_CONFIG.spikeDuration}ms ease-out`,
                      transform: isSpiking
                        ? `scale(${DEFAULT_SPIKING_CONFIG.spikeScale})`
                        : "scale(1)",
                      transformOrigin: `${node.x * gridCellSize}px ${node.y * gridCellSize}px`,
                      animationDelay: isPulsing ? `${pulseDelay}s` : undefined,
                    }}
                  />
                  {isSpiking &&
                    !prefersReducedMotion &&
                    areAnimationsPlaying && (
                      <circle
                        cx={node.x * gridCellSize}
                        cy={node.y * gridCellSize}
                        r="10"
                        // r 6 -> 16 -> 20 and opacity 0.8 -> 0.4 -> 0, once
                        className="fill-orange-500/40 dark:fill-orange-400/30 grid-burst"
                        opacity="0"
                        style={{
                          animationDuration: `${typeof DEFAULT_SPIKING_CONFIG.spikeDuration === "number" && isFinite(DEFAULT_SPIKING_CONFIG.spikeDuration) ? DEFAULT_SPIKING_CONFIG.spikeDuration : 300}ms`,
                        }}
                      />
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

/**
 * Memoised: AppWrapper re-renders on its own state (the splash ending, the
 * terminal opening), and each of those re-rendered every node, line and
 * curve of the site grid for nothing; its props are three primitives.
 */
export const GridBackground = memo(GridBackgroundImpl);
