"use client";

import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/ui/animated";

interface ProjectFilterProps {
  technologies: string[];
  selectedTech: string | null;
  onSelectTech: (tech: string | null) => void;
}

export function ProjectFilter({
  technologies,
  selectedTech,
  onSelectTech,
}: ProjectFilterProps) {
  return (
    <FadeIn className="flex flex-wrap gap-2 justify-center mb-8">
      {/* All button */}
      <button
        onClick={() => onSelectTech(null)}
        aria-label="Show all projects"
        aria-pressed={selectedTech === null}
        className={cn(
          "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
          "hover:scale-105 hover:shadow-md",
          selectedTech === null
            ? "bg-primary text-primary-foreground shadow-lg"
            : "bg-muted text-muted-foreground hover:bg-muted/80",
        )}
      >
        All
      </button>

      {/* Technology buttons */}
      {technologies.map((tech) => (
        <button
          key={tech}
          onClick={() => onSelectTech(tech)}
          aria-label={`Filter projects by ${tech}`}
          aria-pressed={selectedTech === tech}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
            "hover:scale-105 hover:shadow-md",
            selectedTech === tech
              ? "bg-primary text-primary-foreground shadow-lg"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          {tech}
        </button>
      ))}
    </FadeIn>
  );
}
