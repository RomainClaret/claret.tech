"use client";

import { cn } from "@/lib/utils";
import { useInViewAnimation } from "@/lib/hooks/useInViewAnimation";
import { forwardRef, HTMLAttributes } from "react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";

/**
 * The entrances the site ships, written out so Tailwind keeps their classes.
 *
 * These were built at runtime (`animate-${name}`, `animation-delay-${ms}`),
 * which Tailwind cannot see: only classes some other file happened to spell
 * out reached the CSS. So a `delay` did nothing except at 200 ms, the slides
 * in from the left and right never moved, and the fade never showed either,
 * as globals.css forces `opacity: 1` on these classes. What is left is what
 * the page has always shown: a 20 px rise, and a grow from 90%, as content
 * scrolls in.
 */
const ENTRANCES = {
  "slide-in-up": "animate-slide-in-up",
  "scale-in": "animate-scale-in",
} as const;

interface AnimatedProps extends HTMLAttributes<HTMLDivElement> {
  animation: keyof typeof ENTRANCES;
  threshold?: number;
  children: React.ReactNode;
}

const Animated = forwardRef<HTMLDivElement, AnimatedProps>(
  (
    { animation, threshold = 0.1, className, children, ...props },
    forwardedRef,
  ) => {
    const { ref, isInView } = useInViewAnimation({ threshold });
    const prefersReducedMotion = useReducedMotion();
    const shouldReduceAnimations = useShouldReduceAnimations();

    // Skip animations if reduced motion is preferred OR Safari optimizations are enabled
    const shouldAnimate =
      isInView && !prefersReducedMotion && !shouldReduceAnimations;

    return (
      <div
        ref={(node) => {
          // Handle the ref from useInViewAnimation
          if (node && ref.current !== node) {
            (ref as React.MutableRefObject<HTMLElement | null>).current = node;
          }
          // Handle forwarded ref
          if (typeof forwardedRef === "function") {
            forwardedRef(node);
          } else if (forwardedRef) {
            forwardedRef.current = node;
          }
        }}
        className={cn(shouldAnimate && ENTRANCES[animation], className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Animated.displayName = "Animated";

type EntranceProps = Omit<AnimatedProps, "animation">;

export const SlideInUp = forwardRef<HTMLDivElement, EntranceProps>(
  (props, ref) => <Animated ref={ref} animation="slide-in-up" {...props} />,
);
SlideInUp.displayName = "SlideInUp";

export const ScaleIn = forwardRef<HTMLDivElement, EntranceProps>(
  (props, ref) => <Animated ref={ref} animation="scale-in" {...props} />,
);
ScaleIn.displayName = "ScaleIn";
