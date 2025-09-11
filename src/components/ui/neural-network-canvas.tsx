"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useAnimationManager } from "@/lib/animation-manager";
import { useQuality, NEURAL_CANVAS_PROFILE } from "@/contexts/quality-context";

interface NeuralNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulsePhase: number;
  connections: number[];
  active: boolean;
}

interface NeuralNetworkCanvasProps {
  className?: string;
  nodeCount?: number;
  connectionDistance?: number;
  animationSpeed?: number;
  color?: string;
  opacity?: number;
  interactive?: boolean;
}

export function NeuralNetworkCanvas({
  className,
  nodeCount = 50,
  connectionDistance = 150,
  animationSpeed = 0.5,
  color = "139, 92, 246", // Purple color in RGB
  opacity = 0.3,
  interactive = true,
}: NeuralNetworkCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const { getConfig, quality } = useQuality();
  const config = getConfig(NEURAL_CANVAS_PROFILE);
  const nodesRef = useRef<NeuralNode[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 100, height: 100 });
  const [isVisible, setIsVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();
  const animationControl = useAnimationManager("neural-network-canvas", "high");
  const [isAnimationActive, setIsAnimationActive] = useState(false);

  // Initialize nodes with proper dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Round dimensions to integers for Safari compatibility
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    setDimensions({ width, height });

    // Adjust node count based on quality settings
    const effectiveNodeCount = Math.floor(nodeCount * (config.nodeScale || 1));
    const effectiveAnimationSpeed = config.animate ? animationSpeed : 0;

    // Create nodes with random positions and velocities
    nodesRef.current = Array.from({ length: effectiveNodeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * effectiveAnimationSpeed,
      vy: (Math.random() - 0.5) * effectiveAnimationSpeed,
      radius: Math.random() * 2 + 1,
      pulsePhase: Math.random() * Math.PI * 2,
      connections: [],
      active: false,
    }));
  }, [nodeCount, animationSpeed, config.nodeScale, config.animate, quality]);

  // Register with animation manager
  useEffect(() => {
    animationControl.register(
      () => setIsAnimationActive(false), // onPause
      () => setIsAnimationActive(true), // onResume
    );
  }, [animationControl]);

  // Intersection Observer for visibility-based pausing
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

    return () => {
      observer.disconnect();
    };
  }, [animationControl]);

  // Handle resize - simplified for Safari compatibility
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();

      // Round dimensions to integers for Safari compatibility
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);

      setDimensions({ width, height });

      // Set canvas size (simplified - no DPR scaling to avoid issues)
      canvas.width = width;
      canvas.height = height;

      // Set CSS size
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle mouse movement
  useEffect(() => {
    if (!interactive) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [interactive]);

  // Animation loop with FPS limiting
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // FPS limiting configuration
    const FPS_LIMIT = 30;
    const frameInterval = 1000 / FPS_LIMIT;
    let lastFrameTime = 0;

    // Render static frame for reduced motion
    const renderStaticFrame = () => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Draw static connections
      nodesRef.current.forEach((node) => {
        node.connections.forEach((j) => {
          const other = nodesRef.current[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const alpha =
            (1 - distance / connectionDistance) *
            (config.opacity || opacity) *
            0.5;

          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(other.x, other.y);
          ctx.strokeStyle = `rgba(${color}, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      });

      // Draw static nodes
      nodesRef.current.forEach((node) => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${(config.opacity || opacity) * 0.7})`;
        ctx.fill();
      });
    };

    const animate = (currentTime: number) => {
      // Only animate if visible, motion is allowed, animation manager allows it, and quality allows animation
      if (
        !isVisible ||
        prefersReducedMotion ||
        !isAnimationActive ||
        !config.animate
      ) {
        // Still render once for static display
        if (
          (prefersReducedMotion || !isAnimationActive) &&
          !ctx.canvas.getAttribute("data-rendered")
        ) {
          ctx.canvas.setAttribute("data-rendered", "true");
          renderStaticFrame();
        }
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      // FPS limiting - skip frame if too soon
      if (currentTime - lastFrameTime < frameInterval) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = currentTime;
      // Clear canvas
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Update node positions
      nodesRef.current.forEach((node) => {
        // Apply velocity
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off walls
        if (node.x < 0 || node.x > dimensions.width) node.vx *= -1;
        if (node.y < 0 || node.y > dimensions.height) node.vy *= -1;

        // Keep nodes within bounds
        node.x = Math.max(0, Math.min(dimensions.width, node.x));
        node.y = Math.max(0, Math.min(dimensions.height, node.y));

        // Update pulse phase
        node.pulsePhase += 0.02;

        // Check if near mouse
        if (interactive) {
          const dx = node.x - mouseRef.current.x;
          const dy = node.y - mouseRef.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          node.active = distance < connectionDistance;
        }
      });

      // Find connections
      nodesRef.current.forEach((node, i) => {
        node.connections = [];
        for (let j = i + 1; j < nodesRef.current.length; j++) {
          const other = nodesRef.current[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            node.connections.push(j);
          }
        }
      });

      // Draw connections
      nodesRef.current.forEach((node) => {
        node.connections.forEach((j) => {
          const other = nodesRef.current[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const alpha =
            (1 - distance / connectionDistance) * (config.opacity || opacity);

          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(other.x, other.y);
          ctx.strokeStyle = `rgba(${color}, ${alpha})`;
          ctx.lineWidth = node.active || other.active ? 2 : 1;
          ctx.stroke();

          // Draw signal particles on active connections
          if ((node.active || other.active) && Math.random() < 0.1) {
            const t = (Date.now() % 1000) / 1000;
            const px = node.x + (other.x - node.x) * t;
            const py = node.y + (other.y - node.y) * t;

            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color}, 0.8)`;
            ctx.fill();
          }
        });
      });

      // Draw nodes
      nodesRef.current.forEach((node) => {
        const pulse = Math.sin(node.pulsePhase) * 0.5 + 0.5;
        const radius = node.radius + (node.active ? pulse * 2 : 0);

        // Node glow
        if (node.active) {
          const gradient = ctx.createRadialGradient(
            node.x,
            node.y,
            0,
            node.x,
            node.y,
            radius * 4,
          );
          gradient.addColorStop(0, `rgba(${color}, 0.3)`);
          gradient.addColorStop(1, `rgba(${color}, 0)`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius * 4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Node core
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${node.active ? 0.8 : config.opacity || opacity})`;
        ctx.fill();

        // Node border
        ctx.strokeStyle = `rgba(${color}, ${node.active ? 1 : (config.opacity || opacity) * 1.5})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    dimensions,
    connectionDistance,
    color,
    opacity,
    interactive,
    isVisible,
    prefersReducedMotion,
    isAnimationActive,
    config.animate,
    config.opacity,
    quality, // Add quality to trigger re-render when it changes
  ]);

  return (
    <motion.canvas
      ref={canvasRef}
      className={cn("absolute inset-0", className)}
      initial={{ opacity: prefersReducedMotion ? 1 : 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 1 }}
      style={{
        width: "100%",
        height: "100%",
        pointerEvents: interactive ? "auto" : "none",
      }}
    />
  );
}
