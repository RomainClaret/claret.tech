"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { ProtectedLucideIcon } from "@/components/ui/protected-lucide-icon";

interface Skill {
  name: string;
  icon?: React.ReactNode;
}

interface SkillCardsProps {
  skills: Skill[];
  className?: string;
  color?: string;
  delay?: number;
}

export function SkillCards({
  skills,
  className,
  color = "rgb(139, 92, 246)",
  delay = 0,
}: SkillCardsProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className={cn("mt-6", className)}>
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <ProtectedLucideIcon
          Icon={Sparkles}
          className="w-4 h-4"
          style={{ color }}
        />
        <span className="text-xs font-medium text-muted-foreground">
          Key Skills & Technologies
        </span>
      </div>

      {/* Skills grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {skills.map((skill, index) => (
          <div
            key={skill.name}
            className="group relative"
            style={{
              animationDelay: `${index * 100}ms`,
            }}
          >
            {/* Skill card */}
            <div
              className={cn(
                "relative px-3 py-2 rounded-md text-xs font-medium",
                "backdrop-blur-sm border transition-all duration-300",
                "hover:scale-105 cursor-default",
                "animate-in fade-in slide-in-from-bottom-2",
                "bg-gray-100/80 dark:bg-gray-900/80",
                "border-gray-200 dark:border-gray-700",
                "text-gray-800 dark:text-gray-200",
              )}
            >
              {/* Hover glow */}
              <div
                className="absolute inset-0 rounded-md opacity-0 group-hover:opacity-30 transition-opacity duration-300 blur-md"
                style={{
                  backgroundColor: color,
                }}
              />

              {/* Content */}
              <div className="relative flex items-center gap-1.5">
                {skill.icon && (
                  <span className="text-[10px]">{skill.icon}</span>
                )}
                <span className="whitespace-nowrap">{skill.name}</span>
              </div>

              {/* Subtle shimmer effect */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-md overflow-hidden pointer-events-none"
                style={{
                  backgroundImage: `linear-gradient(
                    105deg,
                    transparent 40%,
                    ${color}20 50%,
                    transparent 60%
                  )`,
                  animation: "shimmer-slow 2s ease-out",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes shimmer-slow {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}

// Preset skill configurations for different education levels
export const skillPresets = {
  phd: [
    { name: "Neuroevolution" },
    { name: "AI Research" },
    { name: "Meta-Learning" },
    { name: "Graph Neural Networks" },
    { name: "Teaching" },
    { name: "JAX/TensorFlow" },
    { name: "Scientific Writing" },
    { name: "Python" },
  ],
  master: [
    { name: "Machine Learning" },
    { name: "NLP" },
    { name: "Deep Learning" },
    { name: "Software Engineering" },
    { name: "Cloud Computing" },
    { name: "Data Science" },
  ],
  bachelor: [
    { name: "Algorithms" },
    { name: "Databases" },
    { name: "Web Development" },
    { name: "Distributed Systems" },
    { name: "Java/C++" },
    { name: "Networks" },
  ],
};
