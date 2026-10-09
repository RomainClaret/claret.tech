"use client";

import { useEffect, useState, useRef } from "react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { useAnimationGate } from "@/lib/hooks/useMotionGate";
import { useAnimationState } from "@/contexts/animation-state-context";
import { useQuality, TYPEWRITER_PROFILE } from "@/contexts/quality-context";
import { cn } from "@/lib/utils";

interface TypeWriterProps {
  strings: string[];
  className?: string;
  isPaused?: boolean;
}

/*
 * The cadence of the typewriter-effect library this replaces. It was set to
 * type every 75 ms and delete every 50 ms, but it acts only on the first
 * animation frame after a delay has passed, and every queued step (the
 * pause, the switch to deleting, the next phrase) waits a typing delay of
 * its own. Sampled on the site (2026-10-08, median): 80.7 ms per character,
 * 54.4 per deletion, a 1,720 ms hold and 161 ms to the next phrase, at a
 * headless frame rate of up to 120 Hz. The values below are the same queue
 * at 60 Hz.
 */
/** Between two typed characters: 5 frames. */
export const TYPE_MS = 83;
/** Between two deleted characters: 3 or 4 frames. */
export const DELETE_MS = 58;
/** From the last typed character to the first deletion. */
export const HOLD_MS = 1725;
/** From the last deletion to the next phrase's first character. */
export const NEXT_MS = 167;

interface TypingState {
  phrase: number;
  length: number;
  deleting: boolean;
}

/** The step after `state`, and how long to wait before taking it. */
function nextStep(
  state: TypingState,
  phrases: string[],
): { state: TypingState; delay: number } {
  const full = phrases[state.phrase] ?? "";
  if (!state.deleting) {
    return state.length < full.length
      ? { state: { ...state, length: state.length + 1 }, delay: TYPE_MS }
      : // The first deletion ends the hold.
        {
          state: {
            ...state,
            deleting: true,
            length: Math.max(0, state.length - 1),
          },
          delay: HOLD_MS,
        };
  }
  return state.length > 0
    ? { state: { ...state, length: state.length - 1 }, delay: DELETE_MS }
    : {
        state: {
          phrase: (state.phrase + 1) % phrases.length,
          length: 1,
          deleting: false,
        },
        delay: NEXT_MS,
      };
}

/**
 * Types each phrase, holds it, deletes it and moves on to the next, at the
 * library's cadence.
 *
 * The whole phrase is laid out from the first keystroke, with the part not
 * yet typed in transparent ink. A half-typed word therefore already sits on
 * the line it ends up on, instead of starting on one line and jumping to the
 * next as it grows (53 to 104 jumps per round of phrases, measured at 390 to
 * 1440 px), and on centered phone layouts the letters appear in place.
 *
 * The cursor takes no room: a plain inline anchor holds the glyph absolutely
 * positioned. As inline text, or as an inline-block, it would add a line
 * break opportunity in the middle of the word being typed.
 *
 * It waits while the hero is off screen, behind the splash or a modal, or in
 * a hidden tab (the motion gate), and takes up where it stopped.
 */
function AnimatedTyping({
  strings,
  className,
  isPaused,
}: Required<TypeWriterProps>) {
  const { ref, active } = useAnimationGate<HTMLDivElement>();
  const [state, setState] = useState<TypingState>({
    phrase: 0,
    length: 0,
    deleting: false,
  });
  // The parent passes a new array on every render; read the latest one when
  // a step is taken rather than restarting the timer for it.
  const phrasesRef = useRef(strings);
  phrasesRef.current = strings;
  const running = active && !isPaused && strings.length > 0;

  useEffect(() => {
    if (!running) return;
    const { state: next, delay } = nextStep(state, phrasesRef.current);
    const timer = setTimeout(() => setState(next), delay);
    return () => clearTimeout(timer);
  }, [running, state]);

  const full = strings[state.phrase] ?? "";
  const typed = full.slice(0, state.length);
  const rest = full.slice(state.length);

  return (
    <div ref={ref} className="Typewriter">
      <span className={className}>{typed}</span>
      <span className="relative">
        {/* No offsets: at its static position the glyph sits exactly where
            the inline cursor did (measured 0 px off at 390, 1024 and 1440
            px; top-0 put it up to 2 px high).
            A new glyph per keystroke: one glyph moving along the line was a
            layout shift each time (CLS counts any element that moves), a new
            one is not. The negative delay puts every glyph at the same
            point of the 2 s animate-pulse loop for the same moment, so the
            blink carries on unbroken. */}
        <span
          key={`${state.phrase}:${state.length}`}
          className={cn(className, "animate-pulse absolute")}
          style={{
            animationDelay: `${-(performance.now() % 2000)}ms`,
          }}
          aria-hidden="true"
        >
          |
        </span>
      </span>
      {/* Hidden, not transparent: invisible either way and laid out the
          same, but transparent text is still painted, so its start moving
          with each keystroke counted as a layout shift. */}
      <span aria-hidden="true" style={{ visibility: "hidden" }}>
        {rest}
      </span>
    </div>
  );
}

export function TypeWriter({
  strings,
  className = "",
  isPaused = false,
}: TypeWriterProps) {
  const [isClient, setIsClient] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [key, setKey] = useState(0);
  const [currentStringIndex, setCurrentStringIndex] = useState(0);
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

  // Remounted (key) when the pause or animation settings change, so typing
  // starts over from the first phrase, as the library's remount did.
  if (areAnimationsPlaying && config.animate) {
    return (
      <AnimatedTyping
        key={key}
        strings={strings}
        className={className}
        isPaused={isPaused}
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
