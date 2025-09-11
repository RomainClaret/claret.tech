"use client";

import { motion, useAnimation } from "framer-motion";
import { cn } from "@/lib/utils";
import { Publication } from "@/lib/api/fetch-publications";
import { useEffect, useState } from "react";
import { BookOpen, Quote, Users, Calendar } from "lucide-react";

export interface ResearchNodeData extends Publication {
  x: number;
  y: number;
  radius: number;
  color: string;
  influence: number; // Calculated from citations and connections
}

interface ResearchNodeProps {
  node: ResearchNodeData;
  isSelected: boolean;
  isHighlighted: boolean;
  isConnected: boolean;
  onSelect: (node: ResearchNodeData) => void;
  onHover: (node: ResearchNodeData | null) => void;
  delay?: number;
  viewMode: "network" | "grid";
}

export function ResearchNode({
  node,
  isSelected,
  isHighlighted,
  isConnected,
  onSelect,
  onHover,
  delay = 0,
  viewMode,
}: ResearchNodeProps) {
  const controls = useAnimation();
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (isHighlighted || isSelected) {
      controls.start("highlighted");
      setShowDetails(true);
    } else if (isConnected) {
      controls.start("connected");
      setShowDetails(false);
    } else {
      controls.start("idle");
      setShowDetails(false);
    }
  }, [isHighlighted, isSelected, isConnected, controls]);

  const variants = {
    hidden: {
      scale: 0,
      opacity: 0,
    },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        delay,
        type: "spring" as const,
        stiffness: 200,
        damping: 20,
      },
    },
    idle: {
      scale: 1,
      opacity: 0.8,
      transition: {
        duration: 0.3,
      },
    },
    connected: {
      scale: 1.1,
      opacity: 0.9,
      transition: {
        duration: 0.3,
      },
    },
    highlighted: {
      scale: 1.3,
      opacity: 1,
      transition: {
        duration: 0.3,
      },
    },
  };

  const pulseVariants = {
    idle: {
      scale: [1, 1.2, 1],
      opacity: [0.3, 0.1, 0.3],
      transition: {
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut" as const,
        delay: Math.random() * 2,
      },
    },
  };

  // Calculate node size based on influence
  const nodeSize = Math.max(40, Math.min(80, 40 + node.influence * 40));

  if (viewMode === "grid") {
    return null; // Grid view is handled by the Papers component
  }

  return (
    <motion.div
      className="absolute"
      style={{
        left: node.x,
        top: node.y,
        transform: "translate(-50%, -50%)",
      }}
      initial="hidden"
      animate="visible"
      variants={variants}
      onMouseEnter={() => onHover(node)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(node)}
    >
      {/* Outer glow effect */}
      <motion.div
        className={cn(
          "absolute inset-0 rounded-full blur-xl transition-all duration-300",
        )}
        style={{
          background: `radial-gradient(circle, ${node.color} 0%, transparent 70%)`,
          width: `${nodeSize * 2.5}px`,
          height: `${nodeSize * 2.5}px`,
          transform: "translate(-50%, -50%)",
          left: "50%",
          top: "50%",
        }}
        initial={{ opacity: 0.3 }}
        animate={{
          opacity: isHighlighted || isSelected ? 0.6 : 0.3,
        }}
      />

      {/* Pulse effect for high-citation papers */}
      {node.citations && node.citations > 10 && (
        <motion.div
          className="absolute"
          style={{
            width: `${nodeSize * 1.5}px`,
            height: `${nodeSize * 1.5}px`,
            transform: "translate(-50%, -50%)",
            left: "50%",
            top: "50%",
          }}
          variants={pulseVariants}
          animate="idle"
        >
          <div
            className="w-full h-full rounded-full border-2"
            style={{
              borderColor: node.color,
              opacity: 0.5,
            }}
          />
        </motion.div>
      )}

      {/* Glass morphism container */}
      <motion.div
        className={cn(
          "relative rounded-full cursor-pointer",
          "backdrop-blur-md bg-white/10 dark:bg-black/10",
          "border border-white/20 dark:border-white/10",
          "shadow-lg shadow-black/10",
          "transition-all duration-300",
          isHighlighted && "shadow-2xl shadow-black/20",
          "focus:outline-none focus:ring-2 focus:ring-offset-2",
          "focus:ring-primary focus:ring-offset-background",
          "flex items-center justify-center",
        )}
        style={{
          width: `${nodeSize}px`,
          height: `${nodeSize}px`,
        }}
        animate={controls}
        role="button"
        tabIndex={0}
        aria-label={`${node.title} - ${node.year}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(node);
          }
        }}
      >
        {/* Inner gradient */}
        <div
          className="absolute inset-2 rounded-full"
          style={{
            background: `linear-gradient(135deg, ${node.color} 0%, ${node.color}88 100%)`,
            opacity: isHighlighted || isSelected ? 0.9 : 0.7,
          }}
        />

        {/* Icon based on paper type */}
        <div className="relative z-10 text-white">
          {node.title.toLowerCase().includes("thesis") ? (
            <BookOpen className="w-5 h-5" />
          ) : node.citations && node.citations > 50 ? (
            <Quote className="w-5 h-5" />
          ) : (
            <div className="text-xs font-bold">{node.year.slice(-2)}</div>
          )}
        </div>

        {/* Citation count badge */}
        {node.citations && node.citations > 0 && (
          <div
            className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
            style={{
              fontSize: "10px",
              minWidth: "20px",
              textAlign: "center",
            }}
          >
            {node.citations}
          </div>
        )}
      </motion.div>

      {/* Hover details */}
      <motion.div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 pointer-events-none z-50",
          "bg-background/95 backdrop-blur-md",
          "border border-border/50",
          "rounded-lg px-4 py-3 shadow-xl",
          "max-w-xs",
        )}
        style={{
          top: `-${nodeSize / 2 + 80}px`,
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: showDetails ? 1 : 0,
          y: showDetails ? 0 : 10,
        }}
        transition={{ duration: 0.2 }}
      >
        <div className="text-sm font-semibold line-clamp-2 mb-1">
          {node.title}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Users className="w-3 h-3" />
          <span className="line-clamp-1">
            {node.authors.slice(0, 2).join(", ")}
            {node.authors.length > 2 && ` +${node.authors.length - 2}`}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          <span>
            {node.venue || "Publication"} • {node.year}
          </span>
        </div>
        {node.abstract && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {node.abstract}
          </p>
        )}
        {/* Tooltip arrow */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
          style={{
            bottom: "-6px",
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: "6px solid rgb(var(--border) / 0.5)",
          }}
        />
      </motion.div>
    </motion.div>
  );
}
