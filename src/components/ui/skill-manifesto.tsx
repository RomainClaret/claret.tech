"use client";

import { useState, useEffect, useId, useRef } from "react";
import { m, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Pause,
  Play,
  List,
} from "lucide-react";

interface SkillManifestoProps {
  skills: string[];
  className?: string;
  autoPlayDelay?: number;
}

type DisplayMode = "compact" | "expanded" | "list";
// Every control is a 24 px target around its small icon (WCAG 2.2's
// minimum): the dots were buttons of 6 by 6 px, one per skill.
const CONTROL =
  "inline-flex size-6 items-center justify-center text-muted-foreground hover:text-foreground transition-colors";
// The control that takes focus after a switch between modes: the skill
// sentence and the list's rows open the card view, whose Compact view
// button leads back to the sentence.
type SwitchControl = "show-all" | "close-list" | "compact-view" | "skill";

export function SkillManifesto({
  skills,
  className,
  autoPlayDelay = 10000,
}: SkillManifestoProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  // It plays on its own unless the visitor asks for reduced motion: framer
  // keeps opacity animations under that setting, so the sentence still
  // faded out and in every 6 s on the page (Romain, 2026-10-22). Play and
  // Pause are the visitor's choice either way.
  const prefersReducedMotion = useReducedMotion();
  const [playChoice, setPlayChoice] = useState<boolean | null>(null);
  const isPlaying = playChoice ?? !prefersReducedMotion;
  // Each mode renders its own controls, so the button just pressed leaves the
  // page and focus would fall back to <body>: a switch also names the control
  // that takes focus in the next mode (autoFocus, applied as it mounts). Each
  // mode's root has its own key, so a switch mounts the next mode's controls
  // rather than reusing the previous mode's buttons in place.
  const [view, setView] = useState<{
    mode: DisplayMode;
    focus?: SwitchControl;
  }>({ mode: "compact" });
  const displayMode = view.mode;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Rotation holds while focus is inside, as in the APG carousel pattern:
  // the sentence is a button, and it must not change under the keyboard.
  const [focusInside, setFocusInside] = useState(false);
  // What the sentence does, read after its name (the sentence itself).
  const sentenceHint = useId();
  const holdWhileFocused = {
    onFocus: () => setFocusInside(true),
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setFocusInside(false);
      }
    },
  };

  // Auto-play logic
  useEffect(() => {
    if (
      isPlaying &&
      !focusInside &&
      displayMode !== "list" &&
      skills.length > 1
    ) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % skills.length);
      }, autoPlayDelay);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, focusInside, displayMode, skills.length, autoPlayDelay]);

  const step = (by: number) => {
    setCurrentIndex((index) => (index + by + skills.length) % skills.length);
  };

  const togglePlayPause = () => {
    setPlayChoice(!isPlaying);
  };

  const currentSkill = skills[currentIndex];
  // Check if the skill starts with an emoji (Unicode emoji pattern)
  const emojiRegex =
    /^[\u{1F300}-\u{1FAD6}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]|^[\u{1F900}-\u{1F9FF}]|^[\u{1F600}-\u{1F64F}]|^[\u{1F680}-\u{1F6FF}]/u;
  const hasEmoji = emojiRegex.test(currentSkill);
  const emoji = hasEmoji ? currentSkill.substring(0, 2) : null;
  const text = hasEmoji ? currentSkill.substring(2).trim() : currentSkill;

  // List Mode - Static list of all skills
  if (displayMode === "list") {
    return (
      <div
        key="list"
        className={cn("relative w-full max-w-3xl mx-auto", className)}
        {...holdWhileFocused}
      >
        <div className="space-y-2">
          {/* Header with close button */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">
              All {skills.length} skills
            </span>
            <button
              onClick={() => setView({ mode: "compact", focus: "show-all" })}
              autoFocus={view.focus === "close-list"}
              className={CONTROL}
              aria-label="Close list view"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Skills list */}
          <div className="space-y-1">
            {skills.map((skill, index) => {
              const skillHasEmoji =
                /^[\u{1F300}-\u{1FAD6}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]|^[\u{1F900}-\u{1F9FF}]|^[\u{1F600}-\u{1F64F}]|^[\u{1F680}-\u{1F6FF}]/u.test(
                  skill,
                );
              const skillEmoji = skillHasEmoji ? skill.substring(0, 2) : null;
              const skillText = skillHasEmoji
                ? skill.substring(2).trim()
                : skill;
              // A button, so the keyboard can pick a skill too (it was a
              // div that only a click reached).
              return (
                <button
                  key={index}
                  type="button"
                  className="flex w-full min-h-6 items-start gap-2 py-1 text-left text-sm text-muted-foreground hover:text-foreground/80 transition-colors cursor-pointer"
                  onClick={() => {
                    setCurrentIndex(index);
                    setView({ mode: "expanded", focus: "compact-view" });
                  }}
                >
                  {skillEmoji && (
                    <span className="opacity-60">{skillEmoji}</span>
                  )}
                  <span className="flex-1">{skillText}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Expanded Mode - Clean card view
  if (displayMode === "expanded") {
    return (
      <div
        key="expanded"
        className={cn("relative w-full max-w-3xl mx-auto", className)}
        {...holdWhileFocused}
      >
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="relative bg-background/30 border border-border/30 rounded-md p-4"
        >
          {/* Controls row */}
          <div className="flex items-center justify-between mb-3">
            {/* Mode switchers */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setView({ mode: "compact", focus: "skill" })}
                autoFocus={view.focus === "compact-view"}
                className={CONTROL}
                aria-label="Compact view"
                title="Compact view"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setView({ mode: "list", focus: "close-list" })}
                className={CONTROL}
                aria-label="List view"
                title="List all"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Progress, between Previous and Next */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => step(-1)}
                className={CONTROL}
                aria-label="Previous skill"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-2" aria-hidden="true">
                {skills.map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "transition-all duration-200 rounded-full",
                      index === currentIndex
                        ? "w-3 h-0.5 bg-muted-foreground/50"
                        : "w-1 h-1 bg-muted-foreground/20",
                    )}
                  />
                ))}
              </div>
              <span className="sr-only">
                Skill {currentIndex + 1} of {skills.length}
              </span>
              <button
                onClick={() => step(1)}
                className={CONTROL}
                aria-label="Next skill"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              className={CONTROL}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            <m.div
              key={currentIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-center py-2"
            >
              <div className="flex items-center justify-center gap-2">
                {emoji && <span className="text-lg opacity-60">{emoji}</span>}
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </m.div>
          </AnimatePresence>
        </m.div>
      </div>
    );
  }

  // Compact Mode (Default) - Centered layout with controls on top
  return (
    <div
      key="compact"
      className={cn("relative w-full max-w-3xl mx-auto", className)}
      {...holdWhileFocused}
    >
      <div className="flex flex-col items-center gap-2 text-sm">
        {/* Minimal controls - now centered above */}
        <div className="flex items-center gap-1 opacity-50 hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            className={CONTROL}
            aria-label="Previous skill"
          >
            <ChevronLeft className="w-2.5 h-2.5" />
          </button>

          {/* Tiny progress dots */}
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {skills.map((_, index) => (
              <div
                key={index}
                className={cn(
                  "transition-all duration-200",
                  index === currentIndex
                    ? "w-2 h-0.5 bg-muted-foreground/60"
                    : "w-0.5 h-0.5 bg-muted-foreground/30",
                )}
              />
            ))}
          </div>
          <span className="sr-only">
            Skill {currentIndex + 1} of {skills.length}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            className={CONTROL}
            aria-label="Next skill"
          >
            <ChevronRight className="w-2.5 h-2.5" />
          </button>

          {/* Tiny play/pause */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            className={CONTROL}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-2.5 h-2.5" />
            ) : (
              <Play className="w-2.5 h-2.5" />
            )}
          </button>

          {/* Expand buttons */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setView({ mode: "list", focus: "close-list" });
            }}
            autoFocus={view.focus === "show-all"}
            className={CONTROL}
            aria-label="Show all"
            title="Show all"
          >
            <List className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* Main content - now centered below. The sentence opens the card
            view: a button (it was a div only a click reached) that stays
            mounted while the text inside it changes, so focus stays on it. */}
        <button
          type="button"
          onClick={() => setView({ mode: "expanded", focus: "compact-view" })}
          autoFocus={view.focus === "skill"}
          aria-describedby={sentenceHint}
          className="group flex min-h-6 items-center justify-center cursor-pointer"
        >
          <AnimatePresence mode="wait">
            <m.span
              key={currentIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-center gap-2"
            >
              {emoji && (
                <span className="opacity-50 group-hover:opacity-70 transition-opacity">
                  {emoji}
                </span>
              )}
              <span className="text-muted-foreground group-hover:text-foreground/80 transition-colors text-center">
                {text}
              </span>
            </m.span>
          </AnimatePresence>
          <span id={sentenceHint} hidden>
            Opens the card view
          </span>
        </button>
      </div>
    </div>
  );
}
