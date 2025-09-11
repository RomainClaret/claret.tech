"use client";

import { skillsSection } from "@/data/portfolio";
import { FadeIn, SlideInUp, ScaleIn } from "@/components/ui/animated";
import { getTechIcon } from "@/components/icons";
import {
  Microscope,
  Cpu,
  Lightbulb,
  Brain,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { ProtectedLucideIcon } from "@/components/ui/protected-lucide-icon";
import { HolographicCard } from "@/components/ui/holographic-card";
import { SkillManifesto } from "@/components/ui/skill-manifesto";
import { LanguageSpectrum } from "@/components/ui/language-spectrum";
import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

const coreActivityIcons: { [key: string]: LucideIcon } = {
  "🧬": Microscope,
  "🤖": Cpu,
  "🔬": Lightbulb,
};

// Activity colors matching the theme
const activityColors: { [key: string]: string } = {
  "🧬": "139, 92, 246", // Purple for evolution
  "🤖": "59, 130, 246", // Blue for AI
  "🔬": "34, 197, 94", // Green for research
};

// Map technology names to their icon classes
const techIconMap: { [key: string]: string } = {
  JAX: "fas fa-zap",
  Python: "fab fa-python",
  Neuroevolution: "fas fa-dna",
  "Evolution Algorithms": "fas fa-brain-circuit",
  "Evolutionary Strategies": "fas fa-dna",
  "Genetic Programming": "fas fa-code-branch",
  PyTorch: "fas fa-fire",
  "Reinforcement Learning": "fas fa-robot",
  "Multi-Agent Systems": "fas fa-network-wired",
  "Embodied AI": "fas fa-robot",
  "Deep Learning": "fas fa-sparkles",
  "Machine Learning": "fas fa-brain",
  Robotics: "fas fa-robot",
  "Artificial Life": "fas fa-atom",
  "Lifelong Learning": "fas fa-infinity",
  "Open-source": "fab fa-github",
  Docker: "fab fa-docker",
  Teaching: "fas fa-graduation-cap",
  Research: "fas fa-flask",
  FastAPI: "fas fa-bolt",
  Jupyter: "fas fa-book",
  "GitHub Actions": "fab fa-github",
  Documentation: "fas fa-file-alt",
};

export function Skills() {
  const [expandedActivity, setExpandedActivity] = useState<number | null>(null);
  // Force refresh: Updated tech order and alignment fixes

  if (!skillsSection.display) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 md:px-16 pt-20 pb-8 sm:pt-24 sm:pb-16 max-w-7xl relative">
      <div className="lg:px-8">
        <FadeIn className="text-center mb-8 sm:mb-12">
          {skillsSection.title && (
            <h2 className="section-title-gradient">{skillsSection.title}</h2>
          )}
          <p className="text-base sm:text-lg text-muted-foreground max-w-4xl mx-auto">
            <span className="text-primary font-semibold">
              {skillsSection.subtitle.highlightedText}
            </span>
            {""}
            {skillsSection.subtitle.normalText}
          </p>
        </FadeIn>

        {/* Core Activities - With HolographicCards */}
        <div className="mb-16">
          <SlideInUp delay={200} className="text-center mb-8">
            <h3 className="section-subtitle-gradient text-2xl md:text-3xl mb-4">
              {skillsSection.coreExpertiseSection.title}
            </h3>
            {/* Skill Manifesto as dynamic subtitle */}
            {skillsSection.skills && skillsSection.skills.length > 0 && (
              <div className="mt-4">
                <SkillManifesto
                  skills={skillsSection.skills}
                  autoPlayDelay={6000}
                />
              </div>
            )}
          </SlideInUp>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {skillsSection.coreActivities.map((activity, index) => {
              const IconComponent = coreActivityIcons[activity.icon];
              const activityColor = activityColors[activity.icon];

              return (
                <SlideInUp
                  key={index}
                  delay={300 + index * 100}
                  className="h-full"
                >
                  <motion.div
                    className="relative h-full min-h-[400px]"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <HolographicCard
                      glowColor={activityColor}
                      className="h-full"
                      delay={(300 + index * 100) / 1000}
                    >
                      <div className="p-6 h-full flex flex-col">
                        {/* Fixed height header wrapper */}
                        <div className="h-[90px] mb-2">
                          {/* Header with animated icon */}
                          <div className="flex items-start gap-4 h-full">
                            <div className="relative group">
                              <motion.div
                                className="w-14 h-14 rounded-full flex items-center justify-center"
                                style={{
                                  backgroundColor: `rgba(${activityColor}, 0.1)`,
                                }}
                                whileHover={{ scale: 1.1 }}
                              >
                                <ProtectedLucideIcon
                                  Icon={IconComponent}
                                  className="w-7 h-7"
                                  style={{ color: `rgb(${activityColor})` }}
                                />
                              </motion.div>
                              {/* Breathing pulse effect */}
                              <motion.div
                                className="absolute inset-0 rounded-full pointer-events-none"
                                style={{
                                  backgroundColor: `rgb(${activityColor})`,
                                  opacity: 0.1,
                                  willChange: "transform",
                                }}
                                initial={{ scale: 1 }}
                                animate={{
                                  scale: [1, 1.15, 1],
                                }}
                                transition={{
                                  duration: 3,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                  delay: (300 + index * 100) / 1000 + 0.5,
                                }}
                              />
                            </div>
                            <div className="flex-1 flex flex-col justify-between h-full gap-2">
                              <h4 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300 min-h-[3rem]">
                                {activity.title}
                              </h4>
                            </div>
                          </div>
                        </div>

                        {/* Expandable Description */}
                        <div className="mb-6">
                          <p
                            className={cn(
                              "text-sm text-muted-foreground transition-all duration-300",
                              expandedActivity === index ? "" : "line-clamp-4",
                            )}
                          >
                            {expandedActivity === index
                              ? activity.expandedDescription
                              : activity.description}
                          </p>
                          <button
                            className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
                            onClick={() =>
                              setExpandedActivity(
                                expandedActivity === index ? null : index,
                              )
                            }
                            aria-label={
                              expandedActivity === index
                                ? "Show less details"
                                : "Read more details"
                            }
                          >
                            {expandedActivity === index
                              ? "Show less"
                              : "Read more"}
                            <ChevronDown
                              className={cn(
                                "w-3 h-3 transition-transform duration-300",
                                expandedActivity === index && "rotate-180",
                              )}
                            />
                          </button>
                        </div>

                        {/* Technologies with improved styling */}
                        <div className="mt-auto w-full">
                          <div className="grid grid-cols-1 gap-2 min-h-[120px] items-start w-full">
                            {activity.technologies.map((tech, techIndex) => {
                              const TechIcon = getTechIcon(
                                techIconMap[tech] || "fas fa-code",
                              );

                              return (
                                <ScaleIn
                                  key={techIndex}
                                  delay={400 + index * 100 + techIndex * 50}
                                  className="group/tech w-full"
                                >
                                  <motion.div
                                    className="relative w-full"
                                    whileHover={{ scale: 1.05 }}
                                  >
                                    {/* Tech badge with holographic effects */}
                                    <div className="relative group/badge w-full">
                                      {/* Glow effect on hover */}
                                      <motion.div
                                        className="absolute -inset-1 rounded-lg opacity-0 group-hover/badge:opacity-40 blur-md transition-opacity duration-300"
                                        style={{
                                          backgroundColor: `rgb(${activityColor})`,
                                        }}
                                      />

                                      {/* Main badge */}
                                      <div
                                        className="relative px-2 py-3 min-h-[2.5rem] rounded-lg flex items-center justify-start gap-2 border transition-all duration-300 cursor-pointer overflow-hidden w-full"
                                        style={{
                                          backgroundColor: `rgba(${activityColor}, 0.05)`,
                                          borderColor: `rgba(${activityColor}, 0.3)`,
                                        }}
                                      >
                                        {/* Proficiency background */}
                                        <div
                                          className="absolute inset-0 opacity-30 transition-all duration-500"
                                          style={{
                                            background: `linear-gradient(90deg, rgba(${activityColor}, 0.3) 0%, rgba(${activityColor}, 0.3) 100%)`,
                                          }}
                                        />

                                        {/* Holographic shimmer effect */}
                                        <div
                                          className="absolute inset-0 opacity-0 group-hover/badge:opacity-100 transition-opacity duration-300"
                                          style={{
                                            background: `linear-gradient(
                                              105deg,
                                              transparent 40%,
                                              rgba(${activityColor}, 0.4) 50%,
                                              transparent 60%
                                            )`,
                                            animation: "shimmer 2s ease-out",
                                          }}
                                        />

                                        {/* Rainbow holographic overlay */}
                                        <div
                                          className="absolute inset-0 opacity-0 group-hover/badge:opacity-20 transition-opacity duration-500 rounded-lg"
                                          style={{
                                            backgroundImage: `linear-gradient(45deg,
                                              rgba(255, 0, 0, 0.1) 0%,
                                              rgba(255, 154, 0, 0.1) 10%,
                                              rgba(208, 222, 33, 0.1) 20%,
                                              rgba(79, 220, 74, 0.1) 30%,
                                              rgba(63, 218, 216, 0.1) 40%,
                                              rgba(47, 201, 226, 0.1) 50%,
                                              rgba(28, 127, 238, 0.1) 60%,
                                              rgba(95, 21, 242, 0.1) 70%,
                                              rgba(186, 12, 248, 0.1) 80%,
                                              rgba(251, 7, 217, 0.1) 90%,
                                              rgba(255, 0, 0, 0.1) 100%
                                            )`,
                                            backgroundSize: "200% 200%",
                                            animation:
                                              "holographic 4s linear infinite",
                                          }}
                                        />

                                        <TechIcon
                                          size={14}
                                          className="relative z-10 flex-shrink-0 transition-all duration-300 group-hover/badge:scale-110"
                                          style={{
                                            color: `rgb(${activityColor})`,
                                          }}
                                        />
                                        <span className="text-xs md:text-sm font-medium relative z-10 text-left flex-1 break-words">
                                          {tech}
                                        </span>
                                      </div>

                                      {/* Animated border */}
                                      <motion.div
                                        className="absolute inset-0 rounded-lg p-[1px] -z-10 opacity-0 group-hover/badge:opacity-100 transition-opacity duration-300"
                                        style={{
                                          backgroundImage: `linear-gradient(135deg,
                                            rgba(${activityColor}, 0.5) 0%,
                                            rgba(255, 255, 255, 0.3) 25%,
                                            rgba(${activityColor}, 0.5) 50%,
                                            rgba(255, 255, 255, 0.3) 75%,
                                            rgba(${activityColor}, 0.5) 100%
                                          )`,
                                          backgroundSize: "200% 200%",
                                        }}
                                        animate={{
                                          backgroundPosition: [
                                            "0% 0%",
                                            "200% 200%",
                                          ],
                                        }}
                                        transition={{
                                          duration: 3,
                                          repeat: Infinity,
                                          ease: "linear",
                                        }}
                                      />
                                    </div>
                                  </motion.div>
                                </ScaleIn>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </HolographicCard>
                  </motion.div>
                </SlideInUp>
              );
            })}
          </div>
        </div>

        {/* Research Focus - Enhanced Design */}
        <div className="mb-16">
          <SlideInUp delay={400} className="text-center mb-8">
            <h3 className="section-subtitle-gradient text-2xl md:text-3xl mb-2">
              {skillsSection.researchPhilosophySection.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {skillsSection.researchPhilosophySection.subtitle}
            </p>
          </SlideInUp>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(skillsSection.researchInterests).map(
              ([category, interests], index) => {
                const categoryColors = {
                  "Current Focus": "139, 92, 246",
                  "Why Evolution": "59, 130, 246",
                  "My Approach": "34, 197, 94",
                  Seeking: "245, 158, 11",
                };
                const categoryColor =
                  categoryColors[category as keyof typeof categoryColors] ||
                  "107, 114, 128";

                return (
                  <SlideInUp key={category} delay={500 + index * 100}>
                    <motion.div
                      className="h-full"
                      whileHover={{ scale: 1.02 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                    >
                      <HolographicCard
                        glowColor={categoryColor}
                        className="h-full"
                        transitionDuration={400}
                        delay={(500 + index * 100) / 1000}
                      >
                        <div className="p-5 h-full">
                          <div className="flex items-center gap-2 mb-3 min-h-[60px]">
                            <div className="relative group">
                              <motion.div
                                className="w-10 h-10 rounded-full flex items-center justify-center"
                                style={{
                                  backgroundColor: `rgba(${categoryColor}, 0.1)`,
                                }}
                                whileHover={{ scale: 1.1 }}
                              >
                                <Brain
                                  className="w-5 h-5"
                                  style={{ color: `rgb(${categoryColor})` }}
                                />
                              </motion.div>
                              {/* Breathing pulse effect */}
                              <motion.div
                                className="absolute inset-0 rounded-full pointer-events-none"
                                style={{
                                  backgroundColor: `rgb(${categoryColor})`,
                                  opacity: 0.1,
                                  willChange: "transform",
                                }}
                                initial={{ scale: 1 }}
                                animate={{
                                  scale: [1, 1.15, 1],
                                }}
                                transition={{
                                  duration: 3,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                  delay: (500 + index * 100) / 1000 + 0.5,
                                }}
                              />
                            </div>
                            <h4 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300">
                              {category}
                            </h4>
                          </div>

                          <div className="space-y-2">
                            {interests.map((interest, idx) => (
                              <motion.div
                                key={idx}
                                className="flex items-start gap-2 text-sm group/interest"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                  delay: 0.6 + index * 0.1 + idx * 0.05,
                                }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 transition-all duration-300 group-hover/interest:scale-150"
                                  style={{
                                    backgroundColor: `rgb(${categoryColor})`,
                                    boxShadow: `0 0 8px rgba(${categoryColor}, 0.5)`,
                                  }}
                                />
                                <span className="text-muted-foreground group-hover/interest:text-foreground transition-colors duration-300">
                                  {interest}
                                </span>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </HolographicCard>
                    </motion.div>
                  </SlideInUp>
                );
              },
            )}
          </div>
        </div>

        {/* Language Spectrum - Communication abilities */}
        {skillsSection.languages && skillsSection.languages.length > 0 && (
          <div className="mt-8">
            <LanguageSpectrum languages={skillsSection.languages} />
          </div>
        )}
      </div>
    </div>
  );
}
