"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Skill {
  name: string;
  icon?: React.ReactNode;
}

interface SkillOrbitProps {
  skills: Skill[];
  className?: string;
  orbitRadius?: number;
  animationDuration?: number;
  color?: string;
}

export function SkillOrbit({
  skills,
  className,
  orbitRadius = 120,
  animationDuration = 20,
  color = "rgb(139, 92, 246)",
}: SkillOrbitProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none overflow-visible animation-container",
        className,
      )}
    >
      <div className="relative w-full h-full">
        {skills.map((skill, index) => {
          const angle = (360 / skills.length) * index;
          const delay = (animationDuration / skills.length) * index;

          return (
            <div
              key={skill.name}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                animation: `orbit ${animationDuration}s linear infinite`,
                animationDelay: `${delay}s`,
              }}
            >
              <div
                className="absolute flex items-center justify-center"
                style={{
                  transform: `rotate(${angle}deg) translateX(${orbitRadius}px) rotate(-${angle}deg)`,
                }}
              >
                <div
                  className="group relative px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm border transition-all duration-300 hover:scale-110"
                  style={{
                    backgroundColor: `${color}15`,
                    borderColor: `${color}30`,
                    color: color,
                    boxShadow: `0 0 20px ${color}30`,
                  }}
                >
                  {/* Glow effect */}
                  <div
                    className="absolute inset-0 rounded-full blur-md opacity-0 group-hover:opacity-50 transition-opacity duration-300"
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

                  {/* Pulse effect */}
                  <div
                    className="absolute inset-0 rounded-full animate-pulse"
                    style={{
                      backgroundColor: `${color}10`,
                      animation: `pulse 2s ease-in-out infinite`,
                      animationDelay: `${delay}s`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* Orbit path (visible on hover) */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed opacity-0 hover:opacity-20 transition-opacity duration-500"
          style={{
            width: orbitRadius * 2,
            height: orbitRadius * 2,
            borderColor: color,
          }}
        />
      </div>

      <style jsx>{`
        @keyframes orbit {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(360deg);
          }
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.1);
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
  ],
  master: [
    { name: "Machine Learning" },
    { name: "NLP" },
    { name: "Deep Learning" },
    { name: "Software Engineering" },
  ],
  bachelor: [
    { name: "Algorithms" },
    { name: "Databases" },
    { name: "Web Development" },
    { name: "Distributed Systems" },
  ],
};
