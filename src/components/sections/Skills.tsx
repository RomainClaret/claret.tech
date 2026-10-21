"use client";

import { skillsSection } from "@/data/portfolio";
import { SlideInUp, ScaleIn } from "@/components/ui/animated";
import { getTechIcon } from "@/components/icons";
import {
  Microscope,
  Cpu,
  Lightbulb,
  Brain,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { HolographicCard } from "@/components/ui/holographic-card";
import { SkillManifesto } from "@/components/ui/skill-manifesto";
import { LanguageSpectrum } from "@/components/ui/language-spectrum";
import { m } from "framer-motion";
import { lazyDetails } from "@/components/ui/lazy-details";
import {
  DETAILS_TRIGGER,
  useDetailsDialog,
} from "@/lib/hooks/useDetailsDialog";
import type { SkillDetailsDialogProps } from "./SkillDetailsDialog";

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

// Hoisted out of the render loop, where it was being rebuilt once per panel
// on every render.
const RESEARCH_CATEGORY_COLORS = {
  "Current Focus": "139, 92, 246",
  "Why Evolution": "59, 130, 246",
  "My Approach": "34, 197, 94",
  Seeking: "245, 158, 11",
} as const;

const categoryColor = (category: string) =>
  RESEARCH_CATEGORY_COLORS[category as keyof typeof RESEARCH_CATEGORY_COLORS] ||
  "107, 114, 128";

// A card's details (SkillDetailsDialog.tsx): a chunk of its own.
const { Dialog: SkillDetailsDialog, intent: skillIntent } = lazyDetails(
  () => import("./SkillDetailsDialog").then((mod) => mod.SkillDetailsDialog),
  "Skill details chunk",
);

/** Which card's details are open: a core activity, or a philosophy card. */
type SkillSubject =
  | { kind: "activity"; index: number }
  | { kind: "philosophy"; category: string };

/** What a card's dialog shows, from the section's data. */
function skillDetailsOf(
  subject: SkillSubject,
): Omit<SkillDetailsDialogProps, "dialog"> {
  if (subject.kind === "activity") {
    const activity = skillsSection.coreActivities[subject.index];
    return {
      open: { kind: "activity", activity },
      title: activity.title,
      summary: activity.description,
      icon: coreActivityIcons[activity.icon],
      accent: activityColors[activity.icon],
      context: skillsSection.coreExpertiseSection.title,
    };
  }
  const panel =
    skillsSection.researchInterests[
      subject.category as keyof typeof skillsSection.researchInterests
    ];
  return {
    open: { kind: "philosophy", panel },
    title: subject.category,
    summary: panel.description,
    icon: Brain,
    accent: categoryColor(subject.category),
    context: skillsSection.researchPhilosophySection.title,
  };
}

// The cards' Read more: a click anywhere on a card opens its details, and
// this is its control for the keyboard and for screen readers, and the way
// back when the dialog closes.
const readMoreClass =
  "flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

export function Skills() {
  // One dialog for the section's cards, which grew in place before and
  // pushed the page around.
  const skillDetails = useDetailsDialog<SkillSubject>();

  if (!skillsSection.display) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 md:px-16 pt-20 pb-8 sm:pt-24 sm:pb-16 max-w-7xl relative">
      <div className="lg:px-8">
        <div className="text-center mb-8 sm:mb-12">
          {skillsSection.title && (
            <h2 className="section-title-gradient">{skillsSection.title}</h2>
          )}
          <p className="text-base sm:text-lg text-muted-foreground max-w-4xl mx-auto">
            <span className="text-primary font-semibold">
              {skillsSection.subtitle.highlightedText}
            </span>
            {" • "}
            {skillsSection.subtitle.normalText}
          </p>
        </div>

        {/* Core Activities - With HolographicCards */}
        <div className="mb-16">
          <SlideInUp className="text-center mb-8">
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
                <SlideInUp key={index} className="h-full">
                  {/* A click anywhere on the card opens its details;
                      pointing at it or focusing it fetches their code. */}
                  <m.div
                    className="relative h-full cursor-pointer"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    onClick={skillDetails.onCardClick({
                      kind: "activity",
                      index,
                    })}
                    {...skillIntent}
                  >
                    <HolographicCard
                      glowColor={activityColor}
                      delay={(300 + index * 100) / 1000}
                    >
                      <div className="p-6 h-full flex flex-col">
                        {/* Header with animated icon */}
                        <div className="flex items-start gap-4 mb-4">
                          <div className="relative group shrink-0">
                            <m.div
                              className="w-14 h-14 rounded-full flex items-center justify-center"
                              style={{
                                backgroundColor: `rgba(${activityColor}, 0.1)`,
                              }}
                              whileHover={{ scale: 1.1 }}
                            >
                              <IconComponent
                                className="w-7 h-7"
                                style={{ color: `rgb(${activityColor})` }}
                              />
                            </m.div>
                            {/* Breathing pulse effect: a CSS loop
                                (motion.css) */}
                            <div
                              className="absolute inset-0 rounded-full pointer-events-none anim-decor anim-breathe-115"
                              style={{
                                backgroundColor: `rgb(${activityColor})`,
                                opacity: 0.1,
                                willChange: "transform",
                                animationDelay: `${(300 + index * 100) / 1000 + 0.5}s`,
                              }}
                            />
                          </div>
                          <h4 className="text-xl font-bold bg-linear-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300">
                            {activity.title}
                          </h4>
                        </div>

                        {/* The short text; the story opens in the dialog */}
                        <div className="mb-4">
                          <p className="text-sm text-muted-foreground">
                            {activity.description}
                          </p>
                          <button
                            type="button"
                            {...{ [DETAILS_TRIGGER]: "" }}
                            aria-haspopup="dialog"
                            aria-label={`Read more about ${activity.title}`}
                            className={`${readMoreClass} mt-1`}
                          >
                            Read more
                            <ArrowRight
                              aria-hidden="true"
                              className="w-3 h-3"
                            />
                          </button>
                        </div>

                        {/* Technologies, in one row */}
                        <div className="mt-auto">
                          <div className="flex flex-wrap gap-2">
                            {activity.technologies.map((tech, techIndex) => {
                              const TechIcon = getTechIcon(tech.icon);

                              return (
                                <ScaleIn key={techIndex} className="group/tech">
                                  <m.div
                                    className="relative"
                                    whileHover={{ scale: 1.05 }}
                                  >
                                    {/* Tech badge with holographic effects */}
                                    <div className="relative group/badge">
                                      {/* Glow effect on hover */}
                                      <m.div
                                        className="absolute -inset-1 rounded-lg opacity-0 group-hover/badge:opacity-40 blur-md transition-opacity duration-300"
                                        style={{
                                          backgroundColor: `rgb(${activityColor})`,
                                        }}
                                      />

                                      {/* Main badge */}
                                      <div
                                        className="relative px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border transition-all duration-300 overflow-hidden"
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

                                        {/* Rainbow holographic overlay; its
                                            loop only runs on hover */}
                                        <div
                                          className="absolute inset-0 opacity-0 group-hover/badge:opacity-20 transition-opacity duration-500 rounded-lg anim-hover"
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
                                              "holographic-sweep 4s linear infinite",
                                          }}
                                        />

                                        <TechIcon
                                          size={14}
                                          className="relative z-10 shrink-0 transition-all duration-300 group-hover/badge:scale-110"
                                          style={{
                                            color: `rgb(${activityColor})`,
                                          }}
                                        />
                                        <span className="text-xs font-medium relative z-10 wrap-break-word">
                                          {tech.name}
                                        </span>
                                      </div>

                                      {/* Animated border: a CSS loop
                                          (motion.css) that only runs on
                                          hover, when the border shows */}
                                      <div
                                        className="absolute inset-0 rounded-lg p-px -z-10 opacity-0 group-hover/badge:opacity-100 transition-opacity duration-300 anim-border-flow anim-hover"
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
                                      />
                                    </div>
                                  </m.div>
                                </ScaleIn>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </HolographicCard>
                  </m.div>
                </SlideInUp>
              );
            })}
          </div>
        </div>

        {/* Research Focus - Enhanced Design */}
        <div className="mb-16">
          <SlideInUp className="text-center mb-8">
            <h3 className="section-subtitle-gradient text-2xl md:text-3xl mb-2">
              {skillsSection.researchPhilosophySection.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {skillsSection.researchPhilosophySection.subtitle}
            </p>
          </SlideInUp>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(skillsSection.researchInterests).map(
              ([category, panel], index) => {
                const color = categoryColor(category);

                return (
                  <SlideInUp key={category} className="h-full">
                    {/* The card shows the panel's key point; the framing and
                        all the points open in the dialog. */}
                    <m.div
                      className="h-full cursor-pointer"
                      whileHover={{ scale: 1.02 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                      onClick={skillDetails.onCardClick({
                        kind: "philosophy",
                        category,
                      })}
                      {...skillIntent}
                    >
                      <HolographicCard
                        glowColor={color}
                        transitionDuration={400}
                        delay={(500 + index * 100) / 1000}
                      >
                        <div className="p-5 h-full flex flex-col">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="relative group">
                              <m.div
                                className="w-10 h-10 rounded-full flex items-center justify-center"
                                style={{
                                  backgroundColor: `rgba(${color}, 0.1)`,
                                }}
                                whileHover={{ scale: 1.1 }}
                              >
                                <Brain
                                  className="w-5 h-5"
                                  style={{ color: `rgb(${color})` }}
                                />
                              </m.div>
                              {/* Breathing pulse effect: a CSS loop
                                  (motion.css) */}
                              <div
                                className="absolute inset-0 rounded-full pointer-events-none anim-decor anim-breathe-115"
                                style={{
                                  backgroundColor: `rgb(${color})`,
                                  opacity: 0.1,
                                  willChange: "transform",
                                  animationDelay: `${(500 + index * 100) / 1000 + 0.5}s`,
                                }}
                              />
                            </div>
                            <h4 className="text-lg font-bold bg-linear-to-r from-foreground to-foreground hover:from-primary hover:to-purple-600 bg-clip-text text-transparent transition-all duration-300">
                              {category}
                            </h4>
                          </div>

                          {/* The key point: the panel's first, which stands
                              alone (skills.ts) */}
                          <p className="flex items-start gap-2 text-sm mb-4">
                            <span
                              aria-hidden="true"
                              className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                              style={{
                                backgroundColor: `rgb(${color})`,
                                boxShadow: `0 0 8px rgba(${color}, 0.5)`,
                              }}
                            />
                            <span className="text-muted-foreground">
                              {panel.bullets[0]}
                            </span>
                          </p>

                          <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{panel.bullets.length} points</span>
                            <span aria-hidden="true">•</span>
                            <button
                              type="button"
                              {...{ [DETAILS_TRIGGER]: "" }}
                              aria-haspopup="dialog"
                              aria-label={`Read more about ${category}`}
                              className={readMoreClass}
                            >
                              Read more
                              <ArrowRight
                                aria-hidden="true"
                                className="w-3 h-3"
                              />
                            </button>
                          </div>
                        </div>
                      </HolographicCard>
                    </m.div>
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

      {/* A card's details, once for the section, outside the cards */}
      {skillDetails.open && skillDetails.dialog && (
        <SkillDetailsDialog
          {...skillDetailsOf(skillDetails.open.item)}
          dialog={skillDetails.dialog}
        />
      )}
    </div>
  );
}
