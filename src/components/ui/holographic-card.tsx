"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode, useRef } from "react";
import { useShouldReduceAnimations, useIsSafari } from "@/lib/hooks/useSafari";

interface HolographicCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  insideBackgroundColor?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  isActive?: boolean;
  isConnected?: boolean;
  delay?: number;
  transitionDuration?: number;
}

export function HolographicCard({
  children,
  className,
  glowColor = "139, 92, 246", // Purple in RGB
  insideBackgroundColor,
  onMouseEnter,
  onMouseLeave,
  isActive = false,
  isConnected = false,
  delay = 0,
  transitionDuration = 300,
}: HolographicCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduceAnimations = useShouldReduceAnimations();
  const isSafari = useIsSafari();

  const handleMouseLeave = () => {
    onMouseLeave?.();
  };

  return (
    <motion.div
      ref={ref}
      className={cn("relative group/card h-full", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Neural glow effect - simplified for Safari */}
      <motion.div
        className={cn(
          "absolute -inset-1 rounded-lg",
          shouldReduceAnimations ? "opacity-15" : "blur-xl",
        )}
        style={{
          backgroundColor: `rgb(${glowColor})`,
          willChange: shouldReduceAnimations ? "auto" : "opacity",
        }}
        initial={{ opacity: 0 }}
        animate={
          shouldReduceAnimations
            ? { opacity: 0.15 }
            : { opacity: [0.1, 0.25, 0.1] }
        }
        transition={{
          duration: shouldReduceAnimations ? 0.3 : 3,
          repeat: shouldReduceAnimations ? 0 : Infinity,
          delay: delay + 0.5,
          ease: "easeInOut",
        }}
      />

      {/* Neural connection glow (when connected to highlighted node) */}
      {isConnected && (
        <motion.div
          className="absolute -inset-4 rounded-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div
            className="absolute inset-0 rounded-xl"
            style={{
              background: `radial-gradient(circle, rgba(${glowColor}, 0.2), transparent 70%)`,
              filter: "blur(20px)",
            }}
          />
        </motion.div>
      )}

      {/* Holographic background effect - simplified for Safari */}
      {!shouldReduceAnimations && (
        <motion.div
          className="absolute inset-0 rounded-lg opacity-0 group-hover/card:opacity-100 transition-opacity"
          style={{ transitionDuration: `${transitionDuration}ms` }}
        >
          {/* Base glow - reduced blur on Safari */}
          <div
            className="absolute inset-0 rounded-lg"
            style={{
              background: `radial-gradient(circle at 50% 50%, rgba(${glowColor}, 0.3), transparent 70%)`,
              filter: isSafari ? "blur(10px)" : "blur(40px)",
              transform: "translateZ(-50px)",
            }}
          />
        </motion.div>
      )}

      {/* Safari-optimized hover effect */}
      {shouldReduceAnimations && (
        <div
          className="absolute inset-0 rounded-lg opacity-0 group-hover/card:opacity-20 transition-opacity"
          style={{
            transitionDuration: `${transitionDuration}ms`,
            background: `rgba(${glowColor}, 0.1)`,
          }}
        />
      )}

      {/* Holographic shimmer - disabled on Safari */}
      {!shouldReduceAnimations && (
        <motion.div
          className="absolute inset-0 rounded-lg opacity-0 group-hover/card:opacity-100 transition-opacity overflow-hidden"
          style={{ transitionDuration: `${transitionDuration}ms` }}
        >
          <motion.div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(115deg,
                transparent 20%,
                rgba(255, 255, 255, 0.1) 40%,
                rgba(255, 255, 255, 0.2) 50%,
                rgba(255, 255, 255, 0.1) 60%,
                transparent 80%
              )`,
            }}
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </motion.div>
      )}

      {/* Main card content */}
      <motion.div
        className={cn(
          "relative bg-card/95 dark:bg-card/90",
          "rounded-lg overflow-hidden",
          "shadow-lg border border-border",
          "transition-all",
          "before:absolute before:inset-0 before:bg-gradient-to-br",
          "before:from-primary/5 before:to-purple-600/5",
          "before:rounded-lg before:-z-10 before:opacity-0",
          "before:transition-opacity",
          "hover:before:opacity-100",
          "h-full",
          isActive && "before:opacity-100",
          className?.includes("blog-card-enhanced") &&
            "bg-card/95 dark:bg-card/90",
        )}
        style={{
          transform: "translateZ(0)",
          transitionDuration: `${transitionDuration}ms`,
        }}
      >
        {/* Animated holographic border */}
        <motion.div
          className="absolute inset-0 rounded-lg p-[1px] -z-20 opacity-0 group-hover/card:opacity-100 transition-opacity"
          style={{
            transitionDuration: `${transitionDuration}ms`,
            backgroundImage: `linear-gradient(135deg,
              rgba(${glowColor}, 0.5) 0%,
              rgba(255, 255, 255, 0.3) 25%,
              rgba(${glowColor}, 0.5) 50%,
              rgba(255, 255, 255, 0.3) 75%,
              rgba(${glowColor}, 0.5) 100%
            )`,
            backgroundSize: "200% 200%",
          }}
        />

        {/* Neural activity indicator - simplified for Safari */}
        {isActive && (
          <motion.div
            className="absolute top-2 right-2 z-20"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            {/* Outer pulse ring - disabled animation on Safari */}
            <motion.div
              className="absolute w-6 h-6 rounded-full border-2"
              style={{
                borderColor: `rgb(${glowColor})`,
                top: "-2px",
                left: "-2px",
              }}
              animate={
                shouldReduceAnimations
                  ? {}
                  : {
                      scale: [1, 1.5, 1],
                      opacity: [0.5, 0, 0.5],
                    }
              }
              transition={{
                duration: 2,
                repeat: shouldReduceAnimations ? 0 : Infinity,
                ease: "easeInOut",
              }}
            />
            {/* Inner dot - simplified for Safari */}
            <motion.div
              className="relative w-2 h-2 rounded-full"
              style={{
                backgroundColor: `rgb(${glowColor})`,
                boxShadow: shouldReduceAnimations
                  ? "none"
                  : `0 0 10px rgba(${glowColor}, 0.8)`,
              }}
              animate={
                shouldReduceAnimations
                  ? {}
                  : {
                      scale: [1, 1.2, 1],
                    }
              }
              transition={{
                duration: 1,
                repeat: shouldReduceAnimations ? 0 : Infinity,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        )}

        {/* Light reflection effect */}
        <div
          className="absolute top-0 left-0 w-full h-full opacity-0 group-hover/card:opacity-10 transition-opacity pointer-events-none"
          style={{
            transitionDuration: `${transitionDuration * 1.5}ms`,
            background: `radial-gradient(
              ellipse at 50% 0%,
              rgba(255, 255, 255, 0.3) 0%,
              transparent 70%
            )`,
          }}
        />

        {/* Inside background color overlay */}
        {insideBackgroundColor && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor: `rgba(${insideBackgroundColor}, 0.03)`,
              mixBlendMode: "multiply",
            }}
          />
        )}

        {children}
      </motion.div>

      <style jsx>{`
        @keyframes holographic {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: 200% 200%;
          }
        }
      `}</style>
    </motion.div>
  );
}
