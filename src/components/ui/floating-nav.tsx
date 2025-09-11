"use client";

import { Home, ChevronUp, ChevronDown, ChevronsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollSection } from "@/lib/hooks/useScrollSection";
import { useEffect, useState } from "react";

export function FloatingNav() {
  const {
    isAtTop,
    currentIndex,
    scrollToTop,
    scrollToPrevious,
    scrollToNext,
    scrollToLatest,
    sections,
    isInitialized,
  } = useScrollSection();

  const [isVisible, setIsVisible] = useState(false);

  // Show/hide navigation based on scroll
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 500); // Small delay before showing

    return () => clearTimeout(timer);
  }, []);

  // Don't render if not visible yet
  if (!isVisible) return null;

  const showHomeButton = isInitialized && !isAtTop;
  const showUpButton = isInitialized && !isAtTop;
  const showDownButton = isInitialized && currentIndex < sections.length - 1;
  const showLatestButton = isInitialized && currentIndex < sections.length - 1;

  return (
    <div className="fixed bottom-8 right-8 z-40 flex flex-col items-end gap-3">
      {/* Section Dots Indicator */}
      <div className="relative mb-2 group">
        <div className="flex flex-col items-center gap-1.5">
          {/* Section Dots */}
          {sections.map((_, index) => (
            <div
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                index <= currentIndex
                  ? "bg-primary scale-100"
                  : "bg-muted/30 scale-75",
              )}
            />
          ))}
        </div>

        {/* Current Section Label on Hover */}
        <div className="absolute top-1/2 -translate-y-1/2 right-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
            {sections[currentIndex]?.charAt(0).toUpperCase() +
              sections[currentIndex]?.slice(1)}
          </span>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex flex-col gap-2">
        {/* Home Button */}
        <button
          onClick={scrollToTop}
          aria-label="Scroll to top"
          className={cn(
            "group relative h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl flex items-center justify-center",
            showHomeButton
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-4 pointer-events-none",
          )}
        >
          <Home className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="absolute right-full mr-2 px-2 py-1 text-xs font-medium text-muted-foreground bg-background/80 backdrop-blur-sm border border-border rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Home
          </span>
        </button>

        {/* Up Button */}
        <button
          onClick={scrollToPrevious}
          aria-label="Scroll to previous section"
          disabled={!showUpButton}
          className={cn(
            "group relative h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl flex items-center justify-center",
            showUpButton
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-4 pointer-events-none",
          )}
        >
          <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="absolute right-full mr-2 px-2 py-1 text-xs font-medium text-muted-foreground bg-background/80 backdrop-blur-sm border border-border rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Previous
          </span>
        </button>

        {/* Down Button */}
        <button
          onClick={scrollToNext}
          aria-label="Scroll to next section"
          disabled={!showDownButton}
          className={cn(
            "group relative h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl flex items-center justify-center",
            showDownButton
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-4 pointer-events-none",
          )}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="absolute right-full mr-2 px-2 py-1 text-xs font-medium text-muted-foreground bg-background/80 backdrop-blur-sm border border-border rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Next
          </span>
        </button>

        {/* Latest Button */}
        <button
          onClick={scrollToLatest}
          aria-label="Scroll to latest section"
          disabled={!showLatestButton}
          className={cn(
            "group relative h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl flex items-center justify-center",
            showLatestButton
              ? "opacity-100 translate-x-0"
              : "opacity-0 translate-x-4 pointer-events-none",
          )}
        >
          <ChevronsDown className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="absolute right-full mr-2 px-2 py-1 text-xs font-medium text-muted-foreground bg-background/80 backdrop-blur-sm border border-border rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Latest
          </span>
        </button>
      </div>
    </div>
  );
}
