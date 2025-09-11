// Motion configuration types
interface AnimationProps {
  opacity?: number;
  y?: number;
  x?: number;
  scale?: number;
  rotate?: number;
}

interface TransitionConfig {
  duration?: number;
  delay?: number;
  ease?: string | number[];
  staggerChildren?: number;
}

interface MotionConfig {
  initial?: AnimationProps | boolean;
  animate?: AnimationProps | boolean;
  exit?: AnimationProps | boolean;
  transition?: TransitionConfig;
}

/**
 * Get motion-safe animation variants based on user preference
 * @param normalAnimation - Animation config when motion is allowed
 * @param reducedAnimation - Animation config when motion is reduced (optional)
 * @returns Animation props that respect user preference
 */
export function getMotionSafeAnimation(
  normalAnimation: MotionConfig,
  reducedAnimation?: MotionConfig,
  prefersReducedMotion?: boolean,
): MotionConfig {
  // Check at runtime if not provided
  const reducedMotion =
    prefersReducedMotion ??
    (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  if (reducedMotion) {
    return (
      reducedAnimation ?? {
        initial: false,
        animate: false,
        exit: false,
        transition: { duration: 0 },
      }
    );
  }

  return normalAnimation;
}

/**
 * Common animation variants
 */
export const MOTION_VARIANTS = {
  // Fade in animation
  fadeIn: {
    normal: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.3 },
    },
    reduced: {
      initial: { opacity: 1 },
      animate: { opacity: 1 },
      transition: { duration: 0 },
    },
  },

  // Slide up animation
  slideUp: {
    normal: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -20 },
      transition: { duration: 0.3 },
    },
    reduced: {
      initial: { opacity: 1, y: 0 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0 },
    },
  },

  // Scale animation
  scale: {
    normal: {
      initial: { scale: 0.95, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 0.95, opacity: 0 },
      transition: { duration: 0.3 },
    },
    reduced: {
      initial: { scale: 1, opacity: 1 },
      animate: { scale: 1, opacity: 1 },
      transition: { duration: 0 },
    },
  },

  // Stagger children animation
  staggerChildren: {
    normal: {
      animate: {
        transition: {
          staggerChildren: 0.1,
        },
      },
    },
    reduced: {
      animate: {
        transition: {
          staggerChildren: 0,
        },
      },
    },
  },
};

/**
 * Get CSS transition based on motion preference
 */
export function getMotionSafeTransition(
  normalDuration: number = 300,
  reducedDuration: number = 0,
): string {
  if (typeof window === "undefined") return `all ${normalDuration}ms ease`;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const duration = prefersReducedMotion ? reducedDuration : normalDuration;

  return duration === 0 ? "none" : `all ${duration}ms ease`;
}
