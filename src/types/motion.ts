// The motion props ConditionalMotion passes through to framer-motion
// (src/components/ui/conditional-motion.tsx).
export interface MotionVariants {
  [key: string]: {
    [property: string]: string | number | boolean;
  };
}

export interface MotionTransition {
  duration?: number;
  delay?: number;
  ease?: string | number[];
  type?: "spring" | "tween" | "inertia";
  stiffness?: number;
  damping?: number;
  mass?: number;
  when?: "beforeChildren" | "afterChildren" | false;
  delayChildren?: number;
  staggerChildren?: number;
  staggerDirection?: number;
  [key: string]: unknown;
}

export interface MotionAnimateProps {
  x?: string | number | (string | number)[];
  y?: string | number | (string | number)[];
  scale?: number | number[];
  rotate?: number | number[];
  opacity?: number | number[];
  [key: string]: string | number | boolean | (string | number)[] | undefined;
}

export type MotionValue = string | number | MotionVariants | MotionAnimateProps;
