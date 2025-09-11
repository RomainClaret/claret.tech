"use client";

import { cn } from "@/lib/utils";
import { useInViewAnimation } from "@/lib/hooks/useInViewAnimation";
import { forwardRef, HTMLAttributes } from "react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";

interface AnimatedProps extends HTMLAttributes<HTMLDivElement> {
  animation?:
    | "fade-in"
    | "slide-in-up"
    | "slide-in-down"
    | "slide-in-left"
    | "slide-in-right"
    | "scale-in";
  delay?: number;
  threshold?: number;
  children: React.ReactNode;
}

export const Animated = forwardRef<HTMLDivElement, AnimatedProps>(
  (
    {
      animation = "fade-in",
      delay = 0,
      threshold = 0.1,
      className,
      children,
      ...props
    },
    forwardedRef,
  ) => {
    const { ref, isInView } = useInViewAnimation({ threshold });
    const prefersReducedMotion = useReducedMotion();
    const shouldReduceAnimations = useShouldReduceAnimations();

    const animationClass = `animate-${animation}`;
    const delayClass = delay > 0 ? `animation-delay-${delay}` : "";

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
        className={cn(
          shouldAnimate ? animationClass : "",
          shouldAnimate && delayClass,
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Animated.displayName = "Animated";

// Convenience components for common animations
export const FadeIn = forwardRef<
  HTMLDivElement,
  Omit<AnimatedProps, "animation">
>((props, ref) => <Animated ref={ref} animation="fade-in" {...props} />);
FadeIn.displayName = "FadeIn";

export const SlideInUp = forwardRef<
  HTMLDivElement,
  Omit<AnimatedProps, "animation">
>((props, ref) => <Animated ref={ref} animation="slide-in-up" {...props} />);
SlideInUp.displayName = "SlideInUp";

export const SlideInDown = forwardRef<
  HTMLDivElement,
  Omit<AnimatedProps, "animation">
>((props, ref) => <Animated ref={ref} animation="slide-in-down" {...props} />);
SlideInDown.displayName = "SlideInDown";

export const SlideInLeft = forwardRef<
  HTMLDivElement,
  Omit<AnimatedProps, "animation">
>((props, ref) => <Animated ref={ref} animation="slide-in-left" {...props} />);
SlideInLeft.displayName = "SlideInLeft";

export const SlideInRight = forwardRef<
  HTMLDivElement,
  Omit<AnimatedProps, "animation">
>((props, ref) => <Animated ref={ref} animation="slide-in-right" {...props} />);
SlideInRight.displayName = "SlideInRight";

export const ScaleIn = forwardRef<
  HTMLDivElement,
  Omit<AnimatedProps, "animation">
>((props, ref) => <Animated ref={ref} animation="scale-in" {...props} />);
ScaleIn.displayName = "ScaleIn";
