import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { Skills } from "./Skills";
import type {
  FadeInProps,
  SlideInUpProps,
  ScaleInProps,
  HolographicCardProps,
  SkillManifestoProps,
  LanguageSpectrumProps,
  ProtectedLucideIconProps,
  TechIconProps,
  LucideIconProps,
  MotionDivProps,
} from "@/test/mock-types";

// Mock external components and utilities
vi.mock("@/components/ui/animated", () => ({
  FadeIn: ({ children, ...props }: FadeInProps) => (
    <div data-testid="fade-in" {...props}>
      {children}
    </div>
  ),
  SlideInUp: ({ children, ...props }: SlideInUpProps) => (
    <div data-testid="slide-in-up" {...props}>
      {children}
    </div>
  ),
  ScaleIn: ({ children, ...props }: ScaleInProps) => (
    <div data-testid="scale-in" {...props}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/holographic-card", () => ({
  HolographicCard: ({ children, ...props }: HolographicCardProps) => (
    <div data-testid="holographic-card" {...props}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/skill-manifesto", () => ({
  SkillManifesto: ({ skills, autoPlayDelay }: SkillManifestoProps) => (
    <div data-testid="skill-manifesto" data-auto-play-delay={autoPlayDelay}>
      {skills?.join(", ") || ""}
    </div>
  ),
}));

vi.mock("@/components/ui/language-spectrum", () => ({
  LanguageSpectrum: ({ languages }: LanguageSpectrumProps) => (
    <div data-testid="language-spectrum">
      {languages?.map((lang) => (
        <div key={lang.name} data-testid={`language-${lang.name}`}>
          {lang.name} - {lang.proficiency}%
        </div>
      )) || null}
    </div>
  ),
}));

vi.mock("@/components/ui/protected-lucide-icon", () => ({
  ProtectedLucideIcon: ({ Icon, ...props }: ProtectedLucideIconProps) => {
    if (!Icon) return <div data-testid="protected-icon" {...props} />;
    // Forward the Icon component with its original testid
    return <Icon {...props} />;
  },
}));

// Mock icons
vi.mock("@/components/icons", () => ({
  getTechIcon:
    (iconClass: string) =>
    ({ _size, className, style }: TechIconProps) => (
      <div
        data-testid={`tech-icon-${iconClass}`}
        className={className}
        style={style}
      >
        {iconClass}
      </div>
    ),
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  Microscope: (props: LucideIconProps) => (
    <div data-testid="microscope-icon" {...props} />
  ),
  Cpu: (props: LucideIconProps) => <div data-testid="cpu-icon" {...props} />,
  Lightbulb: (props: LucideIconProps) => (
    <div data-testid="lightbulb-icon" {...props} />
  ),
  Brain: (props: LucideIconProps) => (
    <div data-testid="brain-icon" {...props} />
  ),
  ChevronDown: (props: LucideIconProps) => (
    <div data-testid="chevron-down-icon" {...props} />
  ),
}));

// Mock Framer Motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: MotionDivProps) => (
      <div {...props}>{children}</div>
    ),
  },
}));

// Mock utilities
vi.mock("@/lib/utils", () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/data/portfolio", () => ({
  skillsSection: {
    display: true,
    title: "Skills & Expertise",
    subtitle: {
      highlightedText: "Core competencies",
      normalText: " in artificial intelligence and research",
    },
    skills: ["Machine Learning", "Python", "Research", "Teaching"],
    coreExpertiseSection: {
      title: "Core Activities",
    },
    coreActivities: [
      {
        icon: "🧬",
        title: "Evolutionary Algorithms",
        description:
          "Developing novel evolutionary computation methods for AI optimization.",
        expandedDescription:
          "Developing novel evolutionary computation methods for AI optimization. This includes genetic algorithms, evolution strategies, and neuroevolution techniques applied to complex problem domains including robotics and artificial life.",
        technologies: ["Python", "JAX", "Neuroevolution"],
      },
      {
        icon: "🤖",
        title: "Machine Learning",
        description:
          "Creating intelligent systems using deep learning and reinforcement learning.",
        expandedDescription:
          "Creating intelligent systems using deep learning and reinforcement learning. Focus on multi-agent systems, embodied AI, and lifelong learning approaches for continuous adaptation.",
        technologies: ["PyTorch", "Reinforcement Learning", "Deep Learning"],
      },
      {
        icon: "🔬",
        title: "Research & Teaching",
        description:
          "Conducting cutting-edge research and educating the next generation.",
        expandedDescription:
          "Conducting cutting-edge research in artificial life and educating the next generation of AI researchers through mentoring and open-source contributions.",
        technologies: ["Research", "Teaching", "Open-source"],
      },
    ],
    researchPhilosophySection: {
      title: "Research Philosophy",
      subtitle: "My approach to advancing artificial intelligence",
    },
    researchInterests: {
      "Current Focus": [
        "Neuroevolution algorithms",
        "Lifelong learning systems",
        "Embodied AI research",
      ],
      "Why Evolution": [
        "Natural optimization principles",
        "Adaptive system design",
        "Emergent intelligence",
      ],
      "My Approach": [
        "Open-source development",
        "Reproducible research",
        "Practical applications",
      ],
      Seeking: [
        "Industry collaborations",
        "Research partnerships",
        "PhD opportunities",
      ],
    },
    languages: [
      { name: "English", proficiency: 95 },
      { name: "French", proficiency: 100 },
      { name: "German", proficiency: 70 },
    ],
  },
}));

describe("Skills Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders skills section when display is enabled", () => {
      render(<Skills />);

      expect(screen.getByText("Skills & Expertise")).toBeInTheDocument();
      expect(screen.getByText("Core competencies")).toBeInTheDocument();
      expect(
        screen.getByText(/in artificial intelligence and research/),
      ).toBeInTheDocument();
    });

    it("does not render when display is disabled", async () => {
      // Test with a component that has display disabled
      vi.resetModules();
      vi.doMock("@/data/portfolio", () => ({
        skillsSection: { display: false },
      }));

      const { Skills: TestSkills } = await import("./Skills");
      const { container } = render(<TestSkills />);

      expect(container.firstChild).toBeNull();
    });

    it("renders core activities section", () => {
      render(<Skills />);

      expect(screen.getByText("Core Activities")).toBeInTheDocument();
      expect(screen.getByText("Evolutionary Algorithms")).toBeInTheDocument();
      expect(screen.getByText("Machine Learning")).toBeInTheDocument();
      expect(screen.getByText("Research & Teaching")).toBeInTheDocument();
    });

    it("renders research philosophy section", () => {
      render(<Skills />);

      expect(screen.getByText("Research Philosophy")).toBeInTheDocument();
      expect(
        screen.getByText(/My approach to advancing artificial intelligence/),
      ).toBeInTheDocument();
    });
  });

  describe("Skill Manifesto", () => {
    it("renders skill manifesto with skills", () => {
      render(<Skills />);

      const manifesto = screen.getByTestId("skill-manifesto");
      expect(manifesto).toBeInTheDocument();
      expect(manifesto).toHaveAttribute("data-auto-play-delay", "6000");
      expect(manifesto).toHaveTextContent(
        "Machine Learning, Python, Research, Teaching",
      );
    });

    it("does not render skill manifesto when skills are empty", async () => {
      // Test with empty skills array
      vi.resetModules();
      vi.doMock("@/data/portfolio", () => ({
        skillsSection: {
          display: true,
          title: "Skills & Expertise",
          subtitle: {
            highlightedText: "Core competencies",
            normalText: " in artificial intelligence",
          },
          skills: [],
          coreExpertiseSection: { title: "Core Activities" },
          coreActivities: [],
          researchPhilosophySection: { title: "Research", subtitle: "Test" },
          researchInterests: {},
        },
      }));

      const { Skills: TestSkills } = await import("./Skills");
      render(<TestSkills />);

      expect(screen.queryByTestId("skill-manifesto")).not.toBeInTheDocument();
    });
  });

  describe("Core Activities", () => {
    it("renders all core activity cards", () => {
      render(<Skills />);

      // Check all activity titles
      expect(screen.getByText("Evolutionary Algorithms")).toBeInTheDocument();
      expect(screen.getByText("Machine Learning")).toBeInTheDocument();
      expect(screen.getByText("Research & Teaching")).toBeInTheDocument();

      // Check descriptions
      expect(
        screen.getByText(/Developing novel evolutionary computation methods/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Creating intelligent systems using deep learning/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Conducting cutting-edge research/),
      ).toBeInTheDocument();
    });

    it("renders activity icons correctly", () => {
      render(<Skills />);

      expect(screen.getByTestId("microscope-icon")).toBeInTheDocument();
      expect(screen.getByTestId("cpu-icon")).toBeInTheDocument();
      expect(screen.getByTestId("lightbulb-icon")).toBeInTheDocument();
    });

    it("renders technology badges for each activity", () => {
      render(<Skills />);

      // Check first activity technologies
      expect(screen.getByText("Python")).toBeInTheDocument();
      expect(screen.getByText("JAX")).toBeInTheDocument();
      expect(screen.getByText("Neuroevolution")).toBeInTheDocument();

      // Check second activity technologies
      expect(screen.getByText("PyTorch")).toBeInTheDocument();
      expect(screen.getByText("Reinforcement Learning")).toBeInTheDocument();
      expect(screen.getByText("Deep Learning")).toBeInTheDocument();

      // Check third activity technologies
      expect(screen.getByText("Research")).toBeInTheDocument();
      expect(screen.getByText("Teaching")).toBeInTheDocument();
      expect(screen.getByText("Open-source")).toBeInTheDocument();
    });
  });

  describe("Expandable Descriptions", () => {
    it("shows read more buttons initially", () => {
      render(<Skills />);

      const readMoreButtons = screen.getAllByText("Read more");
      expect(readMoreButtons).toHaveLength(3);
    });

    it("expands activity description when read more is clicked", () => {
      render(<Skills />);

      const firstReadMore = screen.getAllByText("Read more")[0];
      fireEvent.click(firstReadMore);

      expect(
        screen.getByText(
          /This includes genetic algorithms, evolution strategies/,
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("Show less")).toBeInTheDocument();
    });

    it("collapses expanded description when show less is clicked", () => {
      render(<Skills />);

      // Expand first activity
      const firstReadMore = screen.getAllByText("Read more")[0];
      fireEvent.click(firstReadMore);

      // Then collapse it
      const showLess = screen.getByText("Show less");
      fireEvent.click(showLess);

      expect(
        screen.queryByText(
          /This includes genetic algorithms, evolution strategies/,
        ),
      ).not.toBeInTheDocument();
      expect(screen.getAllByText("Read more")).toHaveLength(3);
    });

    it("only expands one activity at a time", () => {
      render(<Skills />);

      // Expand first activity
      const readMoreButtons = screen.getAllByText("Read more");
      fireEvent.click(readMoreButtons[0]);

      expect(screen.getByText("Show less")).toBeInTheDocument();

      // Expand second activity (should collapse first)
      fireEvent.click(readMoreButtons[1]);

      expect(
        screen.getByText(/Focus on multi-agent systems/),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/This includes genetic algorithms/),
      ).not.toBeInTheDocument();
    });

    it("renders chevron icons that rotate when expanded", () => {
      render(<Skills />);

      const chevronIcons = screen.getAllByTestId("chevron-down-icon");
      expect(chevronIcons).toHaveLength(3);

      // Click to expand and check for rotation class
      const firstReadMore = screen.getAllByText("Read more")[0];
      fireEvent.click(firstReadMore);

      // Chevron should have rotation class (tested via className)
      expect(chevronIcons[0]).toHaveClass("rotate-180");
    });
  });

  describe("Research Interests", () => {
    it("renders all research interest categories", () => {
      render(<Skills />);

      expect(screen.getByText("Current Focus")).toBeInTheDocument();
      expect(screen.getByText("Why Evolution")).toBeInTheDocument();
      expect(screen.getByText("My Approach")).toBeInTheDocument();
      expect(screen.getByText("Seeking")).toBeInTheDocument();
    });

    it("renders research interest items for each category", () => {
      render(<Skills />);

      // Current Focus
      expect(screen.getByText("Neuroevolution algorithms")).toBeInTheDocument();
      expect(screen.getByText("Lifelong learning systems")).toBeInTheDocument();
      expect(screen.getByText("Embodied AI research")).toBeInTheDocument();

      // Why Evolution
      expect(
        screen.getByText("Natural optimization principles"),
      ).toBeInTheDocument();
      expect(screen.getByText("Adaptive system design")).toBeInTheDocument();
      expect(screen.getByText("Emergent intelligence")).toBeInTheDocument();

      // My Approach
      expect(screen.getByText("Open-source development")).toBeInTheDocument();
      expect(screen.getByText("Reproducible research")).toBeInTheDocument();
      expect(screen.getByText("Practical applications")).toBeInTheDocument();

      // Seeking
      expect(screen.getByText("Industry collaborations")).toBeInTheDocument();
      expect(screen.getByText("Research partnerships")).toBeInTheDocument();
      expect(screen.getByText("PhD opportunities")).toBeInTheDocument();
    });

    it("renders brain icons for research categories", () => {
      render(<Skills />);

      const brainIcons = screen.getAllByTestId("brain-icon");
      expect(brainIcons).toHaveLength(4); // One for each category
    });
  });

  describe("Language Spectrum", () => {
    it("renders language spectrum when languages are provided", () => {
      render(<Skills />);

      expect(screen.getByTestId("language-spectrum")).toBeInTheDocument();
      expect(screen.getByTestId("language-English")).toBeInTheDocument();
      expect(screen.getByTestId("language-French")).toBeInTheDocument();
      expect(screen.getByTestId("language-German")).toBeInTheDocument();
    });

    it("displays language proficiency percentages", () => {
      render(<Skills />);

      expect(screen.getByText("English - 95%")).toBeInTheDocument();
      expect(screen.getByText("French - 100%")).toBeInTheDocument();
      expect(screen.getByText("German - 70%")).toBeInTheDocument();
    });

    it("does not render language spectrum when languages are not provided", async () => {
      // Test with empty languages array
      vi.resetModules();
      vi.doMock("@/data/portfolio", () => ({
        skillsSection: {
          display: true,
          title: "Skills & Expertise",
          subtitle: {
            highlightedText: "Core competencies",
            normalText: " in artificial intelligence",
          },
          coreExpertiseSection: { title: "Core Activities" },
          coreActivities: [],
          researchPhilosophySection: { title: "Research", subtitle: "Test" },
          researchInterests: {},
          languages: [],
        },
      }));

      const { Skills: TestSkills } = await import("./Skills");
      render(<TestSkills />);

      expect(screen.queryByTestId("language-spectrum")).not.toBeInTheDocument();
    });
  });

  describe("Animation Components", () => {
    it("wraps content in animation components", () => {
      render(<Skills />);

      expect(screen.getAllByTestId("fade-in")).toHaveLength(1);
      expect(screen.getAllByTestId("slide-in-up").length).toBeGreaterThan(1);
      expect(screen.getAllByTestId("scale-in").length).toBeGreaterThan(1);
    });

    it("renders holographic cards for activities and research interests", () => {
      render(<Skills />);

      const holographicCards = screen.getAllByTestId("holographic-card");
      expect(holographicCards.length).toBeGreaterThan(6); // 3 activities + 4 research categories
    });
  });

  describe("Technology Icons", () => {
    it("renders tech icons with correct mappings", () => {
      render(<Skills />);

      // Check for various tech icon mappings
      expect(screen.getByTestId("tech-icon-fab fa-python")).toBeInTheDocument();
      expect(screen.getByTestId("tech-icon-fas fa-zap")).toBeInTheDocument(); // JAX
      expect(screen.getByTestId("tech-icon-fas fa-fire")).toBeInTheDocument(); // PyTorch
    });

    it("falls back to default icon for unmapped technologies", async () => {
      // Test with unmapped technology
      vi.resetModules();
      vi.doMock("@/data/portfolio", () => ({
        skillsSection: {
          display: true,
          title: "Skills & Expertise",
          subtitle: {
            highlightedText: "Core competencies",
            normalText: " in artificial intelligence",
          },
          coreExpertiseSection: { title: "Core Activities" },
          coreActivities: [
            {
              icon: "🧬",
              title: "Test Activity",
              description: "Test description",
              expandedDescription: "Expanded description",
              technologies: ["UnknownTech"],
            },
          ],
          researchPhilosophySection: { title: "Research", subtitle: "Test" },
          researchInterests: {},
        },
      }));

      const { Skills: TestSkills } = await import("./Skills");
      render(<TestSkills />);

      expect(screen.getByTestId("tech-icon-fas fa-code")).toBeInTheDocument();
    });
  });

  describe("Conditional Rendering", () => {
    it("handles missing skills gracefully", async () => {
      // Test with undefined skills
      vi.resetModules();
      vi.doMock("@/data/portfolio", () => ({
        skillsSection: {
          display: true,
          title: "Skills & Expertise",
          subtitle: {
            highlightedText: "Core competencies",
            normalText: " in artificial intelligence",
          },
          coreExpertiseSection: { title: "Core Activities" },
          coreActivities: [],
          researchPhilosophySection: { title: "Research", subtitle: "Test" },
          researchInterests: {},
          // skills property undefined
        },
      }));

      const { Skills: TestSkills } = await import("./Skills");
      render(<TestSkills />);

      expect(screen.queryByTestId("skill-manifesto")).not.toBeInTheDocument();
    });

    it("handles missing languages gracefully", async () => {
      // Test with undefined languages
      vi.resetModules();
      vi.doMock("@/data/portfolio", () => ({
        skillsSection: {
          display: true,
          title: "Skills & Expertise",
          subtitle: {
            highlightedText: "Core competencies",
            normalText: " in artificial intelligence",
          },
          coreExpertiseSection: { title: "Core Activities" },
          coreActivities: [],
          researchPhilosophySection: { title: "Research", subtitle: "Test" },
          researchInterests: {},
          // languages property undefined
        },
      }));

      const { Skills: TestSkills } = await import("./Skills");
      render(<TestSkills />);

      expect(screen.queryByTestId("language-spectrum")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper semantic structure", () => {
      render(<Skills />);

      // Check for proper heading hierarchy
      expect(
        screen.getByRole("heading", { name: "Skills & Expertise" }),
      ).toBeInTheDocument();

      // Clickable elements should be buttons
      const readMoreButtons = screen.getAllByText("Read more");
      readMoreButtons.forEach((button) => {
        expect(button.closest("button")).toBeInTheDocument();
      });
    });
  });

  describe("Interactive Elements", () => {
    it("handles click events on expandable descriptions", async () => {
      render(<Skills />);

      const readMoreButton = screen.getAllByText("Read more")[0];
      expect(readMoreButton).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(readMoreButton);
      });

      await waitFor(() => {
        expect(screen.getByText("Show less")).toBeInTheDocument();
      });
    });
  });
});
