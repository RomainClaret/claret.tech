"use client";

import { useState, useEffect, useCallback } from "react";

interface ScrollSectionState {
  currentSection: string;
  currentIndex: number;
  isAtTop: boolean;
  isAtBottom: boolean;
  scrollProgress: number;
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
    scrollProgress: 0,
    previousSection: null,
    nextSection: "skills",
    isInitialized: false,
  });

  const calculateScrollProgress = useCallback(() => {
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    const scrollTop = window.scrollY;

    const maxScroll = scrollHeight - clientHeight;
    const progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;

    return Math.min(100, Math.max(0, progress));
  }, []);

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

    // Calculate scroll progress
    const scrollProgress = calculateScrollProgress();

    setState({
      currentSection: currentSectionId,
      currentIndex: currentIdx,
      isAtTop,
      isAtBottom,
      scrollProgress,
      previousSection,
      nextSection,
      isInitialized: true,
    });
  }, [calculateScrollProgress]);

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
    const handleScroll = () => {
      detectCurrentSection();
    };

    // Initial detection
    detectCurrentSection();

    // Add scroll listener with passive flag for better performance
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Also listen for resize to recalculate positions
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
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
    sections: SECTIONS,
  };
}
