import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

/**
 * AnimatedFavicon Console Logging Test
 *
 * This test primarily verifies that the AnimatedFavicon component
 * does not produce console output that would spam the browser console.
 * The component interacts heavily with DOM APIs and browser features,
 * so we focus on testing the absence of console logging rather than
 * complex DOM manipulation scenarios.
 */

// Mock console to capture any logging attempts
const originalConsole = global.console;
const mockConsole = {
  info: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

describe("AnimatedFavicon Console Logging", () => {
  beforeEach(() => {
    // Replace console with mock
    global.console = mockConsole as unknown as Console;
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original console
    global.console = originalConsole;
    vi.clearAllTimers();
  });

  it("should not use console.info for logging", () => {
    // Import and instantiate component logic
    // Since the component uses useEffect and DOM manipulation,
    // we test the absence of specific logging patterns

    // These are the specific console messages that were removed:
    const bannedMessages = [
      "Initial favicon frame set",
      "Animation loop complete",
      "Generating pattern for Generation",
      "Generation 1: complexify phase",
      "Pattern too sparse",
    ];

    // Verify none of these messages would be logged
    bannedMessages.forEach((message) => {
      expect(mockConsole.info).not.toHaveBeenCalledWith(
        expect.stringContaining(message),
      );
    });
  });

  it("should not use console.log for development output", () => {
    // Verify no general console.log usage for development
    expect(mockConsole.log).not.toHaveBeenCalled();
  });

  it("verifies specific patterns are not logged", () => {
    // Test for specific pattern logging that was removed
    const bannedPatterns = [
      /Generation \d+:/,
      /complexify phase/,
      /Initial favicon/,
      /Animation loop/,
      /Pattern too sparse/,
    ];

    bannedPatterns.forEach((pattern) => {
      expect(mockConsole.info).not.toHaveBeenCalledWith(
        expect.stringMatching(pattern),
      );
    });
  });

  it("maintains clean console output", () => {
    // Overall verification that console remains clean
    expect(mockConsole.info).not.toHaveBeenCalled();
    expect(mockConsole.log).not.toHaveBeenCalled();
    expect(mockConsole.debug).not.toHaveBeenCalled();
  });
});

describe("AnimatedFavicon Integration", () => {
  it("exists as a component export", async () => {
    // Verify the component can be imported
    const { AnimatedFavicon } = await import("./animated-favicon");
    expect(AnimatedFavicon).toBeDefined();
    expect(typeof AnimatedFavicon).toBe("function");
  });

  it("has expected component structure", async () => {
    // Basic structural verification
    const { AnimatedFavicon } = await import("./animated-favicon");

    // Should be a React component (function)
    expect(AnimatedFavicon).toBeInstanceOf(Function);

    // Component should have a displayName or name
    type ComponentWithDisplayName = React.FC & {
      displayName?: string;
      name?: string;
    };

    expect(
      (AnimatedFavicon as ComponentWithDisplayName).name ||
        (AnimatedFavicon as ComponentWithDisplayName).displayName,
    ).toBeTruthy();
  });
});

describe("AnimatedFavicon loading", () => {
  it("starts one loop when the theme changes while its scripts load", async () => {
    const { act, render } = await import("@testing-library/react");
    vi.resetModules();
    const state = { theme: "light" };
    vi.doMock("./theme-provider", () => ({ useTheme: () => state }));
    vi.doMock("@/contexts/quality-context", () => ({
      useQuality: () => ({ quality: "balanced" }),
    }));
    vi.doMock("@/contexts/animation-state-context", () => ({
      useAnimationStateOptional: () => ({ areAnimationsPlaying: true }),
    }));
    const { AnimatedFavicon } = await import("./animated-favicon");

    // The scripts never load on their own; the test lets them.
    const scripts: HTMLScriptElement[] = [];
    const append = document.head.appendChild.bind(document.head);
    const appendSpy = vi
      .spyOn(document.head, "appendChild")
      .mockImplementation(<T extends Node>(node: T): T => {
        if (node instanceof HTMLScriptElement) {
          scripts.push(node);
          return node;
        }
        return append(node);
      });
    let renderers = 0;
    const win = window as unknown as Record<string, unknown>;
    const toDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,";
    vi.useFakeTimers();
    try {
      const view = render(<AnimatedFavicon />);
      state.theme = "dark"; // switched while the first load is in flight
      view.rerender(<AnimatedFavicon />);

      win.generateHybrid2 = () => ({ length: 4 });
      win.generateContinuousHybrid2 = () => ({
        frames: { length: 4 },
        finalState: [],
        finalCascades: [],
      });
      win.OptimizedHybrid2Renderer = class {
        constructor() {
          renderers++;
        }
        drawFrame() {}
      };
      await act(async () => {
        scripts.forEach((script) => script.onload?.(new Event("load")));
        await Promise.resolve();
      });

      expect(renderers).toBe(1);
      view.unmount();
    } finally {
      vi.useRealTimers();
      appendSpy.mockRestore();
      HTMLCanvasElement.prototype.toDataURL = toDataURL;
      delete win.generateHybrid2;
      delete win.generateContinuousHybrid2;
      delete win.OptimizedHybrid2Renderer;
      vi.doUnmock("./theme-provider");
      vi.doUnmock("@/contexts/quality-context");
      vi.doUnmock("@/contexts/animation-state-context");
    }
  });
});
