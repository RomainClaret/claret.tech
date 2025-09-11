/**
 * Global Animation Manager
 * Controls and limits the number of concurrent canvas animations
 * to reduce GPU usage and improve performance
 */

type AnimationPriority = "high" | "medium" | "low";
type PerformanceProfile = "high" | "medium" | "low" | "auto";

interface AnimationConfig {
  id: string;
  priority: AnimationPriority;
  isActive: boolean;
  onPause?: () => void;
  onResume?: () => void;
}

export class AnimationManager {
  private animations: Map<string, AnimationConfig> = new Map();
  private activeAnimations: Set<string> = new Set();
  private performanceProfile: PerformanceProfile = "auto";
  private maxConcurrentAnimations: number = 2;
  private gpuUsageThreshold: number = 80; // percentage
  private fpsThreshold: number = 24; // Reduced from 30 for better performance
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private currentFPS: number = 60;

  constructor() {
    // Only run in browser environment
    if (typeof window !== "undefined") {
      this.detectPerformanceProfile();
      this.startPerformanceMonitoring();
    }
  }

  /**
   * Clean up all resources and intervals
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.frameCounterRunning = false;
    this.animations.clear();
    this.activeAnimations.clear();
  }

  /**
   * Register an animation with the manager
   */
  register(config: AnimationConfig): void {
    this.animations.set(config.id, config);
    if (config.isActive) {
      // Try to activate, and if we can't due to limits, check priority
      if (!this.tryActivateAnimation(config.id)) {
        // Check if we should replace a lower priority animation
        const lowestPriority = this.findLowestPriorityAnimation();
        if (
          lowestPriority &&
          this.comparePriority(config.priority, lowestPriority.priority) > 0
        ) {
          this.deactivateAnimation(lowestPriority.id);
          this.activateAnimation(config.id);
        }
      }
    }
  }

  /**
   * Unregister an animation
   */
  unregister(id: string): void {
    this.animations.delete(id);
    this.activeAnimations.delete(id);
  }

  /**
   * Request to start an animation
   */
  requestStart(id: string): boolean {
    const animation = this.animations.get(id);
    if (!animation) return false;

    // Mark that this animation wants to be active
    animation.isActive = true;

    // Check if we can activate this animation
    if (this.canActivateAnimation(animation)) {
      this.activateAnimation(id);
      return true;
    }

    // If not, check if we should deactivate a lower priority animation
    const lowestPriority = this.findLowestPriorityAnimation();
    if (
      lowestPriority &&
      this.comparePriority(animation.priority, lowestPriority.priority) > 0
    ) {
      this.deactivateAnimation(lowestPriority.id);
      this.activateAnimation(id);
      return true;
    }

    return false;
  }

  /**
   * Request to stop an animation
   */
  requestStop(id: string): void {
    const animation = this.animations.get(id);
    if (!animation) return;

    // Mark that this animation no longer wants to be active
    animation.isActive = false;

    const wasActive = this.activeAnimations.has(id);
    this.deactivateAnimation(id);
    // Only try to activate a queued animation if we actually deactivated something
    if (wasActive) {
      this.activateQueuedAnimation();
    }
  }

  /**
   * Check if an animation is registered
   */
  isRegistered(id: string): boolean {
    return this.animations.has(id);
  }

  /**
   * Check if an animation is currently active
   */
  isActive(id: string): boolean {
    return this.activeAnimations.has(id);
  }

  /**
   * Get current FPS
   */
  getCurrentFPS(): number {
    return this.currentFPS;
  }

  /**
   * Check if FPS is below threshold
   */
  isLowFPS(): boolean {
    return this.currentFPS < this.fpsThreshold;
  }

  /**
   * Update FPS (for testing)
   */
  updateFPS(fps: number): void {
    this.currentFPS = fps;
    if (fps < this.fpsThreshold && this.performanceProfile === "auto") {
      this.downgradePerformance();
    }
  }

  /**
   * Get current performance profile
   */
  getPerformanceProfile(): PerformanceProfile {
    return this.performanceProfile;
  }

  /**
   * Set performance profile
   */
  setPerformanceProfile(profile: PerformanceProfile): void {
    this.performanceProfile = profile;
    switch (profile) {
      case "high":
        this.maxConcurrentAnimations = 4;
        break;
      case "medium":
        this.maxConcurrentAnimations = 2;
        break;
      case "low":
        this.maxConcurrentAnimations = 1;
        break;
      case "auto":
        this.detectPerformanceProfile();
        break;
    }
    this.rebalanceAnimations();
  }

  /**
   * Get max concurrent animations
   */
  getMaxConcurrentAnimations(): number {
    return this.maxConcurrentAnimations;
  }

  /**
   * Find lowest priority active animation
   */
  findLowestPriorityActive(): string | null {
    const lowest = this.findLowestPriorityAnimation();
    return lowest ? lowest.id : null;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AnimationManager {
    if (!AnimationManager.instance) {
      AnimationManager.instance = new AnimationManager();
    }
    return AnimationManager.instance;
  }

  private static instance: AnimationManager | null = null;

  /**
   * Get current performance metrics
   */
  getMetrics(): {
    fps: number;
    activeAnimations: number;
    profile: PerformanceProfile;
    maxAnimations: number;
  } {
    return {
      fps: this.currentFPS,
      activeAnimations: this.activeAnimations.size,
      profile: this.performanceProfile,
      maxAnimations: this.maxConcurrentAnimations,
    };
  }

  private detectPerformanceProfile(): void {
    if (this.performanceProfile !== "auto") return;
    if (typeof window === "undefined" || typeof document === "undefined")
      return;

    let detectedProfile: PerformanceProfile = "medium";

    // Check GPU capabilities
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        // Simple heuristic based on GPU renderer
        if (renderer.toLowerCase().includes("intel")) {
          detectedProfile = "low";
        } else if (
          renderer.toLowerCase().includes("nvidia") ||
          renderer.toLowerCase().includes("amd")
        ) {
          detectedProfile = "high";
        } else {
          detectedProfile = "medium";
        }
      }
    }

    // Check device memory
    const deviceMemory = (navigator as unknown as { deviceMemory?: number })
      .deviceMemory;
    if (deviceMemory) {
      if (deviceMemory <= 4) {
        detectedProfile = "low";
      } else if (deviceMemory >= 8) {
        detectedProfile = "high";
      }
    }

    // Check CPU cores
    const hardwareConcurrency = navigator.hardwareConcurrency;
    if (hardwareConcurrency) {
      if (hardwareConcurrency <= 2) {
        detectedProfile = "low";
      } else if (hardwareConcurrency >= 8) {
        detectedProfile = "high";
      }
    }

    // Update max concurrent animations based on detected profile but keep performanceProfile as "auto"
    switch (detectedProfile) {
      case "high":
        this.maxConcurrentAnimations = 3;
        break;
      case "medium":
        this.maxConcurrentAnimations = 2;
        break;
      case "low":
        this.maxConcurrentAnimations = 1;
        break;
    }
  }

  private updateMaxConcurrentAnimations(): void {
    switch (this.performanceProfile) {
      case "high":
        this.maxConcurrentAnimations = 3;
        break;
      case "medium":
        this.maxConcurrentAnimations = 2;
        break;
      case "low":
        this.maxConcurrentAnimations = 1;
        break;
      case "auto":
        this.maxConcurrentAnimations = 2;
        break;
    }
  }

  private canActivateAnimation(_animation: AnimationConfig): boolean {
    return this.activeAnimations.size < this.maxConcurrentAnimations;
  }

  private activateAnimation(id: string): void {
    const animation = this.animations.get(id);
    if (!animation) return;

    this.activeAnimations.add(id);
    animation.onResume?.();
  }

  private deactivateAnimation(id: string): void {
    const animation = this.animations.get(id);
    if (!animation) return;

    this.activeAnimations.delete(id);
    animation.onPause?.();
  }

  private tryActivateAnimation(id: string): boolean {
    const animation = this.animations.get(id);
    if (animation && this.canActivateAnimation(animation)) {
      this.activateAnimation(id);
      return true;
    }
    return false;
  }

  private findLowestPriorityAnimation(): AnimationConfig | null {
    let lowest: AnimationConfig | null = null;

    this.activeAnimations.forEach((id) => {
      const animation = this.animations.get(id);
      if (
        animation &&
        (!lowest ||
          this.comparePriority(animation.priority, lowest.priority) < 0)
      ) {
        lowest = animation;
      }
    });

    return lowest;
  }

  private activateQueuedAnimation(): void {
    // Find highest priority inactive animation
    let highestId: string | null = null;
    let highestPriority: AnimationPriority | null = null;

    this.animations.forEach((animation, id) => {
      // Check if animation is not currently active (use activeAnimations Set, not isActive flag)
      if (!this.activeAnimations.has(id)) {
        if (
          !highestPriority ||
          this.comparePriority(animation.priority, highestPriority) > 0
        ) {
          highestId = id;
          highestPriority = animation.priority;
        }
      }
    });

    if (highestId !== null) {
      const animation = this.animations.get(highestId);
      // Only activate if the animation wants to be active (isActive flag)
      if (
        animation &&
        animation.isActive &&
        this.canActivateAnimation(animation)
      ) {
        this.activateAnimation(highestId);
      }
    }
  }

  private comparePriority(a: AnimationPriority, b: AnimationPriority): number {
    const priorities = { high: 3, medium: 2, low: 1 };
    return priorities[a] - priorities[b];
  }

  private rebalanceAnimations(): void {
    // Deactivate animations if we're over the limit
    while (this.activeAnimations.size > this.maxConcurrentAnimations) {
      const lowest = this.findLowestPriorityAnimation();
      if (lowest) {
        this.deactivateAnimation(lowest.id);
      } else {
        break;
      }
    }

    // Activate queued animations if we have capacity
    while (this.activeAnimations.size < this.maxConcurrentAnimations) {
      this.activateQueuedAnimation();
      const previousSize = this.activeAnimations.size;
      if (this.activeAnimations.size === previousSize) {
        // No more animations to activate
        break;
      }
    }
  }

  private monitoringInterval: ReturnType<typeof setInterval> | null = null;
  private frameCounterRunning: boolean = false;

  private startPerformanceMonitoring(): void {
    if (typeof window === "undefined") return;

    let lastTime = performance.now();
    let frames = 0;

    // Use longer interval (2 seconds) to reduce overhead
    this.monitoringInterval = setInterval(() => {
      // Only monitor if animations are active
      if (this.activeAnimations.size === 0) {
        frames = 0;
        lastTime = performance.now();
        return;
      }

      const currentTime = performance.now();
      const delta = currentTime - lastTime;

      // Calculate FPS based on elapsed time
      if (delta > 0) {
        this.currentFPS = Math.round((frames * 1000) / delta);

        // Adjust performance if FPS is too low
        if (
          this.currentFPS < this.fpsThreshold &&
          this.performanceProfile === "auto"
        ) {
          this.downgradePerformance();
        }
      }

      // Reset counters
      frames = 0;
      lastTime = currentTime;
    }, 2000); // Check FPS every 2 seconds (reduced frequency)

    // Count frames using requestAnimationFrame
    const countFrame = () => {
      frames++;
      if (this.activeAnimations.size > 0 && !this.frameCounterRunning) {
        this.frameCounterRunning = true;
        requestAnimationFrame(countFrame);
      } else {
        this.frameCounterRunning = false;
      }
    };

    // Only count frames when animations are active
    if (this.activeAnimations.size > 0) {
      this.frameCounterRunning = true;
      requestAnimationFrame(countFrame);
    }

    // Watch for active animations changes
    const originalActivate = this.activateAnimation.bind(this);
    this.activateAnimation = (id: string) => {
      const wasEmpty = this.activeAnimations.size === 0;
      originalActivate(id);
      if (wasEmpty && this.activeAnimations.size > 0) {
        requestAnimationFrame(countFrame);
      }
    };
  }

  private downgradePerformance(): void {
    if (this.maxConcurrentAnimations > 1) {
      this.maxConcurrentAnimations--;
      this.rebalanceAnimations();
    }
  }
}

// Singleton instance
export const animationManager = new AnimationManager();

// React hook for using the animation manager
import { useEffect, useRef } from "react";

export function useAnimationManager(
  id: string,
  priority: AnimationPriority = "medium",
): {
  isActive: boolean;
  register: (onPause?: () => void, onResume?: () => void) => void;
  unregister: () => void;
  requestStart: () => boolean;
  requestStop: () => void;
} {
  const isActiveRef = useRef(false);

  useEffect(() => {
    return () => {
      animationManager.unregister(id);
    };
  }, [id]);

  return {
    isActive: isActiveRef.current,
    register: (onPause, onResume) => {
      animationManager.register({
        id,
        priority,
        isActive: false,
        onPause,
        onResume,
      });
    },
    unregister: () => animationManager.unregister(id),
    requestStart: () => {
      const result = animationManager.requestStart(id);
      isActiveRef.current = result;
      return result;
    },
    requestStop: () => {
      animationManager.requestStop(id);
      isActiveRef.current = false;
    },
  };
}
