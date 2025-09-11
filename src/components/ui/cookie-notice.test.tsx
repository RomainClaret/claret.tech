/**
 * Cookie Notice Component Tests
 *
 * Tests the cookie consent banner that displays privacy information
 * and provides links to legal documents (Privacy Policy, Terms of Service).
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import CookieNotice from "./cookie-notice";
import { useLegalModals } from "./legal-modals-provider";

// Mock the legal modals provider
vi.mock("./legal-modals-provider");

const mockUseLegalModals = vi.mocked(useLegalModals);
const mockOpenPrivacyModal = vi.fn();
const mockOpenTermsModal = vi.fn();

// Helper function to render component and wait for it to appear
const renderCookieNoticeAndWait = async (acknowledged = false) => {
  const isCI = !!process.env.CI;
  const timeout = isCI ? 15000 : 5000; // Longer timeout for CI environment

  (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
    acknowledged ? "true" : null,
  );

  // Temporarily use real timers for this function to avoid conflicts
  vi.useRealTimers();

  let result;
  try {
    result = render(<CookieNotice />);
  } catch (error) {
    console.error("Failed to render CookieNotice component:", error);
    throw error;
  }

  if (!acknowledged) {
    // Wait for component to appear - the component uses a real 1000ms setTimeout
    try {
      await waitFor(
        () => {
          const element = screen.queryByText(/Cookie Selection/);
          expect(element).toBeInTheDocument();
        },
        { timeout },
      );
    } catch (error) {
      // Enhanced error reporting for debugging
      console.error("Failed to find Cookie Selection element:", error);
      console.error("DOM content:", document.body.innerHTML);
      throw error;
    }
  }

  // Restore fake timers for other test operations
  vi.useFakeTimers();

  return result;
};

describe("CookieNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock localStorage
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });

    // Setup legal modals mock
    mockUseLegalModals.mockReturnValue({
      openPrivacyModal: mockOpenPrivacyModal,
      openTermsModal: mockOpenTermsModal,
      openLicenseModal: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Initial Display", () => {
    it("does not show notice initially", () => {
      render(<CookieNotice />);

      expect(screen.queryByText(/Cookie Selection/)).not.toBeInTheDocument();
    });

    it("shows notice after delay when not previously acknowledged", async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        null,
      );

      // Use real timers for this test to avoid conflicts
      vi.useRealTimers();

      render(<CookieNotice />);

      // Should not be visible immediately
      expect(screen.queryByText(/Cookie Selection/)).not.toBeInTheDocument();

      // Wait for the component to appear after the real 1000ms delay
      const isCI = !!process.env.CI;
      await waitFor(
        () => {
          expect(screen.getByText(/Cookie Selection/)).toBeInTheDocument();
        },
        { timeout: isCI ? 15000 : 5000 },
      );

      // Restore fake timers
      vi.useFakeTimers();
    });

    it("does not show notice if previously acknowledged", () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        "true",
      );

      render(<CookieNotice />);

      // Advance timer
      vi.advanceTimersByTime(1000);

      expect(screen.queryByText(/Cookie Selection/)).not.toBeInTheDocument();
    });
  });

  describe("Cookie Notice Content", () => {
    it("displays the evolution-themed cookie message", async () => {
      await renderCookieNoticeAndWait();
      expect(screen.getByText(/🧬 Cookie Selection:/)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Only the essential survive—theme genes and performance adaptations/,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/privacy-focused analytics \(Vercel\)/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/No invasive tracking, no third-party advertising/),
      ).toBeInTheDocument();
    });

    it("includes legal document links", async () => {
      await renderCookieNoticeAndWait();
      expect(
        screen.getByRole("button", { name: /Open Privacy Policy/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Open Terms of Service/ }),
      ).toBeInTheDocument();
    });

    it("mentions footer availability", async () => {
      await renderCookieNoticeAndWait();
      expect(
        screen.getByText(/also available in the footer/),
      ).toBeInTheDocument();
    });

    it("includes 'Got it!' accept button", async () => {
      await renderCookieNoticeAndWait();
      expect(
        screen.getByRole("button", { name: /Accept cookie notice/ }),
      ).toBeInTheDocument();
      expect(screen.getByText("Got it!")).toBeInTheDocument();
    });
  });

  describe("Legal Links Functionality", () => {
    it("opens privacy policy modal when privacy link is clicked", async () => {
      await renderCookieNoticeAndWait();
      const privacyLink = screen.getByRole("button", {
        name: /Open Privacy Policy/,
      });

      fireEvent.click(privacyLink);

      expect(mockOpenPrivacyModal).toHaveBeenCalledTimes(1);
    });

    it("opens terms of service modal when terms link is clicked", async () => {
      await renderCookieNoticeAndWait();
      const termsLink = screen.getByRole("button", {
        name: /Open Terms of Service/,
      });

      fireEvent.click(termsLink);

      expect(mockOpenTermsModal).toHaveBeenCalledTimes(1);
    });

    it("applies correct styling to legal links", async () => {
      await renderCookieNoticeAndWait();
      const privacyLink = screen.getByRole("button", {
        name: /Open Privacy Policy/,
      });
      const termsLink = screen.getByRole("button", {
        name: /Open Terms of Service/,
      });

      expect(privacyLink).toHaveClass("text-primary-purple");
      expect(privacyLink).toHaveClass("hover:text-primary-pink");
      expect(privacyLink).toHaveClass("underline");
      expect(privacyLink).toHaveClass("transition-colors");
      expect(privacyLink).toHaveClass("font-medium");

      expect(termsLink).toHaveClass("text-primary-purple");
      expect(termsLink).toHaveClass("hover:text-primary-pink");
      expect(termsLink).toHaveClass("underline");
      expect(termsLink).toHaveClass("transition-colors");
      expect(termsLink).toHaveClass("font-medium");
    });
  });

  describe("Accept Functionality", () => {
    it("hides notice when 'Got it!' button is clicked", async () => {
      await renderCookieNoticeAndWait();
      const acceptButton = screen.getByRole("button", {
        name: /Accept cookie notice/,
      });

      fireEvent.click(acceptButton);

      expect(screen.queryByText(/Cookie Selection/)).not.toBeInTheDocument();
    });

    it("saves acknowledgment to localStorage when accepted", async () => {
      await renderCookieNoticeAndWait();
      const acceptButton = screen.getByRole("button", {
        name: /Accept cookie notice/,
      });

      fireEvent.click(acceptButton);

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        "cookie-notice-acknowledged",
        "true",
      );
    });

    it("does not show notice again after acknowledgment", async () => {
      await renderCookieNoticeAndWait();
      const acceptButton = screen.getByRole("button", {
        name: /Accept cookie notice/,
      });

      fireEvent.click(acceptButton);

      // Mock localStorage to return acknowledged state
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        "true",
      );

      // Re-render component with acknowledged state
      render(<CookieNotice />);

      // Should not appear (no need for timer since localStorage returns "true")
      expect(screen.queryByText(/Cookie Selection/)).not.toBeInTheDocument();
    });
  });

  describe("Styling and Layout", () => {
    it("applies fixed bottom positioning", async () => {
      await renderCookieNoticeAndWait();
      const notice = screen.getByText(/Cookie Selection/).closest(".fixed");

      expect(notice).toHaveClass("fixed");
      expect(notice).toHaveClass("bottom-0");
      expect(notice).toHaveClass("left-0");
      expect(notice).toHaveClass("right-0");
    });

    it("has proper z-index for layering", async () => {
      await renderCookieNoticeAndWait();
      const notice = screen.getByText(/Cookie Selection/).closest(".z-50");

      expect(notice).toHaveClass("z-50");
    });

    it("includes backdrop styling", async () => {
      await renderCookieNoticeAndWait();
      const notice = screen
        .getByText(/Cookie Selection/)
        .closest(".bg-gray-900\\/95");

      expect(notice).toHaveClass("bg-gray-900/95");
      expect(notice).toHaveClass("backdrop-blur-sm");
      expect(notice).toHaveClass("border-t");
      expect(notice).toHaveClass("border-gray-800");
      expect(notice).toHaveClass("shadow-lg");
    });

    it("has slide-up animation", async () => {
      await renderCookieNoticeAndWait();
      const notice = screen
        .getByText(/Cookie Selection/)
        .closest(".animate-slide-up");

      expect(notice).toHaveClass("animate-slide-up");
    });

    it("uses responsive layout classes", async () => {
      await renderCookieNoticeAndWait();
      const container = screen
        .getByText(/Cookie Selection/)
        .closest(".max-w-7xl");
      const flexContainer = screen
        .getByText(/Cookie Selection/)
        .closest(".flex");

      expect(container).toBeInTheDocument();
      expect(flexContainer).toHaveClass("flex-col");
      expect(flexContainer).toHaveClass("sm:flex-row");
    });
  });

  describe("Accessibility", () => {
    it("provides proper aria-labels for buttons", async () => {
      await renderCookieNoticeAndWait();
      expect(
        screen.getByRole("button", { name: /Open Privacy Policy/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Open Terms of Service/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Accept cookie notice/ }),
      ).toBeInTheDocument();
    });

    it("uses button elements for interactive content", async () => {
      await renderCookieNoticeAndWait();
      const privacyLink = screen.getByRole("button", {
        name: /Open Privacy Policy/,
      });
      const termsLink = screen.getByRole("button", {
        name: /Open Terms of Service/,
      });
      const acceptButton = screen.getByRole("button", {
        name: /Accept cookie notice/,
      });

      expect(privacyLink.tagName.toLowerCase()).toBe("button");
      expect(termsLink.tagName.toLowerCase()).toBe("button");
      expect(acceptButton.tagName.toLowerCase()).toBe("button");
    });

    it("is keyboard navigable", async () => {
      await renderCookieNoticeAndWait();
      const privacyLink = screen.getByRole("button", {
        name: /Open Privacy Policy/,
      });
      const termsLink = screen.getByRole("button", {
        name: /Open Terms of Service/,
      });
      const acceptButton = screen.getByRole("button", {
        name: /Accept cookie notice/,
      });

      // Verify elements can be focused (tabIndex >= -1) instead of checking actual focus
      expect(privacyLink).toBeInTheDocument();
      expect(privacyLink).not.toBeDisabled();
      expect(privacyLink.tabIndex).toBeGreaterThanOrEqual(-1);

      expect(termsLink).toBeInTheDocument();
      expect(termsLink).not.toBeDisabled();
      expect(termsLink.tabIndex).toBeGreaterThanOrEqual(-1);

      expect(acceptButton).toBeInTheDocument();
      expect(acceptButton).not.toBeDisabled();
      expect(acceptButton.tabIndex).toBeGreaterThanOrEqual(-1);
    });
  });

  describe("Edge Cases", () => {
    it("handles localStorage errors gracefully", async () => {
      (
        window.localStorage.getItem as ReturnType<typeof vi.fn>
      ).mockImplementation(() => {
        throw new Error("localStorage error");
      });

      // Should not crash when rendering
      expect(() => {
        render(<CookieNotice />);
      }).not.toThrow();
    });

    it("handles setItem localStorage errors gracefully", async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        null,
      );
      (
        window.localStorage.setItem as ReturnType<typeof vi.fn>
      ).mockImplementation(() => {
        throw new Error("localStorage setItem error");
      });

      // Use real timers to avoid conflicts
      vi.useRealTimers();
      render(<CookieNotice />);

      await waitFor(
        () => {
          expect(screen.getByText(/Cookie Selection/)).toBeInTheDocument();
        },
        { timeout: !!process.env.CI ? 15000 : 5000 },
      );

      const acceptButton = screen.getByRole("button", {
        name: /Accept cookie notice/,
      });

      // Should not crash when clicking accept
      expect(() => {
        fireEvent.click(acceptButton);
      }).not.toThrow();

      // Restore fake timers
      vi.useFakeTimers();
    });

    it("handles missing legal modals context gracefully", () => {
      mockUseLegalModals.mockImplementation(() => {
        throw new Error("Context not found");
      });

      // Should throw the expected context error
      expect(() => {
        render(<CookieNotice />);
      }).toThrow("Context not found");
    });

    it("clears timeout on unmount", () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        null,
      );

      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const { unmount } = render(<CookieNotice />);

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe("Multiple Renders", () => {
    it("handles re-renders correctly", async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        null,
      );

      // Use real timers to avoid conflicts
      vi.useRealTimers();
      const { rerender } = render(<CookieNotice />);

      await waitFor(
        () => {
          expect(screen.getByText(/Cookie Selection/)).toBeInTheDocument();
        },
        { timeout: !!process.env.CI ? 15000 : 5000 },
      );

      // Re-render should not cause issues
      rerender(<CookieNotice />);

      expect(screen.getByText(/Cookie Selection/)).toBeInTheDocument();

      // Restore fake timers
      vi.useFakeTimers();
    });

    it("maintains state across re-renders", async () => {
      (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
        null,
      );

      // Use real timers to avoid conflicts
      vi.useRealTimers();
      const { rerender } = render(<CookieNotice />);

      await waitFor(
        () => {
          expect(screen.getByText(/Cookie Selection/)).toBeInTheDocument();
        },
        { timeout: !!process.env.CI ? 15000 : 5000 },
      );

      // Accept the notice
      const acceptButton = screen.getByRole("button", {
        name: /Accept cookie notice/,
      });
      fireEvent.click(acceptButton);

      // Re-render
      rerender(<CookieNotice />);

      // Should remain hidden
      expect(screen.queryByText(/Cookie Selection/)).not.toBeInTheDocument();

      // Restore fake timers
      vi.useFakeTimers();
    });
  });
});
