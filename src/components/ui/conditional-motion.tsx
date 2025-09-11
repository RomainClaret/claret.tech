"use client";

import React from "react";
import { motion } from "framer-motion";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { cn } from "@/lib/utils";
import type { MotionValue, MotionTransition } from "@/test/mock-types";

interface ConditionalMotionProps {
  children?: React.ReactNode;
  className?: string;
  fallbackClassName?: string;
  priority?: "low" | "medium" | "high";
  as?: "div" | "span" | "section" | "article" | "header" | "main" | "footer";
  // Common motion props
  animate?: MotionValue;
  initial?: MotionValue;
  exit?: MotionValue;
  transition?: MotionTransition;
  style?: React.CSSProperties;
  [key: string]: unknown; // Allow other motion props
}

/**
 * ConditionalMotion wrapper that renders Framer Motion animations only when appropriate
 *
 * On Safari or when animations should be reduced:
 * - Renders a static div with fallbackClassName
 * - Completely bypasses Framer Motion to avoid performance overhead
 *
 * On other browsers:
 * - Renders full Framer Motion with all animations
 *
 * Priority system (future-ready for animation budget):
 * - high: Always animate (critical UI feedback)
 * - medium: Animate unless performance is poor
 * - low: Animate only on high-performance browsers
 */
export function ConditionalMotion({
  children,
  className,
  fallbackClassName = "",
  priority: _priority = "low", // Future use for animation budget
  as = "div",
  animate,
  initial,
  exit,
  transition,
  style,
  ...otherProps
}: ConditionalMotionProps) {
  const shouldReduceAnimations = useShouldReduceAnimations();

  // Render static element for Safari or reduced motion preference
  if (shouldReduceAnimations) {
    const Component = as as keyof JSX.IntrinsicElements;
    return (
      <Component
        className={cn(className, fallbackClassName)}
        style={style}
        {...otherProps}
      >
        {children}
      </Component>
    );
  }

  // Render full Framer Motion for other browsers
  const MotionComponent = motion[as] as React.ComponentType<
    React.HTMLAttributes<HTMLElement> & {
      animate?: MotionValue;
      initial?: MotionValue;
      exit?: MotionValue;
      transition?: MotionTransition;
    }
  >;
  return (
    <MotionComponent
      className={className}
      animate={animate}
      initial={initial}
      exit={exit}
      transition={transition}
      style={style}
      {...otherProps}
    >
      {children}
    </MotionComponent>
  );
}
