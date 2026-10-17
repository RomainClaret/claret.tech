"use client";

import { useState, useEffect, useCallback } from "react";

interface ScrollSectionState {
  currentSection: string;
  currentIndex: number;
  isAtTop: boolean;
  isAtBottom: boolean;
  previousSection: string | null;
  nextSection: string | null;
  isInitialized: boolean;
}

const SECTIONS = [
  "home",
  "skills",
  "experience",
  "projects",
  "research",
  "papers",
  "education",
  "blogs",
  "contact",
];

export function useScrollSection() {
  const [state, setState] = useState<ScrollSectionState>({
    currentSection: "home",
    currentIndex: 0,
    isAtTop: true,
    isAtBottom: false,
    previousSection: null,
    nextSection: "skills",
    isInitialized: false,
  });

  // Which of SECTIONS are actually in the document. The static list is the
  // homepage's layout; on a route like /pdf/<slug> none of them exist, and
  // consumers that render section controls need to be able to tell.
  const [presentSections, setPresentSections] = useState<string[]>([]);

  const detectCurrentSection = useCallback(() => {
    const scrollPosition = window.scrollY + 64; // Offset for header (h-16 = 64px)
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    let currentSectionId = "home";
    let currentIdx = 0;

    // Check each section
    for (let i = SECTIONS.length - 1; i >= 0; i--) {
      const section = document.getElementById(SECTIONS[i]);
      if (section && section.offsetTop <= scrollPosition) {
        currentSectionId = SECTIONS[i];
        currentIdx = i;
        break;
      }
    }

    // Determine if at top or bottom
    const isAtTop = window.scrollY < 50;
    const isAtBottom = window.scrollY + windowHeight >= documentHeight - 50;

    // Get previous and next sections
    const previousSection = currentIdx > 0 ? SECTIONS[currentIdx - 1] : null;
    const nextSection =
      currentIdx < SECTIONS.length - 1 ? SECTIONS[currentIdx + 1] : null;

    // Both are set only when they change. A fresh array and object on every
    // scroll event re-rendered the floating navigation on each one; the
    // scroll progress that also changed every time was read by nothing and
    // is gone.
    const present = SECTIONS.filter((id) => document.getElementById(id));
    setPresentSections((prev) =>
      prev.length === present.length && prev.every((id, i) => id === present[i])
        ? prev
        : present,
    );

    const next: ScrollSectionState = {
      currentSection: currentSectionId,
      currentIndex: currentIdx,
      isAtTop,
      isAtBottom,
      previousSection,
      nextSection,
      isInitialized: true,
    };
    setState((prev) =>
      (Object.keys(next) as (keyof ScrollSectionState)[]).every(
        (key) => prev[key] === next[key],
      )
        ? prev
        : next,
    );
  }, []);

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 64; // Navigation height (h-16 = 64px)
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  }, []);

  const scrollToPrevious = useCallback(() => {
    if (state.previousSection) {
      scrollToSection(state.previousSection);
    }
  }, [state.previousSection, scrollToSection]);

  const scrollToNext = useCallback(() => {
    if (state.nextSection) {
      scrollToSection(state.nextSection);
    }
  }, [state.nextSection, scrollToSection]);

  const scrollToTop = useCallback(() => {
    scrollToSection("home");
  }, [scrollToSection]);

  const scrollToLatest = useCallback(() => {
    const latestSection = SECTIONS[SECTIONS.length - 1];
    scrollToSection(latestSection);
  }, [scrollToSection]);

  useEffect(() => {
    // Once per frame however many scroll events arrive in it: each detection
    // reads every section's offsetTop.
    let frame = 0;
    const handleScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        detectCurrentSection();
      });
    };

    // The first detection too, on the next frame (the nav shows nothing for
    // its first 500 ms anyway).
    handleScroll();

    // Add scroll listener with passive flag for better performance
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Also listen for resize to recalculate positions
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [detectCurrentSection]);

  return {
    ...state,
    scrollToSection,
    scrollToPrevious,
    scrollToNext,
    scrollToTop,
    scrollToLatest,
    sections: presentSections,
  };
}
