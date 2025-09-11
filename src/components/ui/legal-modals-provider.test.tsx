/**
 * Legal Modals Provider Tests
 *
 * Tests the context provider that manages legal modal state
 * (Privacy Policy, Terms of Service, MIT License) across components.
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { LegalModalsProvider, useLegalModals } from "./legal-modals-provider";

// Mock the legal modal component
vi.mock("./legal-modal", () => ({
  LegalModal: ({ isOpen, onClose, title, children }: any) => {
    if (!isOpen) return null;
    return (
      <div
        data-testid={`legal-modal-${title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <div>{title}</div>
        <button
          onClick={onClose}
          data-testid={`close-${title.toLowerCase().replace(/\s+/g, "-")}`}
        >
          Close
        </button>
        <div data-testid="modal-content">{children}</div>
      </div>
    );
  },
}));

// Mock the content components
vi.mock("@/components/legal/privacy-content", () => ({
  PrivacyContent: () => (
    <div data-testid="privacy-content">Privacy Policy Content</div>
  ),
}));

vi.mock("@/components/legal/terms-content", () => ({
  TermsContent: () => (
    <div data-testid="terms-content">Terms of Service Content</div>
  ),
}));

vi.mock("@/components/legal/license-content", () => ({
  LicenseContent: () => (
    <div data-testid="license-content">MIT License Content</div>
  ),
}));

// Test component that uses the legal modals context
function TestComponent() {
  const { openPrivacyModal, openTermsModal, openLicenseModal } =
    useLegalModals();

  return (
    <div>
      <button onClick={openPrivacyModal} data-testid="open-privacy">
        Open Privacy Policy
      </button>
      <button onClick={openTermsModal} data-testid="open-terms">
        Open Terms of Service
      </button>
      <button onClick={openLicenseModal} data-testid="open-license">
        Open MIT License
      </button>
    </div>
  );
}

describe("LegalModalsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Context Provider", () => {
    it("provides legal modal functions to children", () => {
      render(
        <LegalModalsProvider>
          <TestComponent />
        </LegalModalsProvider>,
      );

      expect(screen.getByTestId("open-privacy")).toBeInTheDocument();
      expect(screen.getByTestId("open-terms")).toBeInTheDocument();
      expect(screen.getByTestId("open-license")).toBeInTheDocument();
    });

    it("throws error when useLegalModals is used outside provider", () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = vi.fn();

      expect(() => {
        render(<TestComponent />);
      }).toThrow("useLegalModals must be used within a LegalModalsProvider");

      console.error = originalError;
    });
  });

  describe("Privacy Policy Modal", () => {
    it("opens privacy policy modal when openPrivacyModal is called", () => {
      render(
        <LegalModalsProvider>
          <TestComponent />
        </LegalModalsProvider>,
      );

      // Modal should not be visible initially
      expect(
        screen.queryByTestId("legal-modal-privacy-policy"),
      ).not.toBeInTheDocument();

      // Click to open privacy modal
      fireEvent.click(screen.getByTestId("open-privacy"));

      // Modal should now be visible
      expect(
        screen.getByTestId("legal-modal-privacy-policy"),
      ).toBeInTheDocument();
      expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
      expect(screen.getByTestId("privacy-content")).toBeInTheDocument();
    });

    it("closes privacy policy modal when close button is clicked", () => {
      render(
        <LegalModalsProvider>
          <TestComponent />
        </LegalModalsProvider>,
      );

      // Open the modal
      fireEvent.click(screen.getByTestId("open-privacy"));
      expect(
        screen.getByTestId("legal-modal-privacy-policy"),
      ).toBeInTheDocument();

      // Close the modal
      fireEvent.click(screen.getByTestId("close-privacy-policy"));
      expect(
        screen.queryByTestId("legal-modal-privacy-policy"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Terms of Service Modal", () => {
    it("opens terms modal when openTermsModal is called", () => {
      render(
        <LegalModalsProvider>
          <TestComponent />
        </LegalModalsProvider>,
      );

      // Modal should not be visible initially
      expect(
        screen.queryByTestId("legal-modal-terms-of-service"),
      ).not.toBeInTheDocument();

      // Click to open terms modal
      fireEvent.click(screen.getByTestId("open-terms"));

      // Modal should now be visible
      expect(
        screen.getByTestId("legal-modal-terms-of-service"),
      ).toBeInTheDocument();
      expect(screen.getByText("Terms of Service")).toBeInTheDocument();
      expect(screen.getByTestId("terms-content")).toBeInTheDocument();
    });

    it("closes terms modal when close button is clicked", () => {
      render(
        <LegalModalsProvider>
          <TestComponent />
        </LegalModalsProvider>,
      );

      // Open the modal
      fireEvent.click(screen.getByTestId("open-terms"));
      expect(
        screen.getByTestId("legal-modal-terms-of-service"),
      ).toBeInTheDocument();

      // Close the modal
      fireEvent.click(screen.getByTestId("close-terms-of-service"));
      expect(
        screen.queryByTestId("legal-modal-terms-of-service"),
      ).not.toBeInTheDocument();
    });
  });

  describe("MIT License Modal", () => {
    it("opens license modal when openLicenseModal is called", () => {
      render(
        <LegalModalsProvider>
          <TestComponent />
        </LegalModalsProvider>,
      );

      // Modal should not be visible initially
      expect(
        screen.queryByTestId("legal-modal-mit-license"),
      ).not.toBeInTheDocument();

      // Click to open license modal
      fireEvent.click(screen.getByTestId("open-license"));

      // Modal should now be visible
      expect(screen.getByTestId("legal-modal-mit-license")).toBeInTheDocument();
      expect(screen.getByText("MIT License")).toBeInTheDocument();
      expect(screen.getByTestId("license-content")).toBeInTheDocument();
    });

    it("closes license modal when close button is clicked", () => {
      render(
        <LegalModalsProvider>
          <TestComponent />
        </LegalModalsProvider>,
      );

      // Open the modal
      fireEvent.click(screen.getByTestId("open-license"));
      expect(screen.getByTestId("legal-modal-mit-license")).toBeInTheDocument();

      // Close the modal
      fireEvent.click(screen.getByTestId("close-mit-license"));
      expect(
        screen.queryByTestId("legal-modal-mit-license"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Multiple Modal Management", () => {
    it("can open multiple modals simultaneously", () => {
      render(
        <LegalModalsProvider>
          <TestComponent />
        </LegalModalsProvider>,
      );

      // Open privacy modal
      fireEvent.click(screen.getByTestId("open-privacy"));
      expect(
        screen.getByTestId("legal-modal-privacy-policy"),
      ).toBeInTheDocument();

      // Open terms modal
      fireEvent.click(screen.getByTestId("open-terms"));
      expect(
        screen.getByTestId("legal-modal-terms-of-service"),
      ).toBeInTheDocument();

      // Both should be open simultaneously
      expect(
        screen.getByTestId("legal-modal-privacy-policy"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("legal-modal-terms-of-service"),
      ).toBeInTheDocument();
    });

    it("can open license modal while other modals are open", () => {
      render(
        <LegalModalsProvider>
          <TestComponent />
        </LegalModalsProvider>,
      );

      // Open privacy modal first
      fireEvent.click(screen.getByTestId("open-privacy"));
      expect(
        screen.getByTestId("legal-modal-privacy-policy"),
      ).toBeInTheDocument();

      // Open license modal
      fireEvent.click(screen.getByTestId("open-license"));
      expect(screen.getByTestId("legal-modal-mit-license")).toBeInTheDocument();

      // Both should be open
      expect(
        screen.getByTestId("legal-modal-privacy-policy"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("legal-modal-mit-license")).toBeInTheDocument();
    });

    it("closes individual modals independently", () => {
      render(
        <LegalModalsProvider>
          <TestComponent />
        </LegalModalsProvider>,
      );

      // Open all modals
      fireEvent.click(screen.getByTestId("open-privacy"));
      fireEvent.click(screen.getByTestId("open-terms"));
      fireEvent.click(screen.getByTestId("open-license"));

      // All should be open
      expect(
        screen.getByTestId("legal-modal-privacy-policy"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("legal-modal-terms-of-service"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("legal-modal-mit-license")).toBeInTheDocument();

      // Close only privacy modal
      fireEvent.click(screen.getByTestId("close-privacy-policy"));

      // Privacy should be closed, others still open
      expect(
        screen.queryByTestId("legal-modal-privacy-policy"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId("legal-modal-terms-of-service"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("legal-modal-mit-license")).toBeInTheDocument();
    });
  });

  describe("Modal State Independence", () => {
    it("maintains independent state for each modal", () => {
      render(
        <LegalModalsProvider>
          <TestComponent />
        </LegalModalsProvider>,
      );

      // Open and close privacy modal
      fireEvent.click(screen.getByTestId("open-privacy"));
      fireEvent.click(screen.getByTestId("close-privacy-policy"));

      // Open terms modal - should work independently
      fireEvent.click(screen.getByTestId("open-terms"));
      expect(
        screen.getByTestId("legal-modal-terms-of-service"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("legal-modal-privacy-policy"),
      ).not.toBeInTheDocument();
    });

    it("allows reopening previously closed modals", () => {
      render(
        <LegalModalsProvider>
          <TestComponent />
        </LegalModalsProvider>,
      );

      // Open and close privacy modal
      fireEvent.click(screen.getByTestId("open-privacy"));
      fireEvent.click(screen.getByTestId("close-privacy-policy"));
      expect(
        screen.queryByTestId("legal-modal-privacy-policy"),
      ).not.toBeInTheDocument();

      // Reopen privacy modal
      fireEvent.click(screen.getByTestId("open-privacy"));
      expect(
        screen.getByTestId("legal-modal-privacy-policy"),
      ).toBeInTheDocument();
    });
  });

  describe("Content Rendering", () => {
    it("renders correct content components in each modal", () => {
      render(
        <LegalModalsProvider>
          <TestComponent />
        </LegalModalsProvider>,
      );

      // Open privacy modal and check content
      fireEvent.click(screen.getByTestId("open-privacy"));
      expect(screen.getByTestId("privacy-content")).toBeInTheDocument();
      expect(screen.getByText("Privacy Policy Content")).toBeInTheDocument();

      // Open terms modal and check content
      fireEvent.click(screen.getByTestId("open-terms"));
      expect(screen.getByTestId("terms-content")).toBeInTheDocument();
      expect(screen.getByText("Terms of Service Content")).toBeInTheDocument();

      // Open license modal and check content
      fireEvent.click(screen.getByTestId("open-license"));
      expect(screen.getByTestId("license-content")).toBeInTheDocument();
      expect(screen.getByText("MIT License Content")).toBeInTheDocument();
    });

    it("passes correct titles to modal components", () => {
      render(
        <LegalModalsProvider>
          <TestComponent />
        </LegalModalsProvider>,
      );

      // Open each modal and verify titles
      fireEvent.click(screen.getByTestId("open-privacy"));
      expect(screen.getByText("Privacy Policy")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("open-terms"));
      expect(screen.getByText("Terms of Service")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("open-license"));
      expect(screen.getByText("MIT License")).toBeInTheDocument();
    });
  });

  describe("Provider with No Children", () => {
    it("renders without children", () => {
      const { container } = render(
        <LegalModalsProvider>{null}</LegalModalsProvider>,
      );

      // Should render without errors
      expect(container).toBeInTheDocument();
    });

    it("renders with empty children", () => {
      const { container } = render(
        <LegalModalsProvider>{null}</LegalModalsProvider>,
      );

      expect(container).toBeInTheDocument();
    });
  });

  describe("Context Functions", () => {
    it("provides stable function references", () => {
      let firstRenderFunctions: any;
      let secondRenderFunctions: any;

      function TestStability() {
        const functions = useLegalModals();
        if (!firstRenderFunctions) {
          firstRenderFunctions = functions;
        } else {
          secondRenderFunctions = functions;
        }
        return <div>Test</div>;
      }

      const { rerender } = render(
        <LegalModalsProvider>
          <TestStability />
        </LegalModalsProvider>,
      );

      rerender(
        <LegalModalsProvider>
          <TestStability />
        </LegalModalsProvider>,
      );

      // Functions should be stable across renders
      expect(firstRenderFunctions.openPrivacyModal).toBe(
        secondRenderFunctions.openPrivacyModal,
      );
      expect(firstRenderFunctions.openTermsModal).toBe(
        secondRenderFunctions.openTermsModal,
      );
      expect(firstRenderFunctions.openLicenseModal).toBe(
        secondRenderFunctions.openLicenseModal,
      );
    });
  });
});
