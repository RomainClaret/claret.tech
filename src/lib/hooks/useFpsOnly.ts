"use client";

import { useState, useEffect, useRef } from "react";

interface FpsOnlyData {
  fps: number;
  isLowFps: boolean;
}

/**
 * Ultra-lightweight FPS tracking hook
 * ONLY tracks FPS for auto-disable functionality
 * No CPU/GPU/Memory monitoring - designed for minimal overhead
 */
export function useFpsOnly(isEnabled: boolean = true): FpsOnlyData {
  const [fpsData, setFpsData] = useState<FpsOnlyData>({
    fps: 60,
    isLowFps: false,
  });

  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!isEnabled || typeof window === "undefined") {
      return;
    }

    let frames = 0;
    let lastTime = performance.now();

    function measureFPS() {
      frames++;
      const currentTime = performance.now();

      // Calculate FPS every second
      if (currentTime >= lastTime + 1000) {
        const currentFPS = Math.round(
          (frames * 1000) / (currentTime - lastTime),
        );

        setFpsData({
          fps: currentFPS,
          isLowFps: currentFPS < 30, // Simple threshold
        });

        frames = 0;
        lastTime = currentTime;
      }

      // Continue measuring if still enabled
      if (isEnabled) {
        animationFrameRef.current = window.requestAnimationFrame(measureFPS);
      }
    }

    animationFrameRef.current = window.requestAnimationFrame(measureFPS);

    return () => {
      if (animationFrameRef.current && typeof window !== "undefined") {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isEnabled]);

  return fpsData;
}
