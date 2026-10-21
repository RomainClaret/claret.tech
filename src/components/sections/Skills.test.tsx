import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { Skills } from "./Skills";
import { skillsSection as realSkills } from "@/data/sections/skills";
import type { skillsDetails as SkillsDetails } from "@/data/sections/skills-details";
import type {
  SlideInUpProps,
  ScaleInProps,
  HolographicCardProps,
  SkillManifestoProps,
  LanguageSpectrumProps,
  TechIconProps,
  LucideIconProps,
  MotionDivProps,
} from "@/test/mock-types";

// Mock external components and utilities
vi.mock("@/components/ui/animated", () => ({
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
  ArrowRight: (props: LucideIconProps) => (
    <div data-testid="arrow-right-icon" {...props} />
  ),
}));

// Mock Framer Motion
vi.mock("framer-motion", () => {
  // `m` is the slim motion API the app renders inside LazyMotion.
  const mocked = {
    motion: {
      div: ({ children, ...props }: MotionDivProps) => (
        <div {...props}>{children}</div>
      ),
    },
  };
  return { ...mocked, m: mocked.motion };
});

// Mock utilities
vi.mock("@/lib/utils", () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
}));

// The section's data for these tests. Hoisted so a test that imports the
// section afresh can register it again: tests before it mock other data
// with vi.doMock, which outlives them.
const { mockSkillsSection } = vi.hoisted(() => ({
  mockSkillsSection: {
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
        technologies: [
          { name: "Python", icon: "fas fa-code" },
          { name: "JAX", icon: "fas fa-bolt" },
          { name: "Neuroevolution", icon: "fas fa-dna" },
        ],
      },
      {
        icon: "🤖",
        title: "Machine Learning",
        description:
          "Creating intelligent systems using deep learning and reinforcement learning.",
        technologies: [
          { name: "PyTorch", icon: "fas fa-sliders" },
          { name: "Reinforcement Learning", icon: "fas fa-network-wired" },
          { name: "Deep Learning", icon: "fas fa-brain" },
        ],
      },
      {
        icon: "🔬",
        title: "Research & Teaching",
        description:
          "Conducting cutting-edge research and educating the next generation.",
        technologies: [
          { name: "Research", icon: "fas fa-puzzle-piece" },
          { name: "Teaching", icon: "fas fa-seedling" },
          { name: "Open-source", icon: "fas fa-sparkles" },
        ],
      },
    ],
    researchPhilosophySection: {
      title: "Research Philosophy",
      subtitle: "My approach to advancing artificial intelligence",
    },
    researchInterests: {
      "Current Focus": {
        description: "Short framing for current focus.",
        bullets: [
          "Neuroevolution algorithms",
          "Lifelong learning systems",
          "Embodied AI research",
        ],
      },
      "Why Evolution": {
        description: "Short framing for why evolution.",
        bullets: [
          "Natural optimization principles",
          "Adaptive system design",
          "Emergent intelligence",
        ],
      },
      "My Approach": {
        description: "Short framing for my approach.",
        bullets: [
          "Open-source development",
          "Reproducible research",
          "Practical applications",
        ],
      },
      Seeking: {
        description: "Short framing for seeking.",
        bullets: [
          "Industry collaborations",
          "Research partnerships",
          "PhD opportunities",
        ],
      },
    },
    languages: [
      { name: "English", proficiency: 95 },
      { name: "French", proficiency: 100 },
      { name: "German", proficiency: 70 },
    ],
  },
}));
vi.mock("@/data/portfolio", () => ({ skillsSection: mockSkillsSection }));

// The cards' long texts, which come with the dialog.
vi.mock("@/data/sections/skills-details", () => ({
  skillsDetails: {
    activities: {
      "Evolutionary Algorithms":
        "Developing novel evolutionary computation methods for AI optimization. This includes genetic algorithms, evolution strategies, and neuroevolution techniques applied to complex problem domains including robotics and artificial life.",
      "Machine Learning":
        "Creating intelligent systems using deep learning and reinforcement learning. Focus on multi-agent systems, embodied AI, and lifelong learning approaches for continuous adaptation.",
      "Research & Teaching":
        "Conducting cutting-edge research in artificial life and educating the next generation of AI researchers through mentoring and open-source contributions.",
    },
    philosophy: {
      "Current Focus": "Longer framing for current focus.",
      "Why Evolution": "Longer framing for why evolution.",
      "My Approach": "Longer framing for my approach.",
      Seeking: "Longer framing for seeking.",
    },
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

  describe("Card details", () => {
    // The 3 core activities, then the 4 philosophy cards.
    const cards = [
      "Evolutionary Algorithms",
      "Machine Learning",
      "Research & Teaching",
      "Current Focus",
      "Why Evolution",
      "My Approach",
      "Seeking",
    ];
    const cardOf = (title: string) =>
      screen
        .getByRole("button", { name: `Read more about ${title}` })
        .closest<HTMLElement>('[data-testid="holographic-card"]')!;

    it("opens each card's details in a dialog, from a real button", async () => {
      // The cards grew in place and pushed the page around; their details
      // open above the page now, outside the card, and closing gives the
      // focus back to the button.
      render(<Skills />);
      expect(
        screen.getAllByRole("button", { name: /^Read more about / }),
      ).toHaveLength(cards.length);

      for (const title of cards) {
        const button = screen.getByRole("button", {
          name: `Read more about ${title}`,
        });
        expect(button).toHaveAttribute("aria-haspopup", "dialog");
        expect(button).not.toHaveAttribute("aria-expanded");

        fireEvent.click(button);
        const dialog = await screen.findByRole("dialog", { name: title });
        expect(cardOf(title)).not.toContainElement(dialog);

        fireEvent.keyDown(document, { key: "Escape" });
        await waitFor(() => {
          expect(screen.queryByRole("dialog")).toBeNull();
        });
        expect(button).toHaveFocus();
      }
    });

    it("opens a card's details from a click anywhere on it", async () => {
      render(<Skills />);

      fireEvent.click(screen.getByText("Machine Learning"));

      expect(
        await screen.findByRole("dialog", { name: "Machine Learning" }),
      ).toBeInTheDocument();
    });

    it("shows an activity's story and its technologies in its dialog, not on the card", async () => {
      render(<Skills />);
      expect(cardOf("Evolutionary Algorithms")).not.toHaveTextContent(
        /This includes genetic algorithms/,
      );

      fireEvent.click(screen.getByText("Evolutionary Algorithms"));

      const dialog = await screen.findByRole("dialog", {
        name: "Evolutionary Algorithms",
      });
      expect(dialog).toHaveTextContent(
        /This includes genetic algorithms, evolution strategies/,
      );
      expect(dialog).toHaveTextContent("Core Activities");
      expect(
        within(dialog)
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ).toEqual(["Python", "JAX", "Neuroevolution"]);
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

    it("shows each card's key point and how many points it has", () => {
      render(<Skills />);

      for (const [category, first, second] of [
        [
          "Current Focus",
          "Neuroevolution algorithms",
          "Lifelong learning systems",
        ],
        [
          "Why Evolution",
          "Natural optimization principles",
          "Adaptive system design",
        ],
        ["My Approach", "Open-source development", "Reproducible research"],
        ["Seeking", "Industry collaborations", "Research partnerships"],
      ]) {
        const card = screen
          .getByRole("button", { name: `Read more about ${category}` })
          .closest('[data-testid="holographic-card"]')!;
        expect(card).toHaveTextContent(first);
        expect(card).not.toHaveTextContent(second);
        expect(card).toHaveTextContent("3 points");
      }
    });

    it("frames a card's points in its dialog, and lists them all", async () => {
      render(<Skills />);

      fireEvent.click(
        screen.getByRole("button", { name: "Read more about Current Focus" }),
      );

      const dialog = await screen.findByRole("dialog", {
        name: "Current Focus",
      });
      // The points are fragments without this: "Measuring it honestly" under
      // a bare "Current Focus" heading leaves the reader no referent for "it".
      expect(dialog).toHaveAccessibleDescription(
        "Short framing for current focus.",
      );
      expect(dialog).toHaveTextContent("Longer framing for current focus.");
      expect(dialog).toHaveTextContent("Research Philosophy");
      expect(
        within(dialog)
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ).toEqual([
        "Neuroevolution algorithms",
        "Lifelong learning systems",
        "Embodied AI research",
      ]);
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
    it("draws each technology with the icon its data names", () => {
      // The component kept its own map from names to icons, which matched
      // none of the real technologies after their renaming, while this test
      // passed on the old names it mocked. The icon now comes with each
      // technology (tech-icons.test.ts holds the real data to the map).
      render(<Skills />);

      for (const icon of [
        "fas fa-code",
        "fas fa-bolt",
        "fas fa-dna",
        "fas fa-sliders",
        "fas fa-network-wired",
        "fas fa-brain",
        "fas fa-puzzle-piece",
        "fas fa-seedling",
        "fas fa-sparkles",
      ]) {
        expect(screen.getByTestId(`tech-icon-${icon}`)).toBeInTheDocument();
      }
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

  describe("Long texts", () => {
    // skills-details.ts comes with the details dialog's code, out of the
    // page's first JavaScript: none of it is on the page until a dialog
    // opens.
    it("has every card's long text, by its title or category, and no other", async () => {
      const { skillsDetails } = await vi.importActual<{
        skillsDetails: typeof SkillsDetails;
      }>("@/data/sections/skills-details");

      expect(Object.keys(skillsDetails.activities).sort()).toEqual(
        realSkills.coreActivities.map((activity) => activity.title).sort(),
      );
      expect(Object.keys(skillsDetails.philosophy).sort()).toEqual(
        Object.keys(realSkills.researchInterests).sort(),
      );
    });
  });

  describe("A card's details whose code cannot load", () => {
    afterEach(() => {
      vi.doUnmock("./SkillDetailsDialog");
      vi.resetModules();
    });

    it("says so with the card's own text, and gives the focus back", async () => {
      const imports = { count: 0 };
      vi.resetModules();
      vi.doMock("@/data/portfolio", () => ({
        skillsSection: mockSkillsSection,
      }));
      vi.doMock("./SkillDetailsDialog", () => {
        imports.count++;
        throw new Error("chunk failed");
      });
      const { Skills: Fresh } = await import("./Skills");
      render(<Fresh />);
      const button = screen.getByRole("button", {
        name: "Read more about Why Evolution",
      });

      // Pointing at a card starts fetching its details' code.
      fireEvent.pointerEnter(
        button.closest('[data-testid="holographic-card"]')!,
      );
      await waitFor(() => expect(imports.count).toBe(1));

      fireEvent.click(button);
      const dialog = await screen.findByRole("dialog", {
        name: "Why Evolution",
      });
      expect(dialog).toHaveTextContent("Short framing for why evolution.");
      expect(dialog).toHaveTextContent("Could not load the details.");

      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(button).toHaveFocus();
    });
  });
});
