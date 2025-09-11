"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface AnimationContextType {
  shouldAnimateBrain: boolean;
  shouldAnimateInterests: boolean;
  startBrainAnimation: () => void;
  startInterestAnimation: () => void;
  resetAnimations: () => void;
}

const AnimationContext = createContext<AnimationContextType | undefined>(
  undefined,
);

export function AnimationProvider({ children }: { children: ReactNode }) {
  const [shouldAnimateBrain, setShouldAnimateBrain] = useState(false);
  const [shouldAnimateInterests, setShouldAnimateInterests] = useState(false);

  const startBrainAnimation = () => {
    setShouldAnimateBrain(true);
  };

  const startInterestAnimation = () => {
    setShouldAnimateInterests(true);
  };

  const resetAnimations = () => {
    setShouldAnimateBrain(false);
    setShouldAnimateInterests(false);
  };

  return (
    <AnimationContext.Provider
      value={{
        shouldAnimateBrain,
        shouldAnimateInterests,
        startBrainAnimation,
        startInterestAnimation,
        resetAnimations,
      }}
    >
      {children}
    </AnimationContext.Provider>
  );
}

export function useAnimation() {
  const context = useContext(AnimationContext);
  if (context === undefined) {
    throw new Error("useAnimation must be used within an AnimationProvider");
  }
  return context;
}
