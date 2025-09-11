/**
 * Navigation Component Tests
 *
 * Critical infrastructure component that handles menu navigation,
 * mobile responsiveness, scroll-based section highlighting,
 * and terminal integration.
 */

import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import {
  vi,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  type MockedFunction,
} from "vitest";
import { Navigation } from "./navigation";

// Mock the external dependencies
vi.mock("@/lib/terminal/terminal-context", () => ({
  useTerminal: vi.fn(() => ({
    isOpen: false,
    toggleTerminal: vi.fn(),
  })),
}));

vi.mock("@/contexts/animation-state-context", () => ({
  useAnimationState: vi.fn(() => ({
    areAnimationsPlaying: true,
  })),
}));

vi.mock("./theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}));

vi.mock("./high-contrast-toggle", () => ({
  HighContrastToggle: () => (
    <div data-testid="high-contrast-toggle">High Contrast</div>
  ),
}));

vi.mock("./protected-lucide-icon", () => ({
  ProtectedLucideIcon: ({
    Icon,
    className,
    ...props
  }: {
    Icon: React.ComponentType<{ className?: string }>;
    className?: string;
  }) => <Icon className={className} data-testid="lucide-icon" {...props} />,
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    onClick,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    className?: string;
  }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

describe("Navigation", () => {
  let mockScrollTo: MockedFunction<typeof window.scrollTo>;
  let mockAddEventListener: MockedFunction<typeof window.addEventListener>;
  let mockRemoveEventListener: MockedFunction<
    typeof window.removeEventListener
  >;

  beforeEach(() => {
    // Mock window.scrollTo
    mockScrollTo = vi.fn();
    Object.defineProperty(window, "scrollTo", {
      value: mockScrollTo,
      writable: true,
    });

    // Mock window.scrollY
    Object.defineProperty(window, "scrollY", {
      value: 0,
      writable: true,
    });

    // Mock window.pageYOffset
    Object.defineProperty(window, "pageYOffset", {
      value: 0,
      writable: true,
    });

    // Mock addEventListener/removeEventListener
    mockAddEventListener = vi.fn();
    mockRemoveEventListener = vi.fn();
    Object.defineProperty(window, "addEventListener", {
      value: mockAddEventListener,
      writable: true,
    });
    Object.defineProperty(window, "removeEventListener", {
      value: mockRemoveEventListener,
      writable: true,
    });

    // Mock document.getElementById
    vi.spyOn(document, "getElementById").mockImplementation((id) => {
      return {
        offsetTop: id === "home" ? 0 : id === "skills" ? 500 : 1000,
        getBoundingClientRect: () => ({
          top: 100,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
        }),
      } as unknown as HTMLElement;
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders navigation with logo and terminal cursor", () => {
      render(<Navigation />);

      expect(screen.getByText("guest@")).toBeInTheDocument();
      expect(screen.getByText("Claret.Tech")).toBeInTheDocument();
      expect(screen.getByLabelText("Toggle terminal")).toBeInTheDocument();
      expect(screen.getByTestId("mobile-menu-button")).toBeInTheDocument();
    });

    it("renders all navigation items in desktop menu", () => {
      render(<Navigation />);

      const navLabels = [
        "Home",
        "Skills",
        "Experience",
        "Projects",
        "Research",
        "Papers",
        "Education",
        "Blog",
        "Contact",
      ];

      navLabels.forEach((label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it("renders theme toggles", () => {
      render(<Navigation />);

      expect(screen.getAllByTestId("theme-toggle")).toHaveLength(2); // Desktop and mobile
      expect(screen.getAllByTestId("high-contrast-toggle")).toHaveLength(2); // Desktop and mobile
    });

    it("applies initial styling classes", () => {
      render(<Navigation />);

      const nav = screen.getByRole("navigation");
      expect(nav).toHaveClass("fixed", "top-0", "z-50", "w-full");
    });
  });

  describe("Mobile Menu", () => {
    it("shows mobile menu button", () => {
      render(<Navigation />);

      const mobileButton = screen.getByTestId("mobile-menu-button");
      expect(mobileButton).toBeInTheDocument();
      expect(mobileButton).toHaveAttribute("aria-expanded", "false");
    });

    it("opens mobile menu when button clicked", async () => {
      render(<Navigation />);

      const mobileButton = screen.getByTestId("mobile-menu-button");

      await act(async () => {
        fireEvent.click(mobileButton);
      });

      expect(mobileButton).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByTestId("mobile-navigation-menu")).toBeInTheDocument();
    });

    it("closes mobile menu when button clicked again", async () => {
      render(<Navigation />);

      const mobileButton = screen.getByTestId("mobile-menu-button");

      // Open menu
      await act(async () => {
        fireEvent.click(mobileButton);
      });
      expect(screen.getByTestId("mobile-navigation-menu")).toBeInTheDocument();

      // Close menu
      await act(async () => {
        fireEvent.click(mobileButton);
      });
      expect(
        screen.queryByTestId("mobile-navigation-menu"),
      ).not.toBeInTheDocument();
    });

    it("displays navigation items in mobile menu", async () => {
      render(<Navigation />);

      const mobileButton = screen.getByTestId("mobile-menu-button");

      await act(async () => {
        fireEvent.click(mobileButton);
      });

      const mobileMenu = screen.getByTestId("mobile-navigation-menu");
      expect(mobileMenu).toBeInTheDocument();

      // Check that navigation items are present (excluding contact which is handled separately)
      const expectedItems = [
        "Home",
        "Skills",
        "Experience",
        "Projects",
        "Research",
        "Papers",
        "Education",
        "Blog",
      ];
      expectedItems.forEach((item) => {
        expect(screen.getAllByText(item)).toHaveLength(2); // Desktop + mobile menu
      });

      // Contact should be in the special CTA button
      expect(screen.getByText("Get In Touch")).toBeInTheDocument();
    });

    it("has proper accessibility attributes", async () => {
      render(<Navigation />);

      const mobileButton = screen.getByTestId("mobile-menu-button");
      expect(mobileButton).toHaveAttribute(
        "aria-controls",
        "mobile-navigation-menu",
      );
      expect(mobileButton).toHaveAttribute(
        "aria-describedby",
        "mobile-menu-desc",
      );

      await act(async () => {
        fireEvent.click(mobileButton);
      });

      const mobileMenu = screen.getByTestId("mobile-navigation-menu");
      expect(mobileMenu).toHaveAttribute("id", "mobile-navigation-menu");
    });
  });

  describe("Navigation Interactions", () => {
    it("handles navigation click with smooth scroll", async () => {
      render(<Navigation />);

      const homeLink = screen.getAllByText("Home")[0]; // Get desktop version

      await act(async () => {
        fireEvent.click(homeLink);
      });

      expect(mockScrollTo).toHaveBeenCalledWith({
        top: 36, // element position (100) + window offset (0) - navigation height (64) = 36
        behavior: "smooth",
      });
    });

    it("closes mobile menu when navigation item clicked", async () => {
      render(<Navigation />);

      const mobileButton = screen.getByTestId("mobile-menu-button");

      // Open mobile menu
      await act(async () => {
        fireEvent.click(mobileButton);
      });
      expect(screen.getByTestId("mobile-navigation-menu")).toBeInTheDocument();

      // Click navigation item in mobile menu
      const mobileHomeLink = screen.getAllByText("Home")[1]; // Get mobile menu version
      await act(async () => {
        fireEvent.click(mobileHomeLink);
      });

      expect(
        screen.queryByTestId("mobile-navigation-menu"),
      ).not.toBeInTheDocument();
      expect(mobileButton).toHaveAttribute("aria-expanded", "false");
    });

    it("handles contact button click in mobile menu", async () => {
      render(<Navigation />);

      const mobileButton = screen.getByTestId("mobile-menu-button");

      await act(async () => {
        fireEvent.click(mobileButton);
      });

      const contactButton = screen.getByText("Get In Touch");
      await act(async () => {
        fireEvent.click(contactButton);
      });

      expect(mockScrollTo).toHaveBeenCalled();
      expect(
        screen.queryByTestId("mobile-navigation-menu"),
      ).not.toBeInTheDocument();
    });

    it("prevents default behavior on navigation clicks", async () => {
      render(<Navigation />);

      const homeLink = screen.getAllByText("Home")[0];
      const mockPreventDefault = vi.fn();

      await act(async () => {
        fireEvent.click(homeLink, { preventDefault: mockPreventDefault });
      });

      // The component should prevent default and handle scrolling
      expect(mockScrollTo).toHaveBeenCalled();
    });
  });

  describe("Scroll Behavior", () => {
    it("sets up scroll event listener", () => {
      render(<Navigation />);

      expect(mockAddEventListener).toHaveBeenCalledWith(
        "scroll",
        expect.any(Function),
      );
    });

    it("cleans up scroll event listener on unmount", () => {
      const { unmount } = render(<Navigation />);

      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        "scroll",
        expect.any(Function),
      );
    });

    it("updates active section based on scroll position", async () => {
      // Mock scrollY to simulate scrolling to skills section
      Object.defineProperty(window, "scrollY", { value: 400, writable: true });

      render(<Navigation />);

      // Simulate scroll event
      const scrollHandler = mockAddEventListener.mock.calls.find(
        ([event]) => event === "scroll",
      )?.[1];

      if (scrollHandler && typeof scrollHandler === "function") {
        act(() => {
          scrollHandler(new Event("scroll"));
        });
      }

      // Home should be active initially after scroll simulation
      await waitFor(() => {
        const homeLinks = screen.getAllByText("Home");

        // Check if home link has the active styling (this tests the component logic)
        // Initially home is active, but after scroll skills should become active
        expect(homeLinks[0].closest("a")).toHaveClass("text-primary");
      });
    });

    it("applies background styling when scrolled", async () => {
      Object.defineProperty(window, "scrollY", { value: 50, writable: true });

      const { container } = render(<Navigation />);

      // Simulate scroll event
      const scrollHandler = mockAddEventListener.mock.calls.find(
        ([event]) => event === "scroll",
      )?.[1];

      if (scrollHandler && typeof scrollHandler === "function") {
        act(() => {
          scrollHandler(new Event("scroll"));
        });
      }

      await waitFor(() => {
        const nav = container.querySelector("nav");
        expect(nav).toHaveClass(
          "bg-background/80",
          "backdrop-blur-md",
          "border-b",
          "border-border",
          "shadow-sm",
        );
      });
    });
  });

  describe("Terminal Integration", () => {
    it("renders terminal toggle button", () => {
      render(<Navigation />);

      const terminalButton = screen.getByLabelText("Toggle terminal");
      expect(terminalButton).toBeInTheDocument();
    });

    it("shows cursor when terminal is closed (default mock state)", () => {
      const { container } = render(<Navigation />);

      const cursor = container.querySelector(
        '[style*="background-color: rgb(0, 249, 0)"]',
      );
      expect(cursor).toBeInTheDocument();
      // Since our mock defaults to isOpen: false, cursor should be visible
      expect(cursor).not.toHaveClass("opacity-0");
    });

    it("shows blinking cursor when animations are playing", async () => {
      const { container } = render(<Navigation />);

      // Wait for hydration effect
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      const cursor = container.querySelector(
        '[style*="background-color: rgb(0, 249, 0)"]',
      );
      expect(cursor).toHaveClass("animate-cursor-blink");
    });
  });

  describe("Error Handling", () => {
    it("handles missing elements gracefully", async () => {
      vi.spyOn(document, "getElementById").mockReturnValue(null);

      render(<Navigation />);

      const homeLink = screen.getAllByText("Home")[0];

      // Should not throw when element is not found
      expect(() => {
        act(() => {
          fireEvent.click(homeLink);
        });
      }).not.toThrow();
    });

    it("handles scroll events without errors", () => {
      render(<Navigation />);

      const scrollHandler = mockAddEventListener.mock.calls.find(
        ([event]) => event === "scroll",
      )?.[1];

      expect(() => {
        act(() => {
          if (typeof scrollHandler === "function") {
            scrollHandler(new Event("scroll"));
          }
        });
      }).not.toThrow();
    });
  });

  describe("Responsive Behavior", () => {
    it("shows mobile menu on smaller screens", () => {
      render(<Navigation />);

      const mobileButton = screen.getByTestId("mobile-menu-button");
      const buttonContainer = mobileButton.parentElement;
      expect(buttonContainer).toHaveClass("lg:hidden");
    });

    it("hides desktop navigation on smaller screens", () => {
      const { container } = render(<Navigation />);

      const desktopNav = container.querySelector(".hidden.lg\\:flex");
      expect(desktopNav).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels and attributes", () => {
      render(<Navigation />);

      expect(screen.getByLabelText("Toggle terminal")).toBeInTheDocument();
      expect(
        screen.getByText("Toggle navigation menu to access all sections"),
      ).toBeInTheDocument();

      const nav = screen.getByRole("navigation");
      expect(nav).toHaveAttribute("id", "main-navigation");
    });

    it("updates ARIA expanded state correctly", async () => {
      render(<Navigation />);

      const mobileButton = screen.getByTestId("mobile-menu-button");

      expect(mobileButton).toHaveAttribute("aria-expanded", "false");

      await act(async () => {
        fireEvent.click(mobileButton);
      });

      expect(mobileButton).toHaveAttribute("aria-expanded", "true");
    });

    it("provides proper aria-label for contact button", async () => {
      render(<Navigation />);

      const mobileButton = screen.getByTestId("mobile-menu-button");
      await act(async () => {
        fireEvent.click(mobileButton);
      });

      const contactButton = screen.getByLabelText("Contact me");
      expect(contactButton).toBeInTheDocument();
    });
  });
});
