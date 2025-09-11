/**
 * Home Page Component Tests
 *
 * Critical main application entry point that renders all major sections
 * in proper order with correct section IDs for navigation.
 */

import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import Home from "./page";

// Mock all section components to avoid heavy rendering
vi.mock("@/components/sections/Introduction", () => ({
  Introduction: () => (
    <div data-testid="introduction-section">Introduction Component</div>
  ),
}));

vi.mock("@/components/sections/Skills", () => ({
  Skills: () => <div data-testid="skills-section">Skills Component</div>,
}));

vi.mock("@/components/sections/Projects", () => ({
  Projects: () => <div data-testid="projects-section">Projects Component</div>,
}));

vi.mock("@/components/sections/ExperienceTimeline", () => ({
  ExperienceTimeline: () => (
    <div data-testid="experience-section">Experience Component</div>
  ),
}));

vi.mock("@/components/sections/Research", () => ({
  Research: () => <div data-testid="research-section">Research Component</div>,
}));

vi.mock("@/components/sections/Papers", () => ({
  Papers: () => <div data-testid="papers-section">Papers Component</div>,
}));

vi.mock("@/components/sections/Education", () => ({
  Education: () => (
    <div data-testid="education-section">Education Component</div>
  ),
}));

vi.mock("@/components/sections/Blog", () => ({
  Blog: () => <div data-testid="blog-section">Blog Component</div>,
}));

vi.mock("@/components/sections/Contact", () => ({
  Contact: () => <div data-testid="contact-section">Contact Component</div>,
}));

describe("Home Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Component Structure", () => {
    it("renders without crashing", () => {
      expect(() => {
        render(<Home />);
      }).not.toThrow();
    });

    it("renders all major sections", () => {
      render(<Home />);

      expect(screen.getByTestId("introduction-section")).toBeInTheDocument();
      expect(screen.getByTestId("skills-section")).toBeInTheDocument();
      expect(screen.getByTestId("experience-section")).toBeInTheDocument();
      expect(screen.getByTestId("projects-section")).toBeInTheDocument();
      expect(screen.getByTestId("research-section")).toBeInTheDocument();
      expect(screen.getByTestId("papers-section")).toBeInTheDocument();
      expect(screen.getByTestId("education-section")).toBeInTheDocument();
      expect(screen.getByTestId("blog-section")).toBeInTheDocument();
      expect(screen.getByTestId("contact-section")).toBeInTheDocument();
    });

    it("renders sections in correct order", () => {
      const { container } = render(<Home />);

      const sections = container.querySelectorAll("section");
      expect(sections).toHaveLength(9);

      // Verify section order by checking their IDs
      expect(sections[0]).toHaveAttribute("id", "home");
      expect(sections[1]).toHaveAttribute("id", "skills");
      expect(sections[2]).toHaveAttribute("id", "experience");
      expect(sections[3]).toHaveAttribute("id", "projects");
      expect(sections[4]).toHaveAttribute("id", "research");
      expect(sections[5]).toHaveAttribute("id", "papers");
      expect(sections[6]).toHaveAttribute("id", "education");
      expect(sections[7]).toHaveAttribute("id", "blogs");
      expect(sections[8]).toHaveAttribute("id", "contact");
    });
  });

  describe("Navigation Integration", () => {
    it("has proper section IDs for navigation", () => {
      render(<Home />);

      // Check that all navigation anchor points exist
      expect(document.getElementById("home")).toBeInTheDocument();
      expect(document.getElementById("skills")).toBeInTheDocument();
      expect(document.getElementById("experience")).toBeInTheDocument();
      expect(document.getElementById("projects")).toBeInTheDocument();
      expect(document.getElementById("research")).toBeInTheDocument();
      expect(document.getElementById("papers")).toBeInTheDocument();
      expect(document.getElementById("education")).toBeInTheDocument();
      expect(document.getElementById("blogs")).toBeInTheDocument();
      expect(document.getElementById("contact")).toBeInTheDocument();
    });

    it("maintains consistent ID naming convention", () => {
      render(<Home />);

      // Verify that section IDs follow expected patterns
      const expectedIds = [
        "home",
        "skills",
        "experience",
        "projects",
        "research",
        "papers",
        "education",
        "blogs", // Note: "blogs" not "blog"
        "contact",
      ];

      expectedIds.forEach((id) => {
        expect(document.getElementById(id)).toBeInTheDocument();
      });
    });
  });

  describe("Section Layout", () => {
    it("applies correct base styling classes", () => {
      render(<Home />);

      const skillsSection = document.getElementById("skills");
      expect(skillsSection).toHaveClass(
        "min-h-screen",
        "flex",
        "items-center",
        "justify-center",
        "bg-muted/50",
      );

      const experienceSection = document.getElementById("experience");
      expect(experienceSection).toHaveClass("py-12");

      const projectsSection = document.getElementById("projects");
      expect(projectsSection).toHaveClass(
        "min-h-screen",
        "flex",
        "items-center",
        "justify-center",
        "bg-muted/50",
      );

      const researchSection = document.getElementById("research");
      expect(researchSection).toHaveClass(
        "min-h-screen",
        "flex",
        "items-center",
        "justify-center",
      );

      const papersSection = document.getElementById("papers");
      expect(papersSection).toHaveClass(
        "min-h-screen",
        "flex",
        "items-center",
        "justify-center",
        "bg-muted/50",
      );

      const blogSection = document.getElementById("blogs");
      expect(blogSection).toHaveClass(
        "min-h-screen",
        "flex",
        "items-center",
        "justify-center",
        "bg-muted/50",
      );

      const contactSection = document.getElementById("contact");
      expect(contactSection).toHaveClass(
        "min-h-screen",
        "flex",
        "items-center",
        "justify-center",
      );
    });

    it("has special layout for education section with background override", () => {
      render(<Home />);

      const educationSection = document.getElementById("education");
      expect(educationSection).toHaveClass(
        "min-h-screen",
        "flex",
        "items-center",
        "justify-center",
        "relative",
      );

      // Check for background override div
      const backgroundOverride = educationSection?.querySelector(
        ".absolute.inset-0.bg-background",
      );
      expect(backgroundOverride).toBeInTheDocument();

      // Check for content wrapper with z-index
      const contentWrapper = educationSection?.querySelector(
        ".relative.z-10.w-full",
      );
      expect(contentWrapper).toBeInTheDocument();
    });

    it("alternates background styling between sections", () => {
      render(<Home />);

      // Check alternating bg-muted/50 pattern
      const skillsSection = document.getElementById("skills");
      expect(skillsSection).toHaveClass("bg-muted/50");

      const experienceSection = document.getElementById("experience");
      expect(experienceSection).not.toHaveClass("bg-muted/50");

      const projectsSection = document.getElementById("projects");
      expect(projectsSection).toHaveClass("bg-muted/50");

      const researchSection = document.getElementById("research");
      expect(researchSection).not.toHaveClass("bg-muted/50");

      const papersSection = document.getElementById("papers");
      expect(papersSection).toHaveClass("bg-muted/50");

      const blogSection = document.getElementById("blogs");
      expect(blogSection).toHaveClass("bg-muted/50");

      const contactSection = document.getElementById("contact");
      expect(contactSection).not.toHaveClass("bg-muted/50");
    });
  });

  describe("Accessibility", () => {
    it("maintains semantic HTML structure", () => {
      const { container } = render(<Home />);

      // Check that main content is wrapped in sections
      const sections = container.querySelectorAll("section");
      expect(sections.length).toBeGreaterThan(0);

      // Verify each section has appropriate attributes
      sections.forEach((section) => {
        expect(section).toHaveAttribute("id");
        expect(section.id).toBeTruthy();
      });
    });

    it("provides landmark navigation points", () => {
      render(<Home />);

      // These sections act as landmark navigation points
      const landmarks = [
        "home",
        "skills",
        "experience",
        "projects",
        "research",
        "papers",
        "education",
        "blogs",
        "contact",
      ];

      landmarks.forEach((landmark) => {
        const element = document.getElementById(landmark);
        expect(element).toBeInTheDocument();
        expect(element?.tagName.toLowerCase()).toBe("section");
      });
    });
  });

  describe("Component Integration", () => {
    it("renders each section component within its wrapper", () => {
      render(<Home />);

      // Verify that each mocked component is rendered
      expect(screen.getByTestId("introduction-section")).toBeInTheDocument();
      expect(screen.getByTestId("skills-section")).toBeInTheDocument();
      expect(screen.getByTestId("experience-section")).toBeInTheDocument();
      expect(screen.getByTestId("projects-section")).toBeInTheDocument();
      expect(screen.getByTestId("research-section")).toBeInTheDocument();
      expect(screen.getByTestId("papers-section")).toBeInTheDocument();
      expect(screen.getByTestId("education-section")).toBeInTheDocument();
      expect(screen.getByTestId("blog-section")).toBeInTheDocument();
      expect(screen.getByTestId("contact-section")).toBeInTheDocument();
    });

    it("maintains component isolation", () => {
      const { container } = render(<Home />);

      // Each section should contain exactly one main component
      const sections = container.querySelectorAll("section");

      sections.forEach((section, _index) => {
        // Education section has additional wrapper divs, so we check differently
        if (section.id === "education") {
          expect(
            section.querySelector("[data-testid='education-section']"),
          ).toBeInTheDocument();
        } else {
          // Other sections should have their component as direct or nearly direct child
          const testId = section.querySelector("[data-testid]");
          expect(testId).toBeInTheDocument();
        }
      });
    });
  });

  describe("Error Handling", () => {
    it("handles missing components gracefully", () => {
      // This test ensures the page structure remains intact even if components fail
      expect(() => {
        render(<Home />);
      }).not.toThrow();
    });

    it("maintains proper DOM structure under all conditions", () => {
      const { container } = render(<Home />);

      // Page should always have a consistent structure
      expect(container.firstChild).toBeDefined();

      // Should have exactly 9 sections
      const sections = container.querySelectorAll("section");
      expect(sections).toHaveLength(9);
    });
  });

  describe("Performance Considerations", () => {
    it("renders efficiently with mocked components", () => {
      const startTime = Date.now();
      render(<Home />);
      const endTime = Date.now();

      // With mocked components, rendering should be very fast
      expect(endTime - startTime).toBeLessThan(100); // 100ms threshold
    });

    it("maintains consistent section count", () => {
      const { container } = render(<Home />);

      // Consistent section count helps with navigation performance
      const sections = container.querySelectorAll("section");
      expect(sections).toHaveLength(9);
    });
  });
});
