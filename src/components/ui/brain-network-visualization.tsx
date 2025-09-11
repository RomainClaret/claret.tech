"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useAnimationManager } from "@/lib/animation-manager";
import { useAnimationState } from "@/contexts/animation-state-context";
import { useQuality, NEURAL_CANVAS_PROFILE } from "@/contexts/quality-context";
import {
  BRAIN_NODES,
  BRAIN_CONTOUR_CONNECTIONS,
  generateInternalNodes,
  generateInternalConnections,
  transformToCanvas,
  getNodeRadius,
  type BrainNode,
  type BrainConnection,
} from "@/lib/utils/brain-network-data";

interface BrainNetworkVisualizationProps {
  className?: string;
  width?: number;
  height?: number;
  isPulsing?: boolean;
  opacity?: number;
  interactive?: boolean;
  showInternalConnections?: boolean;
  onNodesReady?: (nodes: { x: number; y: number; id: string }[]) => void;
}

interface CanvasNode extends BrainNode {
  canvasX: number;
  canvasY: number;
  baseX: number; // Original position for contour nodes
  baseY: number; // Original position for contour nodes
  canvasRadius: number;
  glowIntensity: number;
  pulsePhase: number;
  movePhaseX: number; // Phase for X movement
  movePhaseY: number; // Phase for Y movement
}

interface Signal {
  id: string;
  fromNode: string;
  toNode: string;
  progress: number;
  speed: number;
}

// Color scheme matching the website design (maximum visibility)
const BRAIN_COLORS = {
  large: {
    core: "rgba(255, 255, 255, 1)",
    inner: "rgba(0, 191, 255, 1)",
    outer: "rgba(0, 191, 255, 0.7)",
  },
  medium: {
    core: "rgba(0, 230, 255, 1)",
    inner: "rgba(79, 195, 247, 0.9)",
    outer: "rgba(79, 195, 247, 0.6)",
  },
  small: {
    core: "rgba(79, 195, 247, 1)",
    inner: "rgba(33, 150, 243, 0.7)",
    outer: "rgba(33, 150, 243, 0.4)",
  },
  connection: {
    idle: "rgba(0, 150, 220, 0.5)",
    active: "rgba(0, 191, 255, 0.8)",
  },
  signal: {
    core: "rgba(255, 255, 255, 1)",
    glow: "rgba(0, 191, 255, 0.9)",
  },
};

export function BrainNetworkVisualization({
  className,
  width = 400,
  height = 400,
  isPulsing = false,
  opacity = 1,
  interactive = true,
  showInternalConnections = true,
  onNodesReady,
}: BrainNetworkVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [isVisible, setIsVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();
  const animationControl = useAnimationManager("brain-network", "high");
  const { areAnimationsPlaying } = useAnimationState();
  const { getConfig } = useQuality();
  const config = getConfig(NEURAL_CANVAS_PROFILE);

  const nodesRef = useRef<CanvasNode[]>([]);
  const signalsRef = useRef<Signal[]>([]);
  const connectionsRef = useRef<BrainConnection[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const hoveredNodeRef = useRef<string | null>(null);
  const timeRef = useRef(0);
  const lastSignalTimeRef = useRef(0);

  // Initialize nodes with canvas positions
  useEffect(() => {
    // Get contour nodes (static)
    const contourNodes = BRAIN_NODES.filter((node) =>
      node.id.startsWith("contour"),
    );

    // Generate or filter nodes based on whether we should show internal connections
    const nodesToRender = showInternalConnections
      ? [...contourNodes, ...generateInternalNodes()]
      : contourNodes;

    const canvasNodes: CanvasNode[] = nodesToRender.map((node) => {
      const { x, y } = transformToCanvas(node.x, node.y, width, height);
      const radius = getNodeRadius(node, Math.min(width, height));

      return {
        ...node,
        canvasX: x,
        canvasY: y,
        baseX: x, // Store original position
        baseY: y, // Store original position
        canvasRadius: radius,
        glowIntensity: 0.5 + Math.random() * 0.3,
        pulsePhase: Math.random() * Math.PI * 2,
        movePhaseX: Math.random() * Math.PI * 2,
        movePhaseY: Math.random() * Math.PI * 2,
      };
    });

    nodesRef.current = canvasNodes;

    // Notify parent component about contour node positions (for interest connections)
    if (onNodesReady) {
      // Only pass contour nodes for connection points
      // Transform from canvas space (0-300) to SVG space (-150 to +150)
      const contourNodesForConnections = canvasNodes
        .filter((node) => node.id.startsWith("contour"))
        .map((node) => ({
          x: node.canvasX - width / 2, // Center at 0,0
          y: node.canvasY - height / 2, // Center at 0,0
          id: node.id,
        }));
      onNodesReady(contourNodesForConnections);
    }

    // Generate dynamic connections (static contour + random internal if enabled)
    const dynamicConnections = showInternalConnections
      ? [...BRAIN_CONTOUR_CONNECTIONS, ...generateInternalConnections()]
      : [...BRAIN_CONTOUR_CONNECTIONS];
    connectionsRef.current = dynamicConnections;

    // Initialize signals using the dynamic connections
    const initialSignals: Signal[] = [];
    for (let i = 0; i < 5; i++) {
      const connection =
        dynamicConnections[
          Math.floor(Math.random() * dynamicConnections.length)
        ];
      initialSignals.push({
        id: `signal-${i}`,
        fromNode: connection.from,
        toNode: connection.to,
        progress: Math.random(),
        speed: 0.3 + Math.random() * 0.4,
      });
    }
    signalsRef.current = initialSignals;
  }, [width, height, showInternalConnections, onNodesReady]);

  // Draw static frame
  const drawStaticFrame = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Ensure nodes are initialized before drawing
    if (!nodesRef.current.length || !connectionsRef.current.length) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = opacity;

    // Draw static connections
    for (const connection of connectionsRef.current) {
      const fromNode = nodesRef.current.find((n) => n.id === connection.from);
      const toNode = nodesRef.current.find((n) => n.id === connection.to);

      if (fromNode && toNode) {
        ctx.strokeStyle = BRAIN_COLORS.connection.idle;
        ctx.lineWidth = connection.strength * 2;
        ctx.globalAlpha = connection.strength * opacity * 0.6;

        ctx.beginPath();
        ctx.moveTo(fromNode.canvasX, fromNode.canvasY);
        ctx.lineTo(toNode.canvasX, toNode.canvasY);
        ctx.stroke();
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }
    }

    // Draw static nodes
    const sortedNodes = [...nodesRef.current].sort((a, b) => {
      const sizeOrder = { small: 0, medium: 1, large: 2 };
      return sizeOrder[a.size] - sizeOrder[b.size];
    });

    for (const node of sortedNodes) {
      const radius = node.canvasRadius;
      const colors = BRAIN_COLORS[node.size];

      // Draw glow
      const glowGradient = ctx.createRadialGradient(
        node.canvasX,
        node.canvasY,
        0,
        node.canvasX,
        node.canvasY,
        radius * 2.5,
      );
      glowGradient.addColorStop(0, colors.outer);
      glowGradient.addColorStop(1, "transparent");

      ctx.fillStyle = glowGradient;
      ctx.globalAlpha = 0.6 * opacity;
      ctx.beginPath();
      ctx.arc(node.canvasX, node.canvasY, radius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw core
      const coreGradient = ctx.createRadialGradient(
        node.canvasX,
        node.canvasY,
        0,
        node.canvasX,
        node.canvasY,
        radius * 0.8,
      );
      coreGradient.addColorStop(0, colors.core);
      coreGradient.addColorStop(0.5, colors.inner);
      coreGradient.addColorStop(1, colors.inner);

      ctx.fillStyle = coreGradient;
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.arc(node.canvasX, node.canvasY, radius * 0.9, 0, Math.PI * 2);
      ctx.fill();

      // Add edge ring
      ctx.strokeStyle = colors.inner;
      ctx.lineWidth = 1;
      ctx.globalAlpha = opacity * 0.8;
      ctx.beginPath();
      ctx.arc(node.canvasX, node.canvasY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [width, height, opacity]);

  // Draw static frame when nodes are ready and animations are disabled
  useEffect(() => {
    if (
      nodesRef.current.length > 0 &&
      (!areAnimationsPlaying || !config.animate) &&
      !prefersReducedMotion &&
      isVisible
    ) {
      drawStaticFrame();
    }
  }, [
    areAnimationsPlaying,
    config.animate,
    prefersReducedMotion,
    isVisible,
    drawStaticFrame,
  ]);

  // Register with animation manager
  useEffect(() => {
    animationControl.register(
      () => {}, // onPause
      () => {}, // onResume
    );
  }, [animationControl]);

  // Intersection Observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [animationControl]);

  // Mouse interaction
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mouseRef.current = { x, y };

    // Find hovered node
    let closestNode: string | null = null;
    let closestDistance = Infinity;

    for (const node of nodesRef.current) {
      const dx = node.canvasX - x;
      const dy = node.canvasY - y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < node.canvasRadius * 3 && distance < closestDistance) {
        closestNode = node.id;
        closestDistance = distance;
      }
    }

    hoveredNodeRef.current = closestNode;
  };

  // Animation loop
  useEffect(() => {
    if (
      !canvasRef.current ||
      !isVisible ||
      prefersReducedMotion ||
      !config.animate
    )
      return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const animate = (timestamp: number) => {
      timeRef.current = timestamp / 1000;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = opacity;

      // Draw connections
      for (const connection of connectionsRef.current) {
        const fromNode = nodesRef.current.find((n) => n.id === connection.from);
        const toNode = nodesRef.current.find((n) => n.id === connection.to);

        if (fromNode && toNode) {
          // Check if this connection has an active signal
          const hasSignal = signalsRef.current.some(
            (s) =>
              (s.fromNode === connection.from && s.toNode === connection.to) ||
              (s.fromNode === connection.to && s.toNode === connection.from),
          );

          ctx.strokeStyle = hasSignal
            ? BRAIN_COLORS.connection.active
            : BRAIN_COLORS.connection.idle;
          ctx.lineWidth = connection.strength * 2; // Sharper line width
          ctx.globalAlpha = connection.strength * opacity * 0.8; // Higher opacity for clarity

          // Add subtle shadow for depth
          ctx.shadowColor = "rgba(0, 191, 255, 0.3)";
          ctx.shadowBlur = 2;

          ctx.beginPath();
          ctx.moveTo(fromNode.canvasX, fromNode.canvasY);
          ctx.lineTo(toNode.canvasX, toNode.canvasY);
          ctx.stroke();

          ctx.shadowBlur = 0; // Reset shadow
        }
      }

      // Update and draw signals
      const activeSignals: Signal[] = [];

      for (const signal of signalsRef.current) {
        signal.progress += signal.speed * 0.015;

        if (signal.progress <= 1) {
          const fromNode = nodesRef.current.find(
            (n) => n.id === signal.fromNode,
          );
          const toNode = nodesRef.current.find((n) => n.id === signal.toNode);

          if (fromNode && toNode) {
            const x =
              fromNode.canvasX +
              (toNode.canvasX - fromNode.canvasX) * signal.progress;
            const y =
              fromNode.canvasY +
              (toNode.canvasY - fromNode.canvasY) * signal.progress;

            // Draw signal (sharper with defined core)
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, 6);
            gradient.addColorStop(0, BRAIN_COLORS.signal.core);
            gradient.addColorStop(0.3, BRAIN_COLORS.signal.glow);
            gradient.addColorStop(1, "rgba(0, 191, 255, 0)");

            ctx.fillStyle = gradient;
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();

            // Add bright core for sharpness
            ctx.fillStyle = BRAIN_COLORS.signal.core;
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();

            activeSignals.push(signal);
          }
        }
      }

      // Create new signals periodically (only if animations are enabled)
      if (
        timestamp - lastSignalTimeRef.current > 1000 &&
        activeSignals.length < 8 &&
        areAnimationsPlaying &&
        !prefersReducedMotion &&
        config.animate
      ) {
        const connection =
          connectionsRef.current[
            Math.floor(Math.random() * connectionsRef.current.length)
          ];
        // Generate unique ID to prevent duplicate key errors
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        activeSignals.push({
          id: `signal-${timestamp}-${random}`,
          fromNode: connection.from,
          toNode: connection.to,
          progress: 0,
          speed: 0.3 + Math.random() * 0.4,
        });
        lastSignalTimeRef.current = timestamp;
      }

      signalsRef.current = activeSignals;

      // Draw nodes (sorted by size for proper layering)
      const sortedNodes = [...nodesRef.current].sort((a, b) => {
        const sizeOrder = { small: 0, medium: 1, large: 2 };
        return sizeOrder[a.size] - sizeOrder[b.size];
      });

      for (const node of sortedNodes) {
        const isHovered = hoveredNodeRef.current === node.id;
        const pulseScale = isPulsing
          ? 1 + Math.sin(timeRef.current * 2 + node.pulsePhase) * 0.1
          : 1;
        const radius = node.canvasRadius * pulseScale * (isHovered ? 1.2 : 1);

        // Apply subtle movement to contour nodes
        if (
          node.id.startsWith("contour") &&
          !prefersReducedMotion &&
          areAnimationsPlaying &&
          config.animate
        ) {
          const moveAmplitude = 2; // Maximum movement in pixels
          const moveSpeed = 0.5; // Speed of movement

          // Calculate offset from base position
          const offsetX =
            Math.sin(timeRef.current * moveSpeed + node.movePhaseX) *
            moveAmplitude;
          const offsetY =
            Math.cos(timeRef.current * moveSpeed * 0.8 + node.movePhaseY) *
            moveAmplitude;

          // Update node position while keeping it tethered to base
          node.canvasX = node.baseX + offsetX;
          node.canvasY = node.baseY + offsetY;
        }

        // Apply movement to internal nodes for organic feeling
        if (
          node.id.startsWith("node") &&
          !prefersReducedMotion &&
          areAnimationsPlaying &&
          config.animate
        ) {
          const moveAmplitude = 3.5; // Slightly more movement for internal nodes
          const moveSpeed = 0.6; // Different speed for variety

          // Calculate offset with different speed multipliers for more organic motion
          const offsetX =
            Math.sin(timeRef.current * moveSpeed + node.movePhaseX) *
            moveAmplitude;
          const offsetY =
            Math.cos(timeRef.current * moveSpeed * 0.7 + node.movePhaseY) *
            moveAmplitude;

          // Update node position while keeping it tethered to base
          node.canvasX = node.baseX + offsetX;
          node.canvasY = node.baseY + offsetY;
        }

        // Update glow intensity
        if (isHovered) {
          node.glowIntensity = Math.min(1, node.glowIntensity + 0.05);
        } else {
          node.glowIntensity *= 0.98;
          node.glowIntensity = Math.max(0.3, node.glowIntensity);
        }

        const colors = BRAIN_COLORS[node.size];

        // Draw outer glow (sharper with less spread)
        const glowGradient = ctx.createRadialGradient(
          node.canvasX,
          node.canvasY,
          0,
          node.canvasX,
          node.canvasY,
          radius * 2.5,
        );
        glowGradient.addColorStop(0, colors.inner);
        glowGradient.addColorStop(0.3, colors.outer);
        glowGradient.addColorStop(1, "rgba(0, 191, 255, 0)");

        ctx.fillStyle = glowGradient;
        ctx.globalAlpha = node.glowIntensity * opacity * 0.6;
        ctx.beginPath();
        ctx.arc(node.canvasX, node.canvasY, radius * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Draw node core (sharper with defined edge)
        const coreGradient = ctx.createRadialGradient(
          node.canvasX,
          node.canvasY,
          0,
          node.canvasX,
          node.canvasY,
          radius * 0.8,
        );
        coreGradient.addColorStop(0, colors.core);
        coreGradient.addColorStop(0.5, colors.inner);
        coreGradient.addColorStop(1, colors.inner);

        ctx.fillStyle = coreGradient;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.arc(node.canvasX, node.canvasY, radius * 0.9, 0, Math.PI * 2);
        ctx.fill();

        // Add sharp edge ring
        ctx.strokeStyle = colors.inner;
        ctx.lineWidth = 1;
        ctx.globalAlpha = opacity * 0.8;
        ctx.beginPath();
        ctx.arc(node.canvasX, node.canvasY, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Add highlight for large nodes
        if (node.size === "large") {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.4 * opacity;
          ctx.beginPath();
          ctx.arc(node.canvasX, node.canvasY, radius * 0.8, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Only continue animation if animations are enabled
      if (areAnimationsPlaying && config.animate) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    // Always draw initial frame, but only animate if animations are enabled
    if (areAnimationsPlaying && config.animate) {
      animate(0);
    } else {
      // Draw static frame when animations are disabled (only if nodes are ready)
      if (nodesRef.current.length > 0) {
        drawStaticFrame();
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    width,
    height,
    isPulsing,
    opacity,
    isVisible,
    prefersReducedMotion,
    areAnimationsPlaying,
    config.animate,
    drawStaticFrame,
  ]);

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          hoveredNodeRef.current = null;
        }}
        style={{
          imageRendering: "auto",
        }}
      />
    </div>
  );
}
