"use client";

import { ShootingStars } from "@/components/ui/shooting-stars";
import { GridBackground } from "@/components/ui/grid-background";
import { NeuralBackground } from "@/components/ui/neural-background";
import { SkillsNeuralCloud } from "@/components/ui/skills-neural-cloud";
import { greeting } from "@/data/portfolio";

interface IntroductionAnimationsProps {
  isVisible?: boolean;
  screenDimensions?: { width: number; height: number };
}

export function IntroductionAnimations({
  isVisible = true,
  screenDimensions = { width: 1152, height: 768 },
}: IntroductionAnimationsProps) {
  if (!isVisible) return null;

  // Calculate brain center position based on layout
  const brainCenterX =
    screenDimensions.width >= 1024
      ? screenDimensions.width * 0.75
      : screenDimensions.width * 0.5;
  const brainCenterY = screenDimensions.height * 0.5;
  const exclusionRadius = screenDimensions.width >= 1024 ? 250 : 200;

  return (
    <>
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <ShootingStars />
        <GridBackground />
        <NeuralBackground />
      </div>

      {/* Skills cloud - full viewport with brain exclusion zone */}
      <SkillsNeuralCloud
        concepts={greeting.neuralCloudConcepts}
        isVisible={isVisible}
        className="hidden md:block absolute inset-0 z-7"
        brainCenterX={brainCenterX}
        brainCenterY={brainCenterY}
        exclusionRadius={exclusionRadius}
      />
    </>
  );
}
