"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { useAnimationState } from "@/contexts/animation-state-context";
import { useQuality, TYPEWRITER_PROFILE } from "@/contexts/quality-context";

// Dynamic import for typewriter effect
const Typewriter = dynamic(() => import("typewriter-effect"), {
  ssr: false,
  loading: () => null,
});

interface TypeWriterProps {
  strings: string[];
  className?: string;
  isPaused?: boolean;
}

// Global counter for unique TypeWriter instance IDs
let typewriterInstanceCounter = 0;

export function TypeWriter({
  strings,
  className = "",
  isPaused = false,
}: TypeWriterProps) {
  const [isClient, setIsClient] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [key, setKey] = useState(0);
  const [currentStringIndex, setCurrentStringIndex] = useState(0);
  const instanceIdRef = useRef(`tw-${++typewriterInstanceCounter}`);
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceAnimations = useShouldReduceAnimations();
  const { areAnimationsPlaying } = useAnimationState();
  const { getConfig } = useQuality();
  const config = getConfig(TYPEWRITER_PROFILE);

  useEffect(() => {
    setIsClient(true);
    // Small delay to ensure smooth transition
    const timer = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Force re-render when pause state or animation settings change
  useEffect(() => {
    if (isPaused) {
      setKey((prev) => prev + 1);
    }
  }, [isPaused]);

  // Force re-render when animation state or quality changes
  useEffect(() => {
    setKey((prev) => prev + 1); // Increment counter for unique keys
  }, [areAnimationsPlaying, config.animate]);

  // Cycle through strings when reduced motion is preferred, Safari performance optimization, or animations are disabled
  useEffect(() => {
    if (
      (prefersReducedMotion ||
        shouldReduceAnimations ||
        !areAnimationsPlaying ||
        !config.animate) &&
      !isPaused &&
      strings.length > 1
    ) {
      const interval = setInterval(
        () => {
          setCurrentStringIndex((prev) => (prev + 1) % strings.length);
        },
        shouldReduceAnimations ? 4000 : 3000,
      ); // Slower change for Safari

      return () => clearInterval(interval);
    }
  }, [
    prefersReducedMotion,
    shouldReduceAnimations,
    areAnimationsPlaying,
    config.animate,
    isPaused,
    strings.length,
  ]);

  // Show static text during SSR and initial load
  if (!isClient || !isLoaded) {
    return (
      <span className={className}>
        {strings[0]}
        <span className="animate-pulse">|</span>
      </span>
    );
  }

  // Show static text with transitions when reduced motion is preferred, Safari optimization, or animations are disabled
  if (
    prefersReducedMotion ||
    shouldReduceAnimations ||
    !areAnimationsPlaying ||
    !config.animate
  ) {
    return (
      <span className={className}>
        {strings[currentStringIndex]}
        <span
          className={
            prefersReducedMotion ||
            shouldReduceAnimations ||
            !areAnimationsPlaying ||
            !config.animate
              ? ""
              : "animate-pulse"
          }
        >
          |
        </span>
      </span>
    );
  }

  // Use conditional rendering for complete component remount when animation settings change
  if (areAnimationsPlaying && config.animate) {
    return (
      <Typewriter
        key={`${instanceIdRef.current}-${key}`}
        options={{
          strings,
          autoStart: !isPaused,
          loop: !isPaused,
          delay: 75,
          deleteSpeed: 50,
          cursor: "|",
          wrapperClassName: className,
          cursorClassName: `${className} animate-pulse`,
        }}
      />
    );
  }

  // Fallback to static text when animations are disabled
  return (
    <span className={className}>
      {strings[currentStringIndex]}
      <span>|</span>
    </span>
  );
}
