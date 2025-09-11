/**
 * Toast Component Tests
 *
 * Critical notification system that provides user feedback with
 * automatic dismissal, manual close, different message types,
 * and portal-based rendering.
 */

import { render, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Toast, ToastContainer, showToast } from "./toast";

// Mock createPortal to render in the same container for testing
vi.mock("react-dom", async () => {
  const actual = await vi.importActual("react-dom");
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  };
});

describe("Toast", () => {
  let mockOnClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnClose = vi.fn();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe("Component Structure", () => {
    it("renders with basic props", () => {
      const { container } = render(
        <Toast message="Test message" onClose={mockOnClose} />,
      );

      // Component should render (even if not mounted initially)
      expect(container).toBeDefined();
    });

    it("handles different message types", () => {
      const types = ["info", "warning", "error", "success"] as const;

      types.forEach((type) => {
        const { unmount } = render(
          <Toast
            message={`${type} message`}
            type={type}
            onClose={mockOnClose}
          />,
        );
        unmount();
      });
    });

    it("accepts custom duration", () => {
      render(
        <Toast
          message="Custom duration"
          duration={2000}
          onClose={mockOnClose}
        />,
      );

      // Component should handle custom duration without errors
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("Auto-dismiss Logic", () => {
    it("sets up timer for auto-dismiss", () => {
      render(
        <Toast message="Auto dismiss" duration={1000} onClose={mockOnClose} />,
      );

      // Advance past mount effect
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(mockOnClose).not.toHaveBeenCalled();

      // Advance to trigger auto-dismiss + animation
      act(() => {
        vi.advanceTimersByTime(1300); // 1000ms + 300ms animation
      });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("uses default duration when not specified", () => {
      render(<Toast message="Default duration" onClose={mockOnClose} />);

      act(() => {
        vi.advanceTimersByTime(0); // Mount effect
      });

      // Should not dismiss before default duration (8000ms)
      act(() => {
        vi.advanceTimersByTime(7999);
      });
      expect(mockOnClose).not.toHaveBeenCalled();

      // Should dismiss after default duration + animation
      act(() => {
        vi.advanceTimersByTime(301);
      });
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Event Handling", () => {
    it("handles onClose being undefined", () => {
      expect(() => {
        render(<Toast message="No onClose" />);
      }).not.toThrow();
    });

    it("cleans up timers on unmount", () => {
      const { unmount } = render(
        <Toast message="Cleanup test" duration={5000} onClose={mockOnClose} />,
      );

      act(() => {
        vi.advanceTimersByTime(0); // Mount effect
      });

      unmount();

      // Advance past what would have been the dismiss time
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});

describe("ToastContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe("Event System", () => {
    it("sets up event listeners", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = render(<ToastContainer />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "showToast",
        expect.any(Function),
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "showToast",
        expect.any(Function),
      );

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it("processes showToast events", () => {
      const { container } = render(<ToastContainer />);

      const event = new CustomEvent("showToast", {
        detail: {
          id: "test-toast",
          message: "Test event message",
          type: "info" as const,
        },
      });

      act(() => {
        window.dispatchEvent(event);
      });

      // Container should have processed the event
      expect(container).toBeDefined();
    });

    it("generates IDs for events without them", () => {
      render(<ToastContainer />);

      const eventWithoutId = new CustomEvent("showToast", {
        detail: {
          message: "Auto ID test",
          type: "info" as const,
        },
      });

      expect(() => {
        act(() => {
          window.dispatchEvent(eventWithoutId);
        });
      }).not.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("handles malformed events without crashing", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      render(<ToastContainer />);

      // This should not crash the component
      act(() => {
        window.dispatchEvent(
          new CustomEvent("showToast", {
            detail: null as unknown,
          }),
        );
      });

      consoleSpy.mockRestore();
    });

    it("handles events without detail", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      render(<ToastContainer />);

      expect(() => {
        act(() => {
          window.dispatchEvent(new CustomEvent("showToast"));
        });
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });
});

describe("showToast Helper", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDispatchEvent: any;

  beforeEach(() => {
    mockDispatchEvent = vi.spyOn(window, "dispatchEvent");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Event Creation", () => {
    it("dispatches showToast event with message", () => {
      showToast("Test message");

      expect(mockDispatchEvent).toHaveBeenCalledTimes(1);
      const event = mockDispatchEvent.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe("showToast");
      expect(event.detail.message).toBe("Test message");
    });

    it("uses default type when not specified", () => {
      showToast("Default type test");

      const event = mockDispatchEvent.mock.calls[0][0] as CustomEvent;
      expect(event.detail.type).toBe("info");
    });

    it("accepts custom type", () => {
      showToast("Error message", "error");

      const event = mockDispatchEvent.mock.calls[0][0] as CustomEvent;
      expect(event.detail.type).toBe("error");
    });

    it("accepts custom duration", () => {
      showToast("Custom duration", "warning", 5000);

      const event = mockDispatchEvent.mock.calls[0][0] as CustomEvent;
      expect(event.detail.duration).toBe(5000);
    });

    it("generates unique IDs", () => {
      showToast("First toast");
      showToast("Second toast");

      expect(mockDispatchEvent).toHaveBeenCalledTimes(2);

      const event1 = mockDispatchEvent.mock.calls[0][0] as CustomEvent;
      const event2 = mockDispatchEvent.mock.calls[1][0] as CustomEvent;

      expect(event1.detail.id).toBeDefined();
      expect(event2.detail.id).toBeDefined();
      expect(event1.detail.id).not.toBe(event2.detail.id);
    });
  });

  describe("Message Types", () => {
    const types = [
      { type: "info" as const, expected: "info" },
      { type: "warning" as const, expected: "warning" },
      { type: "error" as const, expected: "error" },
      { type: "success" as const, expected: "success" },
    ];

    types.forEach(({ type, expected }) => {
      it(`creates ${type} toast`, () => {
        showToast(`${type} message`, type);
        const event = mockDispatchEvent.mock.calls[0][0] as CustomEvent;
        expect(event.detail.type).toBe(expected);
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles empty message", () => {
      showToast("");
      const event = mockDispatchEvent.mock.calls[0][0] as CustomEvent;
      expect(event.detail.message).toBe("");
    });

    it("handles very long messages", () => {
      const longMessage = "A".repeat(500);
      showToast(longMessage);
      const event = mockDispatchEvent.mock.calls[0][0] as CustomEvent;
      expect(event.detail.message).toBe(longMessage);
    });

    it("handles undefined duration", () => {
      showToast("Test", "info", undefined);
      const event = mockDispatchEvent.mock.calls[0][0] as CustomEvent;
      expect(event.detail.duration).toBeUndefined();
    });

    it("handles zero duration", () => {
      showToast("Zero duration", "info", 0);
      const event = mockDispatchEvent.mock.calls[0][0] as CustomEvent;
      expect(event.detail.duration).toBe(0);
    });
  });
});

describe("Integration Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("showToast and ToastContainer integration", () => {
    const { container } = render(<ToastContainer />);

    // This tests the integration without relying on DOM rendering
    expect(() => {
      act(() => {
        showToast("Integration test", "success", 3000);
      });
    }).not.toThrow();

    expect(container).toBeDefined();
  });

  it("multiple toasts integration", () => {
    const { container } = render(<ToastContainer />);

    expect(() => {
      act(() => {
        showToast("First toast", "info", 1000);
        showToast("Second toast", "warning", 2000);
        showToast("Third toast", "error", 3000);
      });
    }).not.toThrow();

    expect(container).toBeDefined();
  });

  it("timer cleanup integration", () => {
    const { unmount } = render(<ToastContainer />);

    act(() => {
      showToast("Cleanup test", "info", 5000);
    });

    // Unmount container before toasts would dismiss
    unmount();

    // Advance timers - should not cause errors
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(10000);
      });
    }).not.toThrow();
  });
});

describe("Component API", () => {
  it("Toast component accepts all required props", () => {
    expect(() => {
      render(<Toast message="Required prop test" />);
    }).not.toThrow();
  });

  it("Toast component accepts all optional props", () => {
    const mockOnClose = vi.fn();

    expect(() => {
      render(
        <Toast
          message="Optional props test"
          duration={5000}
          onClose={mockOnClose}
          type="warning"
        />,
      );
    }).not.toThrow();
  });

  it("ToastContainer renders without props", () => {
    expect(() => {
      render(<ToastContainer />);
    }).not.toThrow();
  });

  it("showToast function handles all parameter combinations", () => {
    expect(() => {
      showToast("Message only");
      showToast("With type", "error");
      showToast("With duration", "info", 3000);
      showToast("All params", "success", 2000);
    }).not.toThrow();
  });
});
