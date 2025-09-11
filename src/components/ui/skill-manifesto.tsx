"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Pause, Play, List } from "lucide-react";

interface SkillManifestoProps {
  skills: string[];
  className?: string;
  autoPlayDelay?: number;
}

type DisplayMode = "compact" | "expanded" | "list";

export function SkillManifesto({
  skills,
  className,
  autoPlayDelay = 10000,
}: SkillManifestoProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("compact");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-play logic
  useEffect(() => {
    if (isPlaying && displayMode !== "list" && skills.length > 1) {
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
  }, [isPlaying, displayMode, skills.length, autoPlayDelay]);

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
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
      <div className={cn("relative w-full max-w-3xl mx-auto", className)}>
        <div className="space-y-2">
          {/* Header with close button */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">
              All {skills.length} skills
            </span>
            <button
              onClick={() => setDisplayMode("compact")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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
              return (
                <div
                  key={index}
                  className="flex items-start gap-2 py-1 text-sm text-muted-foreground hover:text-foreground/80 transition-colors cursor-pointer"
                  onClick={() => {
                    setCurrentIndex(index);
                    setDisplayMode("expanded");
                  }}
                >
                  {skillEmoji && (
                    <span className="opacity-60">{skillEmoji}</span>
                  )}
                  <span className="flex-1">{skillText}</span>
                </div>
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
      <div className={cn("relative w-full max-w-3xl mx-auto", className)}>
        <motion.div
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
                onClick={() => setDisplayMode("compact")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
                aria-label="Compact view"
                title="Compact view"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDisplayMode("list")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
                aria-label="List view"
                title="List all"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Progress dots */}
            <div className="flex items-center gap-1">
              {skills.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToIndex(index)}
                  className="p-0.5"
                  aria-label={`Go to skill ${index + 1}`}
                >
                  <div
                    className={cn(
                      "transition-all duration-200",
                      index === currentIndex
                        ? "w-3 h-0.5 bg-muted-foreground/50 rounded-full"
                        : "w-1 h-1 bg-muted-foreground/20 rounded-full hover:bg-muted-foreground/30",
                    )}
                  />
                </button>
              ))}
            </div>

            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
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
            <motion.div
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
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  // Compact Mode (Default) - Centered layout with controls on top
  return (
    <div className={cn("relative w-full max-w-3xl mx-auto", className)}>
      <div className="flex flex-col items-center gap-2 text-sm">
        {/* Minimal controls - now centered above */}
        <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
          {/* Tiny progress dots */}
          <div className="flex items-center gap-0.5">
            {skills.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  goToIndex(index);
                }}
                className="p-0.5"
                aria-label={`Skill ${index + 1}`}
              >
                <div
                  className={cn(
                    "transition-all duration-200",
                    index === currentIndex
                      ? "w-2 h-0.5 bg-muted-foreground/60"
                      : "w-0.5 h-0.5 bg-muted-foreground/30",
                  )}
                />
              </button>
            ))}
          </div>

          {/* Tiny play/pause */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
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
              setDisplayMode("list");
            }}
            className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Show all"
            title="Show all"
          >
            <List className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* Main content - now centered below */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center gap-2 cursor-pointer group"
            onClick={() => setDisplayMode("expanded")}
          >
            {emoji && (
              <span className="opacity-50 group-hover:opacity-70 transition-opacity">
                {emoji}
              </span>
            )}
            <span className="text-muted-foreground group-hover:text-foreground/80 transition-colors text-center">
              {text}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
