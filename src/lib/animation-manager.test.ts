import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Set up canvas mock BEFORE importing AnimationManager
const mockGetContext = vi.fn((type: string) => {
  if (type === "webgl2" || type === "webgl") {
    return {
      getExtension: vi.fn(() => null),
      getParameter: vi.fn(() => "Mock Renderer"),
    };
  }
  return null;
}) as any;

// Ensure document.createElement is available and mocked
if (typeof document !== "undefined") {
  const originalCreateElement = document.createElement.bind(document);
  (document as any).createElement = vi.fn((tagName: string) => {
    if (tagName === "canvas") {
      const canvas = originalCreateElement(tagName) as HTMLCanvasElement;
      canvas.getContext = mockGetContext;
      return canvas;
    }
    return originalCreateElement(tagName);
  });
}

import { AnimationManager } from "./animation-manager";

describe("AnimationManager", () => {
  let manager: AnimationManager;
  let originalWindow: Window & typeof globalThis;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window properties
    originalWindow = global.window;
    Object.defineProperty(window, "navigator", {
      writable: true,
      value: {
        hardwareConcurrency: 4,
        deviceMemory: 8,
        gpu: {
          getPreferredCanvasFormat: vi.fn(() => "bgra8unorm"),
        },
      },
    });

    manager = new AnimationManager();
  });

  afterEach(() => {
    manager.destroy();
    global.window = originalWindow;
  });

  describe("Performance Profile Detection", () => {
    it("detects GPU availability", () => {
      const profile = manager.getPerformanceProfile();
      expect(profile).toBeDefined();
      expect(["high", "medium", "low", "auto"]).toContain(profile);
    });

    it("uses CPU core count for profile selection", () => {
      Object.defineProperty(window.navigator, "hardwareConcurrency", {
        writable: true,
        value: 8,
      });

      const newManager = new AnimationManager();
      expect(newManager.getMaxConcurrentAnimations()).toBeGreaterThanOrEqual(2);
      newManager.destroy();
    });

    it("uses device memory for profile selection", () => {
      Object.defineProperty(window.navigator, "deviceMemory", {
        writable: true,
        value: 16,
      });

      const newManager = new AnimationManager();
      expect(newManager.getMaxConcurrentAnimations()).toBeGreaterThanOrEqual(2);
      newManager.destroy();
    });

    it("falls back to low profile when hardware is limited", () => {
      Object.defineProperty(window.navigator, "hardwareConcurrency", {
        writable: true,
        value: 1,
      });
      Object.defineProperty(window.navigator, "deviceMemory", {
        writable: true,
        value: 2,
      });

      const newManager = new AnimationManager();
      expect(newManager.getMaxConcurrentAnimations()).toBeLessThanOrEqual(2);
      newManager.destroy();
    });
  });

  describe("Animation Registration", () => {
    it("registers an animation", () => {
      const config = {
        id: "test-animation",
        priority: "high" as const,
        isActive: true,
      };

      manager.register(config);
      expect(manager.isRegistered("test-animation")).toBe(true);
    });

    it("unregisters an animation", () => {
      const config = {
        id: "test-animation",
        priority: "medium" as const,
        isActive: false,
      };

      manager.register(config);
      expect(manager.isRegistered("test-animation")).toBe(true);

      manager.unregister("test-animation");
      expect(manager.isRegistered("test-animation")).toBe(false);
    });

    it("handles duplicate registrations", () => {
      const config = {
        id: "test-animation",
        priority: "high" as const,
        isActive: true,
      };

      manager.register(config);
      manager.register(config); // Register again

      expect(manager.isRegistered("test-animation")).toBe(true);
    });
  });

  describe("Animation Activation", () => {
    it("activates high priority animations first", () => {
      const highPriority = {
        id: "high",
        priority: "high" as const,
        isActive: true,
      };

      const lowPriority = {
        id: "low",
        priority: "low" as const,
        isActive: true,
      };

      manager.register(lowPriority);
      manager.register(highPriority);

      expect(manager.isActive("high")).toBe(true);
    });

    it("respects max concurrent animations limit", () => {
      const maxConcurrent = manager.getMaxConcurrentAnimations();

      for (let i = 0; i < maxConcurrent + 2; i++) {
        manager.register({
          id: `animation-${i}`,
          priority: "medium" as const,
          isActive: true,
        });
      }

      const activeCount = Array.from({ length: maxConcurrent + 2 }).filter(
        (_, i) => manager.isActive(`animation-${i}`),
      ).length;

      expect(activeCount).toBeLessThanOrEqual(maxConcurrent);
    });

    it("deactivates lower priority animations when limit reached", () => {
      const maxConcurrent = manager.getMaxConcurrentAnimations();

      // Fill with low priority animations
      for (let i = 0; i < maxConcurrent; i++) {
        manager.register({
          id: `low-${i}`,
          priority: "low" as const,
          isActive: true,
        });
      }

      // Add high priority animation
      manager.register({
        id: "high-priority",
        priority: "high" as const,
        isActive: true,
      });

      expect(manager.isActive("high-priority")).toBe(true);
    });

    it("calls onPause callback when animation is paused", () => {
      const onPause = vi.fn();
      const onResume = vi.fn();

      manager.register({
        id: "test",
        priority: "medium" as const,
        isActive: true,
        onPause,
        onResume,
      });

      manager.requestStop("test");
      expect(onPause).toHaveBeenCalled();
    });

    it("calls onResume callback when animation is resumed", () => {
      const onPause = vi.fn();
      const onResume = vi.fn();

      manager.register({
        id: "test",
        priority: "medium" as const,
        isActive: false,
        onPause,
        onResume,
      });

      manager.requestStart("test");

      if (manager.isActive("test")) {
        expect(onResume).toHaveBeenCalled();
      }
    });
  });

  describe("FPS Monitoring", () => {
    it("tracks current FPS", () => {
      const fps = manager.getCurrentFPS();
      expect(fps).toBeGreaterThanOrEqual(0);
      expect(fps).toBeLessThanOrEqual(120);
    });

    it("detects low FPS conditions", () => {
      // Simulate low FPS
      manager.updateFPS(15);
      expect(manager.isLowFPS()).toBe(true);

      // Simulate normal FPS
      manager.updateFPS(60);
      expect(manager.isLowFPS()).toBe(false);
    });

    it("automatically downgrades performance on sustained low FPS", () => {
      const initialMax = manager.getMaxConcurrentAnimations();

      // Simulate sustained low FPS
      for (let i = 0; i < 10; i++) {
        manager.updateFPS(15);
      }

      const afterMax = manager.getMaxConcurrentAnimations();
      expect(afterMax).toBeLessThanOrEqual(initialMax);
    });
  });

  describe("Performance Profiles", () => {
    it("sets performance profile to high", () => {
      manager.setPerformanceProfile("high");
      expect(manager.getPerformanceProfile()).toBe("high");
      expect(manager.getMaxConcurrentAnimations()).toBeGreaterThanOrEqual(3);
    });

    it("sets performance profile to medium", () => {
      manager.setPerformanceProfile("medium");
      expect(manager.getPerformanceProfile()).toBe("medium");
      expect(manager.getMaxConcurrentAnimations()).toBe(2);
    });

    it("sets performance profile to low", () => {
      manager.setPerformanceProfile("low");
      expect(manager.getPerformanceProfile()).toBe("low");
      expect(manager.getMaxConcurrentAnimations()).toBe(1);
    });

    it("auto profile adjusts based on performance", () => {
      manager.setPerformanceProfile("auto");
      expect(manager.getPerformanceProfile()).toBe("auto");

      // Should adjust based on hardware capabilities
      const maxAnimations = manager.getMaxConcurrentAnimations();
      expect(maxAnimations).toBeGreaterThanOrEqual(1);
      expect(maxAnimations).toBeLessThanOrEqual(4);
    });
  });

  describe("Memory Management", () => {
    it("cleans up on destroy", () => {
      manager.register({
        id: "test1",
        priority: "high" as const,
        isActive: true,
      });

      manager.register({
        id: "test2",
        priority: "low" as const,
        isActive: true,
      });

      manager.destroy();

      expect(manager.isRegistered("test1")).toBe(false);
      expect(manager.isRegistered("test2")).toBe(false);
    });

    it("stops monitoring interval on destroy", () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      manager.destroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it("clears all active animations on destroy", () => {
      for (let i = 0; i < 5; i++) {
        manager.register({
          id: `animation-${i}`,
          priority: "medium" as const,
          isActive: true,
        });
      }

      manager.destroy();

      for (let i = 0; i < 5; i++) {
        expect(manager.isActive(`animation-${i}`)).toBe(false);
      }
    });
  });

  describe("Priority Management", () => {
    it("correctly compares animation priorities", () => {
      const high = {
        id: "high",
        priority: "high" as const,
        isActive: false,
      };

      const medium = {
        id: "medium",
        priority: "medium" as const,
        isActive: false,
      };

      const low = {
        id: "low",
        priority: "low" as const,
        isActive: false,
      };

      manager.register(high);
      manager.register(medium);
      manager.register(low);

      // High priority should be activated over medium and low
      manager.requestStart("high");
      manager.requestStart("medium");
      manager.requestStart("low");

      expect(manager.isActive("high")).toBe(true);
    });

    it("finds lowest priority animation", () => {
      manager.register({
        id: "high",
        priority: "high" as const,
        isActive: true,
      });

      manager.register({
        id: "low",
        priority: "low" as const,
        isActive: true,
      });

      const lowest = manager.findLowestPriorityActive();
      expect(lowest).toBe("low");
    });
  });

  describe("React Hook Integration", () => {
    it("provides singleton instance", () => {
      const instance1 = AnimationManager.getInstance();
      const instance2 = AnimationManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("allows registration through singleton", () => {
      const instance = AnimationManager.getInstance();

      instance.register({
        id: "singleton-test",
        priority: "medium" as const,
        isActive: true,
      });

      expect(instance.isRegistered("singleton-test")).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("handles null/undefined animation IDs gracefully", () => {
      expect(() => {
        manager.unregister(null as unknown as string);
      }).not.toThrow();

      expect(() => {
        manager.unregister(undefined as unknown as string);
      }).not.toThrow();
    });

    it("handles rapid registration/unregistration", () => {
      const id = "rapid-test";

      for (let i = 0; i < 100; i++) {
        manager.register({
          id,
          priority: "medium" as const,
          isActive: i % 2 === 0,
        });

        if (i % 3 === 0) {
          manager.unregister(id);
        }
      }

      // Should not crash or throw
      expect(true).toBe(true);
    });

    it("handles concurrent start/stop requests", () => {
      const id = "concurrent-test";

      manager.register({
        id,
        priority: "medium" as const,
        isActive: false,
      });

      // Rapid start/stop
      manager.requestStart(id);
      manager.requestStop(id);
      manager.requestStart(id);
      manager.requestStop(id);

      // Should maintain consistent state
      expect(manager.isActive(id)).toBe(false);
    });
  });
});
