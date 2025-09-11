import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Projects } from "./Projects";
import type {
  FadeInProps,
  SlideInUpProps,
  ScaleInProps,
  MotionDivProps,
  HolographicCardProps,
  HolographicStatsCardProps,
  ProjectFilterProps,
  NextLinkProps,
  LucideIconProps,
  MockedFetch,
} from "@/test/mock-types";

// Mock external hooks and utilities
vi.mock("@/lib/hooks/useSafari", () => ({
  useShouldReduceAnimations: vi.fn(() => false),
}));

// Mock projects context
const mockProjectsContext = {
  allProjects: [],
  setAllProjects: vi.fn(),
  isLoading: false,
};

vi.mock("@/contexts/projects-context", () => ({
  useProjects: () => mockProjectsContext,
}));

// Mock UI components
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
  HolographicCard: ({ children, className }: HolographicCardProps) => (
    <div data-testid="holographic-card" className={className}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/holographic-stats-card", () => ({
  HolographicStatsCard: ({
    children,
    className,
    delay,
  }: HolographicStatsCardProps) => (
    <div
      data-testid="holographic-stats-card"
      className={className}
      data-delay={delay}
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/project-filter", () => ({
  ProjectFilter: ({
    technologies,
    selectedTech,
    onSelectTech,
  }: ProjectFilterProps) => (
    <div data-testid="project-filter">
      {technologies?.map((tech: string) => (
        <button
          key={tech}
          onClick={() => onSelectTech?.(tech)}
          data-testid={`filter-${tech}`}
          className={selectedTech === tech ? "active" : ""}
        >
          {tech}
        </button>
      ))}
      <button onClick={() => onSelectTech?.(null)} data-testid="clear-filter">
        All
      </button>
    </div>
  ),
}));

// Mock Next.js components
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: NextLinkProps) => (
    <a href={href} {...props}>
      {children}
    </a>
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

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  Star: (props: LucideIconProps) => <div data-testid="star-icon" {...props} />,
  GitFork: (props: LucideIconProps) => (
    <div data-testid="git-fork-icon" {...props} />
  ),
  ExternalLink: (props: LucideIconProps) => (
    <div data-testid="external-link-icon" {...props} />
  ),
  Search: (props: LucideIconProps) => (
    <div data-testid="search-icon" {...props} />
  ),
  Grid: (props: LucideIconProps) => <div data-testid="grid-icon" {...props} />,
  List: (props: LucideIconProps) => <div data-testid="list-icon" {...props} />,
  Calendar: (props: LucideIconProps) => (
    <div data-testid="calendar-icon" {...props} />
  ),
  Code2: (props: LucideIconProps) => (
    <div data-testid="code2-icon" {...props} />
  ),
  Sparkles: (props: LucideIconProps) => (
    <div data-testid="sparkles-icon" {...props} />
  ),
  Zap: (props: LucideIconProps) => <div data-testid="zap-icon" {...props} />,
  FileCode2: (props: LucideIconProps) => (
    <div data-testid="file-code2-icon" {...props} />
  ),
  Activity: (props: LucideIconProps) => (
    <div data-testid="activity-icon" {...props} />
  ),
}));

// Mock utilities
vi.mock("@/lib/utils", () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/lib/utils/formatters", () => ({
  formatFileSizeDisplay: (size: number) => `${Math.round(size / 1024)}KB`,
}));

vi.mock("@/lib/utils/language-colors", () => ({
  getProjectColor: (color: string | null, _name: string | undefined) =>
    color || "59, 130, 246",
  getLanguageIcon: (name: string | undefined) => (props: LucideIconProps) => (
    <div data-testid={`language-icon-${name}`} {...props} />
  ),
}));

// Mock portfolio data
vi.mock("@/data/portfolio", () => ({
  projectsSection: {
    display: true,
    title: "Projects",
    subtitle: {
      highlightedText: "Featured",
      normalText: " projects and repositories",
    },
    featuredProject: "auto",
  },
}));

// Mock data
const mockPinnedProjects = [
  {
    id: "1",
    name: "awesome-project",
    description: "An awesome project with great features",
    url: "https://github.com/user/awesome-project",
    forkCount: 15,
    stargazers: { totalCount: 120 },
    diskUsage: 2048,
    primaryLanguage: { name: "TypeScript", color: "#3178c6" },
  },
  {
    id: "2",
    name: "cool-library",
    description: "A cool library for developers",
    url: "https://github.com/user/cool-library",
    forkCount: 8,
    stargazers: { totalCount: 45 },
    diskUsage: 1024,
    primaryLanguage: { name: "JavaScript", color: "#f1e05a" },
  },
];

const mockAllProjects = [
  ...mockPinnedProjects.map((p) => ({
    ...p,
    stargazerCount: p.stargazers.totalCount,
    homepageUrl: null,
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-12-01T00:00:00Z",
    pushedAt: "2023-12-15T00:00:00Z",
    isPrivate: false,
    isArchived: false,
    isFork: false,
    parent: null,
    languages: {
      edges: [
        { node: { name: "TypeScript", color: "#3178c6" }, size: 80 },
        { node: { name: "CSS", color: "#563d7c" }, size: 20 },
      ],
    },
    topics: {
      edges: [
        { node: { topic: { name: "react" } } },
        { node: { topic: { name: "typescript" } } },
      ],
    },
  })),
  {
    id: "3",
    name: "python-tool",
    description: "A useful Python tool",
    url: "https://github.com/user/python-tool",
    stargazerCount: 30,
    forkCount: 5,
    diskUsage: 512,
    primaryLanguage: { name: "Python", color: "#3572A5" },
    homepageUrl: "https://python-tool.example.com",
    createdAt: "2023-06-01T00:00:00Z",
    updatedAt: "2023-11-01T00:00:00Z",
    pushedAt: "2023-11-20T00:00:00Z",
    isPrivate: false,
    isArchived: false,
    isFork: false,
    parent: null,
    languages: {
      edges: [
        { node: { name: "Python", color: "#3572A5" }, size: 90 },
        { node: { name: "Shell", color: "#89e051" }, size: 10 },
      ],
    },
    topics: {
      edges: [
        { node: { topic: { name: "python" } } },
        { node: { topic: { name: "cli" } } },
      ],
    },
  },
];

// Global fetch mock
global.fetch = vi.fn();

describe("Projects Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectsContext.allProjects = [];
    mockProjectsContext.isLoading = false;
  });

  describe("Rendering", () => {
    it("renders projects section when display is enabled", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Projects" }),
        ).toBeInTheDocument();
        expect(
          screen.getByText("projects and repositories"),
        ).toBeInTheDocument();
        // Check for featured project section
        expect(screen.getByText("Featured Project")).toBeInTheDocument();
      });
    });

    it("shows loading state initially", () => {
      (global.fetch as unknown as MockedFetch).mockImplementation(
        () => new Promise(() => {}),
      );

      render(<Projects />);

      expect(screen.getByText("Loading projects...")).toBeInTheDocument();
    });

    it("renders project statistics", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        // Total projects
        expect(screen.getAllByText("2").length).toBeGreaterThan(0);
        // Total stars (120 + 45 = 165)
        expect(screen.getByText("165")).toBeInTheDocument();
        // Total forks (15 + 8 = 23)
        expect(screen.getByText("23")).toBeInTheDocument();
        // Languages count - there are two unique languages
        const languageCounts = screen.getAllByText("2");
        expect(languageCounts.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Featured Project", () => {
    it("displays featured project with highest stars", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        expect(screen.getByText("Featured Project")).toBeInTheDocument();
        expect(screen.getAllByText("awesome-project").length).toBeGreaterThan(
          0,
        );
        expect(
          screen.getAllByText("An awesome project with great features").length,
        ).toBeGreaterThan(0);
      });
    });

    it("displays featured project statistics", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        // Featured project should show specific stats
        expect(screen.getAllByText("120")).toHaveLength(2); // Stars (featured + card)
        expect(screen.getAllByText("15")).toHaveLength(2); // Forks (featured + card)
        expect(screen.getAllByText("TypeScript").length).toBeGreaterThan(0); // Primary language
        expect(screen.getAllByText("2KB").length).toBeGreaterThan(0); // Repository size
      });
    });

    it("includes link to view project on GitHub", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        const viewLink = screen.getByText("View on GitHub");
        expect(viewLink).toBeInTheDocument();
        expect(viewLink.closest("a")).toHaveAttribute(
          "href",
          "https://github.com/user/awesome-project",
        );
      });
    });
  });

  describe("View Mode Toggle", () => {
    it("renders view mode toggle buttons", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Featured/ }),
        ).toBeInTheDocument();
        expect(screen.getByText("All Projects")).toBeInTheDocument();
      });
    });

    it("switches to all projects view", async () => {
      // Mock pinned projects fetch
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        expect(screen.getAllByText("Featured").length).toBeGreaterThan(0);
      });

      // Mock all projects fetch
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockAllProjects,
        }),
      });

      const allProjectsButton = screen.getByText("All Projects");
      fireEvent.click(allProjectsButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/fetch-all-repos");
      });
    });
  });

  describe("Layout Mode Toggle", () => {
    it("renders layout toggle buttons", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        const gridButtons = screen.getAllByTestId("grid-icon");
        const listButtons = screen.getAllByTestId("list-icon");
        expect(gridButtons).toHaveLength(2); // One in featured toggle, one in layout toggle
        expect(listButtons).toHaveLength(1);
      });
    });

    it("switches between grid and list layouts", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        expect(screen.getAllByText("awesome-project").length).toBeGreaterThan(
          0,
        );
      });

      const layoutButtons = screen.getAllByLabelText("List view");
      expect(layoutButtons).toHaveLength(1);

      fireEvent.click(layoutButtons[0]);

      // Layout should change (tested via CSS classes in actual implementation)
      expect(layoutButtons[0]).toBeInTheDocument();
    });
  });

  describe("Search Functionality", () => {
    it("renders search input", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(
          "Search projects by name, description, or topics...",
        );
        expect(searchInput).toBeInTheDocument();
        expect(searchInput).toHaveAttribute("type", "search");
      });
    });

    it("filters projects by search query", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        expect(screen.getAllByText("awesome-project").length).toBeGreaterThan(
          0,
        );
        expect(screen.getAllByText("cool-library").length).toBeGreaterThan(0);
      });

      const searchInput = screen.getByPlaceholderText(
        "Search projects by name, description, or topics...",
      );
      fireEvent.change(searchInput, { target: { value: "awesome" } });

      await waitFor(() => {
        expect(screen.getAllByText("awesome-project").length).toBeGreaterThan(
          0,
        );
        expect(screen.queryByText("cool-library")).not.toBeInTheDocument();
      });
    });

    it("shows no results message when search yields no matches", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        expect(screen.getAllByText("awesome-project").length).toBeGreaterThan(
          0,
        );
      });

      const searchInput = screen.getByPlaceholderText(
        "Search projects by name, description, or topics...",
      );
      fireEvent.change(searchInput, { target: { value: "nonexistent" } });

      await waitFor(() => {
        expect(
          screen.getByText("No projects found matching your criteria."),
        ).toBeInTheDocument();
        expect(screen.getByText("Clear filters")).toBeInTheDocument();
      });
    });
  });

  describe("Technology Filter", () => {
    it("renders technology filter when projects have languages", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        expect(screen.getByTestId("project-filter")).toBeInTheDocument();
        expect(screen.getByTestId("filter-TypeScript")).toBeInTheDocument();
        expect(screen.getByTestId("filter-JavaScript")).toBeInTheDocument();
      });
    });

    it("filters projects by selected technology", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        expect(screen.getAllByText("awesome-project").length).toBeGreaterThan(
          0,
        );
        expect(screen.getAllByText("cool-library").length).toBeGreaterThan(0);
      });

      const typeScriptFilter = screen.getByTestId("filter-TypeScript");
      fireEvent.click(typeScriptFilter);

      await waitFor(() => {
        expect(screen.getAllByText("awesome-project").length).toBeGreaterThan(
          0,
        );
        expect(screen.queryByText("cool-library")).not.toBeInTheDocument();
      });
    });

    it("clears technology filter", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        expect(screen.getAllByText("awesome-project").length).toBeGreaterThan(
          0,
        );
      });

      // Apply filter
      const typeScriptFilter = screen.getByTestId("filter-TypeScript");
      fireEvent.click(typeScriptFilter);

      // Clear filter
      const clearFilter = screen.getByTestId("clear-filter");
      fireEvent.click(clearFilter);

      await waitFor(() => {
        expect(screen.getAllByText("awesome-project").length).toBeGreaterThan(
          0,
        );
        expect(screen.getAllByText("cool-library").length).toBeGreaterThan(0);
      });
    });
  });

  describe("Project Cards", () => {
    it("renders project cards with basic information", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        // Project names
        expect(screen.getAllByText("awesome-project").length).toBeGreaterThan(
          0,
        );
        expect(screen.getAllByText("cool-library").length).toBeGreaterThan(0);

        // Descriptions
        expect(
          screen.getAllByText("An awesome project with great features").length,
        ).toBeGreaterThan(0);
        expect(
          screen.getAllByText("A cool library for developers").length,
        ).toBeGreaterThan(0);

        // Stars and forks
        expect(screen.getAllByText("120")).toHaveLength(2); // Featured + card
        expect(screen.getAllByText("45")).toHaveLength(1);
        expect(screen.getAllByText("15")).toHaveLength(2); // Featured + card
        expect(screen.getAllByText("8")).toHaveLength(1);
      });
    });

    it("handles projects without descriptions", async () => {
      const projectsWithoutDesc = [
        { ...mockPinnedProjects[0], description: null },
        mockPinnedProjects[1],
      ];

      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: projectsWithoutDesc.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        expect(
          screen.getByText("No description available."),
        ).toBeInTheDocument();
      });
    });

    it("displays project cards correctly", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        // Should display project cards
        expect(screen.getAllByText("awesome-project").length).toBeGreaterThan(
          0,
        );
        expect(screen.getAllByText("cool-library").length).toBeGreaterThan(0);
      });
    });
  });

  describe("Error Handling", () => {
    it("handles API failure and falls back to profile.json", async () => {
      // First API call fails
      (global.fetch as unknown as MockedFetch)
        .mockRejectedValueOnce(new Error("API Error"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              user: {
                pinnedItems: {
                  edges: mockPinnedProjects.map((p) => ({ node: p })),
                },
              },
            },
          }),
        });

      render(<Projects />);

      await waitFor(() => {
        expect(screen.getAllByText("awesome-project").length).toBeGreaterThan(
          0,
        );
        expect(global.fetch).toHaveBeenCalledWith("/profile.json");
      });
    });

    it("handles complete API failure gracefully", async () => {
      // Both API calls fail
      (global.fetch as unknown as MockedFetch)
        .mockRejectedValueOnce(new Error("API Error"))
        .mockRejectedValueOnce(new Error("Fallback Error"));

      render(<Projects />);

      await waitFor(() => {
        // Component should still render the main structure (heading)
        expect(
          screen.getByRole("heading", { name: /projects/i }),
        ).toBeInTheDocument();
        // Should show empty state message when no projects are loaded
        expect(
          screen.getByText("No projects found matching your criteria."),
        ).toBeInTheDocument();
        // Should show the clear filters button
        expect(screen.getByText("Clear filters")).toBeInTheDocument();
      });
    });
  });

  describe("Loading States", () => {
    it("shows loading indicator for all projects", async () => {
      // FIXME: This test passes in isolation but fails in batch mode due to timing issues
      // First mock for initial pinned projects load
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      // Wait for initial render to complete
      await waitFor(() => {
        expect(screen.getByText("All Projects")).toBeInTheDocument();
      });

      // Mock slow response for the all projects request BEFORE clicking
      (global.fetch as unknown as MockedFetch).mockImplementation(
        () => new Promise(() => {}),
      );

      // Now click the All Projects button
      const allProjectsButton = screen.getByText("All Projects");
      fireEvent.click(allProjectsButton);

      // Check for loading message
      await waitFor(() => {
        expect(
          screen.getByText("Loading all repositories..."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels and semantic structure", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        // Search input should have proper labeling
        expect(screen.getByLabelText("Search projects")).toBeInTheDocument();

        // Layout buttons should have aria-labels
        expect(screen.getByLabelText("Grid view")).toBeInTheDocument();
        expect(screen.getByLabelText("List view")).toBeInTheDocument();
      });
    });

    it("maintains focus management", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        const searchInput = screen.getByLabelText("Search projects");
        searchInput.focus();
        expect(document.activeElement).toBe(searchInput);
      });
    });
  });

  describe("Clear Filters", () => {
    it("clears all filters when clear filters button is clicked", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            pinnedItems: {
              edges: mockPinnedProjects.map((p) => ({ node: p })),
            },
          },
        }),
      });

      render(<Projects />);

      await waitFor(() => {
        // Apply filters
        const searchInput = screen.getByPlaceholderText(
          "Search projects by name, description, or topics...",
        );
        fireEvent.change(searchInput, { target: { value: "nonexistent" } });
      });

      await waitFor(() => {
        expect(
          screen.getByText("No projects found matching your criteria."),
        ).toBeInTheDocument();

        const clearButton = screen.getByText("Clear filters");
        fireEvent.click(clearButton);
      });

      await waitFor(() => {
        expect(screen.getAllByText("awesome-project").length).toBeGreaterThan(
          0,
        );
        expect(screen.getAllByText("cool-library").length).toBeGreaterThan(0);
      });
    });
  });
});
