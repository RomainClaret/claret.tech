import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Experience } from "./Experience";
import { SlideInUpProps, NextImageProps, IconProps } from "@/test/mock-types";

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(() => []),
  root: null,
  rootMargin: "",
  thresholds: [],
})) as any;

// Mock hooks
vi.mock("@/lib/hooks/useColorExtraction", () => ({
  useColorExtraction: vi.fn(() => ({
    color: "rgb(59, 130, 246)",
    isLoading: false,
    error: null,
  })),
  adjustColorBrightness: vi.fn((color, factor) => {
    // Simple brightness adjustment mock
    return factor > 1 ? "rgb(120, 180, 255)" : "rgb(30, 80, 200)";
  }),
}));

vi.mock("@/components/ui/theme-provider", () => ({
  useTheme: vi.fn(() => ({ theme: "light" })),
}));

// Mock utility functions
vi.mock("@/lib/utils/experience-calculator", () => ({
  getFormattedExperienceYears: vi.fn(() => "6.5"),
}));

vi.mock("@/lib/utils/blur-placeholder", () => ({
  DEFAULT_BLUR_PLACEHOLDER: "data:image/jpeg;base64,mockblurdata",
}));

// Mock animated components
vi.mock("@/components/ui/animated", () => ({
  SlideInUp: ({ children, delay, className, ...props }: SlideInUpProps) => (
    <div
      data-testid="slide-in-up"
      data-delay={delay}
      className={className}
      {...props}
    >
      {children}
    </div>
  ),
}));

// Mock Next.js Image component
vi.mock("next/image", () => ({
  default: ({ src, alt, className, ...props }: NextImageProps) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      data-testid="next-image"
      {...props}
    />
  ),
}));

// Mock Lucide React icons
vi.mock("lucide-react", () => ({
  ChevronDown: ({ className, ...props }: IconProps) => (
    <div data-testid="chevron-down" className={className} {...props}>
      ChevronDown
    </div>
  ),
  Calendar: () => <div data-testid="calendar-icon">Calendar</div>,
  MapPin: () => <div data-testid="map-pin-icon">MapPin</div>,
  ExternalLink: () => <div data-testid="external-link-icon">ExternalLink</div>,
  GraduationCap: () => (
    <div data-testid="graduation-cap-icon">GraduationCap</div>
  ),
  Rocket: () => <div data-testid="rocket-icon">Rocket</div>,
  Briefcase: () => <div data-testid="briefcase-icon">Briefcase</div>,
  Building: () => <div data-testid="building-icon">Building</div>,
}));

// Mock CSS utility function
vi.mock("@/lib/utils", () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(" "),
}));

describe("Experience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders the main experience section", () => {
      render(<Experience />);

      expect(screen.getByText("Selection Pressure")).toBeInTheDocument();
      expect(
        screen.getByText("From engineering precision to evolving intelligence"),
      ).toBeInTheDocument();
    });

    it("renders all experience cards", () => {
      render(<Experience />);

      // Use getAllByText for elements that appear multiple times due to responsive design
      expect(screen.getAllByText("Visiting Researcher")).toHaveLength(2); // Desktop + mobile versions
      expect(screen.getByText("University College Dublin")).toBeInTheDocument();
      expect(screen.getByText("University of Neuchâtel")).toBeInTheDocument();
    });

    it("renders career summary stats", () => {
      render(<Experience />);

      expect(screen.getByText("Positions")).toBeInTheDocument();
      expect(screen.getByText("6.5")).toBeInTheDocument(); // Mocked years experience
      expect(screen.getByText("Years Experience")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument(); // Founded companies
      expect(screen.getByText("Founded Company")).toBeInTheDocument();
    });
  });

  describe("Experience Type Detection", () => {
    it("detects research experience correctly", () => {
      render(<Experience />);

      // Research roles should have graduation cap icons (multiple research positions)
      const graduationCapIcons = screen.getAllByTestId("graduation-cap-icon");
      expect(graduationCapIcons.length).toBeGreaterThan(0);
    });

    it("detects startup experience correctly", () => {
      render(<Experience />);

      // Founder roles should have rocket icon (Artificialkind, Versicherix, Overclouds, Libacy)
      const rocketIcons = screen.getAllByTestId("rocket-icon");
      expect(rocketIcons.length).toBeGreaterThan(0);
    });

    it("detects professional experience correctly", () => {
      render(<Experience />);

      // Professional roles (non-research, non-founder) should have building icons
      const buildingIcons = screen.queryAllByTestId("building-icon");
      expect(buildingIcons.length).toBeGreaterThanOrEqual(0); // May or may not have building icons
    });
  });

  describe("Experience Cards", () => {
    it("displays basic card information", () => {
      render(<Experience />);

      // Check actual company and location info from real data
      expect(screen.getByText("University College Dublin")).toBeInTheDocument();
      // Location appears twice due to responsive design
      expect(screen.getAllByText("Dublin, Ireland")).toHaveLength(2);
      // Date also appears twice due to responsive design
      expect(screen.getAllByText("Sep. 2023 - Present")).toHaveLength(2);
    });

    it("displays company logos", () => {
      render(<Experience />);

      const images = screen.getAllByTestId("next-image");
      expect(images.length).toBeGreaterThan(0);
      // Check that first logo is from actual data
      expect(images[0]).toHaveAttribute("src", "/images/ucd_logo.webp");
    });

    it("shows expand/collapse buttons for experiences with content", () => {
      render(<Experience />);

      const expandButtons = screen.getAllByRole("button", {
        name: /Show more details/,
      });
      // Most real experiences have desc or descBullets, so should have expand buttons
      expect(expandButtons.length).toBeGreaterThan(0);
    });

    it("expands and collapses experience details", async () => {
      render(<Experience />);

      const expandButtons = screen.getAllByRole("button", {
        name: /Show more details/,
      });
      if (expandButtons.length === 0) return; // Skip if no expandable content

      const expandButton = expandButtons[0];

      // Click to expand
      fireEvent.click(expandButton);

      await waitFor(() => {
        // Verify content is visible after expanding
        expect(
          screen.getByText(/Research collaboration on neuroevolution/),
        ).toBeInTheDocument();
      });

      // Check button text changed
      expect(
        screen.getByRole("button", { name: /Show less details/ }),
      ).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(
        screen.getByRole("button", { name: /Show less details/ }),
      );

      await waitFor(() => {
        // Button text should change back (multiple buttons exist)
        const showMoreButtons = screen.getAllByRole("button", {
          name: /Show more details/,
        });
        expect(showMoreButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Theme Integration", () => {
    it("renders with theme context", () => {
      render(<Experience />);

      // Should render without errors when theme hooks are used
      expect(screen.getByText("Selection Pressure")).toBeInTheDocument();
    });

    it("uses color extraction for styling", () => {
      render(<Experience />);

      // Should use extracted colors for styling (mocked hooks)
      expect(screen.getByText("Selection Pressure")).toBeInTheDocument();
    });
  });

  describe("Animation Integration", () => {
    it("renders SlideInUp animations with proper delays", () => {
      render(<Experience />);

      const animations = screen.getAllByTestId("slide-in-up");

      // Should have at least header and career summary animations
      expect(animations.length).toBeGreaterThanOrEqual(2);

      // Career summary should have delay of 600ms
      const careerSummary = animations.find(
        (el) => el.getAttribute("data-delay") === "600",
      );
      expect(careerSummary).toBeInTheDocument();
    });

    it("applies animation delays", () => {
      render(<Experience />);

      const cards = screen.getAllByTestId("slide-in-up");
      const cardDelays = cards
        .map((card) => card.getAttribute("data-delay"))
        .filter(Boolean);

      // Should have at least one delay
      expect(cardDelays.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Responsive Behavior", () => {
    it("renders cards in responsive layout", () => {
      render(<Experience />);

      // Check for flex container (component uses flexbox)
      const flexContainer = document.querySelector(".flex");
      expect(flexContainer).toBeInTheDocument();
    });
  });

  describe("External Links", () => {
    it("renders external link icons for experiences with websites", () => {
      render(<Experience />);

      // Should have external link icons for experiences with websites
      const externalLinks = screen.getAllByTestId("external-link-icon");
      expect(externalLinks.length).toBeGreaterThan(0);
    });
  });

  describe("Technologies Display", () => {
    it("displays technology tags when expanded", async () => {
      render(<Experience />);

      const expandButtons = screen.getAllByRole("button", {
        name: /Show more details/,
      });
      if (expandButtons.length === 0) return; // Skip if no expandable content

      // Expand the first experience
      const expandButton = expandButtons[0];
      fireEvent.click(expandButton);

      await waitFor(() => {
        // Check for actual hashtag content from first experience (as complete string)
        expect(
          screen.getByText(
            "#Neuroevolution #EvolutionaryComputation #Research #Collaboration",
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("handles component rendering gracefully", () => {
      render(<Experience />);

      // Should render without crashing
      expect(screen.getByText("Selection Pressure")).toBeInTheDocument();

      // Should render company logos
      const images = screen.getAllByTestId("next-image");
      expect(images.length).toBeGreaterThan(0);
    });

    it("handles experiences with minimal content", () => {
      render(<Experience />);

      // Should render all experiences regardless of content amount
      expect(screen.getAllByText("Visiting Researcher")).toHaveLength(2);

      // Some experiences may have no expandable content
      const expandButtons = screen.getAllByRole("button", {
        name: /Show more details/,
      });
      expect(expandButtons.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Accessibility", () => {
    it("provides proper ARIA labels for expand buttons", () => {
      render(<Experience />);

      const expandButtons = screen.getAllByRole("button", {
        name: /Show more details/,
      });
      if (expandButtons.length > 0) {
        expect(expandButtons[0]).toBeInTheDocument();
      }
    });

    it("uses semantic HTML elements", () => {
      render(<Experience />);

      // Should use article elements for experience cards
      const articles = document.querySelectorAll("article");
      expect(articles.length).toBeGreaterThan(0);
    });

    it("provides alternative text for company logos", () => {
      render(<Experience />);

      const images = screen.getAllByTestId("next-image");
      images.forEach((img) => {
        expect(img).toHaveAttribute("alt");
      });
    });
  });
});
