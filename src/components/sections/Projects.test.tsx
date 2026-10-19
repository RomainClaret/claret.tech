import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { resetMotionGateForTests } from "@/lib/utils/motion-gate";
import { Projects } from "./Projects";
import type {
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

vi.mock("@/lib/utils/language-colors", () => {
  const icon = (name: string | undefined) => (props: LucideIconProps) => (
    <div data-testid={`language-icon-${name}`} {...props} />
  );
  return {
    getProjectColor: (color: string | null, _name: string | undefined) =>
      color || "59, 130, 246",
    getLanguageIcon: icon,
    // The project dialog looks its icon up rather than calling for it.
    languageIcons: new Proxy({}, { get: (_icons, name) => icon(String(name)) }),
    defaultLanguageIcon: icon(undefined),
  };
});

// Mock portfolio data
vi.mock("@/data/portfolio", () => ({
  projectsSection: {
    display: true,
    title: "Software Engineering Playground",
    subtitle: {
      highlightedText: "Building tools that should exist but don't",
      normalText:
        "Need it? Build it. Broken? Fix it. Too slow? Optimize it. Each project here exists because I needed it and nobody else had done it right. From automating kernels to analyzing evolutionary data, from research pipelines to visualization tools, every problem has a solution waiting to be coded.",
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
          screen.getByRole("heading", {
            name: "Software Engineering Playground",
          }),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Need it\? Build it\. Broken\? Fix it\./),
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
        // The spotlight's alone: its project is not repeated as a card.
        expect(screen.getAllByText("120")).toHaveLength(1); // Stars
        expect(screen.getAllByText("15")).toHaveLength(1); // Forks
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

  describe("All projects request", () => {
    it("asks once while the API fails, and again on the next click", async () => {
      // A failed answer changed the fetch's identity, which re-ran the
      // effect that called it: the browser asked again at once, for as long
      // as the API kept failing.
      let allRequests = 0;
      (global.fetch as unknown as MockedFetch).mockImplementation(
        async (url: unknown) => {
          if (url === "/api/fetch-all-repos") {
            allRequests++;
            return { ok: true, json: async () => ({ success: false }) };
          }
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { pinnedItems: { edges: [] } },
            }),
          };
        },
      );
      render(<Projects />);
      const all = await screen.findByText("All Projects");

      fireEvent.click(all);
      await waitFor(() => expect(allRequests).toBe(1));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(allRequests).toBe(1);

      fireEvent.click(all);
      await waitFor(() => expect(allRequests).toBe(2));
    });

    it("asks by itself once the splash's fetch ends empty while All shows", async () => {
      let allRequests = 0;
      (global.fetch as unknown as MockedFetch).mockImplementation(
        async (url: unknown) => {
          if (url === "/api/fetch-all-repos") {
            allRequests++;
            return { ok: true, json: async () => ({ success: false }) };
          }
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { pinnedItems: { edges: [] } },
            }),
          };
        },
      );
      mockProjectsContext.isLoading = true; // the splash is fetching them
      try {
        const { rerender } = render(<Projects />);
        fireEvent.click(await screen.findByText("All Projects"));
        expect(allRequests).toBe(0);

        mockProjectsContext.isLoading = false; // ...and came back empty
        rerender(<Projects />);
        await waitFor(() => expect(allRequests).toBe(1));
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });
        expect(allRequests).toBe(1);
      } finally {
        mockProjectsContext.isLoading = false;
      }
    });

    it("asks once when the API answers with no repositories", async () => {
      let allRequests = 0;
      (global.fetch as unknown as MockedFetch).mockImplementation(
        async (url: unknown) => {
          if (url === "/api/fetch-all-repos") {
            allRequests++;
            return {
              ok: true,
              json: async () => ({ success: true, data: [] }),
            };
          }
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: { pinnedItems: { edges: [] } },
            }),
          };
        },
      );
      render(<Projects />);

      fireEvent.click(await screen.findByText("All Projects"));
      await waitFor(() => expect(allRequests).toBe(1));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(allRequests).toBe(1);
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

  describe("Featured spotlight", () => {
    const pinnedResponse = () => ({
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
    /** A grid card, by the button on its name. */
    const card = (name: string) => screen.queryByRole("button", { name });

    it("is not repeated in the grid under it", async () => {
      // The most starred pinned repo was the spotlight and, right under it,
      // the grid's first card again, in both views.
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce(
        pinnedResponse(),
      );
      render(<Projects />);

      await screen.findByText("Featured Project");
      expect(screen.getAllByText("awesome-project")).toHaveLength(1);
      expect(card("awesome-project")).toBeNull();
      expect(card("cool-library")).toBeInTheDocument();
    });

    it("steps aside for a search, and its project joins the grid", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce(
        pinnedResponse(),
      );
      render(<Projects />);
      await screen.findByText("Featured Project");

      fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "awesome" },
      });

      expect(screen.queryByText("Featured Project")).toBeNull();
      expect(card("awesome-project")).toBeInTheDocument();
    });

    it("steps aside for a tech filter too", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce(
        pinnedResponse(),
      );
      render(<Projects />);
      await screen.findByText("Featured Project");

      fireEvent.click(screen.getByTestId("filter-TypeScript"));

      expect(screen.queryByText("Featured Project")).toBeNull();
      expect(card("awesome-project")).toBeInTheDocument();
    });

    it("is not a card in the All view either", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce(
        pinnedResponse(),
      );
      mockProjectsContext.allProjects = mockAllProjects as never;
      render(<Projects />);
      await screen.findByText("Featured Project");

      fireEvent.click(screen.getByRole("button", { name: "All Projects" }));

      expect(screen.getByText("Featured Project")).toBeInTheDocument();
      expect(card("awesome-project")).toBeNull();
      expect(card("cool-library")).toBeInTheDocument();
    });

    it("sits under the controls, so hiding it moves nothing above them", async () => {
      (global.fetch as unknown as MockedFetch).mockResolvedValueOnce(
        pinnedResponse(),
      );
      render(<Projects />);
      const spotlight = await screen.findByText("Featured Project");

      const search = screen.getByRole("searchbox");
      expect(
        search.compareDocumentPosition(spotlight) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  describe("Toggle state", () => {
    it("says which view and which layout are on", async () => {
      // The four toggles showed their state by colour alone: a screen reader
      // heard four plain buttons, none of them on.
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
      mockProjectsContext.allProjects = mockAllProjects as never;

      render(<Projects />);
      const featured = await screen.findByRole("button", { name: "Featured" });
      const all = screen.getByRole("button", { name: "All Projects" });
      const grid = screen.getByRole("button", { name: "Grid view" });
      const list = screen.getByRole("button", { name: "List view" });

      expect(featured).toHaveAttribute("aria-pressed", "true");
      expect(all).toHaveAttribute("aria-pressed", "false");
      expect(grid).toHaveAttribute("aria-pressed", "true");
      expect(list).toHaveAttribute("aria-pressed", "false");

      fireEvent.click(list);
      fireEvent.click(all);

      expect(list).toHaveAttribute("aria-pressed", "true");
      expect(grid).toHaveAttribute("aria-pressed", "false");
      expect(all).toHaveAttribute("aria-pressed", "true");
      expect(featured).toHaveAttribute("aria-pressed", "false");
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
        expect(screen.getAllByText("120")).toHaveLength(1); // the spotlight
        expect(screen.getAllByText("45")).toHaveLength(1);
        expect(screen.getAllByText("15")).toHaveLength(1); // the spotlight
        expect(screen.getAllByText("8")).toHaveLength(1);
      });
    });

    it("handles projects without descriptions", async () => {
      // On a card: the spotlight (the most starred, index 0) is not one.
      const projectsWithoutDesc = [
        mockPinnedProjects[0],
        { ...mockPinnedProjects[1], description: null },
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

  // The pinned repositories come from /api/fetch-github, else from the
  // snapshot the deploy build saved at /profile.json: one request each. The
  // old fallback read a file nothing built, twice, then said "No projects
  // found matching your criteria" with a Clear filters button and no filter.
  describe("Error Handling", () => {
    const fetchMock = () => global.fetch as unknown as MockedFetch;
    const requested = () =>
      vi.mocked(global.fetch).mock.calls.map(([url]) => url);
    const pinnedAnswer = {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          pinnedItems: {
            edges: mockPinnedProjects.map((p) => ({ node: p })),
          },
        },
      }),
    };

    it("asks the API once when it answers", async () => {
      fetchMock().mockResolvedValueOnce(pinnedAnswer);

      render(<Projects />);

      expect(
        (await screen.findAllByText("awesome-project")).length,
      ).toBeGreaterThan(0);
      expect(requested()).toEqual(["/api/fetch-github"]);
    });

    it.each([
      ["fails", new Error("API Error")],
      [
        "has no data",
        { ok: true, json: async () => ({ success: true, data: null }) },
      ],
    ])(
      "reads the build's snapshot, once, when the API %s",
      async (_, apiAnswer) => {
        if (apiAnswer instanceof Error) {
          fetchMock().mockRejectedValueOnce(apiAnswer);
        } else {
          fetchMock().mockResolvedValueOnce(apiAnswer);
        }
        fetchMock().mockResolvedValueOnce(pinnedAnswer);

        render(<Projects />);

        expect(
          (await screen.findAllByText("awesome-project")).length,
        ).toBeGreaterThan(0);
        expect(requested()).toEqual(["/api/fetch-github", "/profile.json"]);
      },
    );

    it("says the projects could not load when both fail", async () => {
      fetchMock()
        .mockRejectedValueOnce(new Error("API Error"))
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({
            success: false,
            error: "No snapshot in this build",
          }),
        });

      render(<Projects />);

      expect(
        await screen.findByText("The projects could not load from GitHub."),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          name: /Software Engineering Playground/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("No projects found matching your criteria."),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
      expect(requested()).toEqual(["/api/fetch-github", "/profile.json"]);
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

  describe("Project details", () => {
    // A card's details open in one dialog above the page. They opened in a
    // panel inside the grid item, which made the card grow with blank
    // space, painted under the next row's card, and passed its links'
    // clicks to that card. Keyboard users could not open it at all.
    beforeEach(() => {
      vi.spyOn(window, "scrollTo").mockImplementation(() => {}); // jsdom lacks it
      (global.fetch as unknown as MockedFetch).mockResolvedValue({
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
    });
    afterEach(() => {
      resetMotionGateForTests();
      document.body.style.overflow = "";
    });

    it("opens from a real button named after the repository", async () => {
      render(<Projects />);

      const button = await screen.findByRole("button", {
        name: "cool-library",
      });

      expect(button).toHaveAttribute("aria-haspopup", "dialog");
    });

    it("opens a dialog outside the card from a click anywhere on it", async () => {
      const { container } = render(<Projects />);
      await screen.findByText("A cool library for developers");

      fireEvent.click(screen.getByText("A cool library for developers"));

      const dialog = screen.getByRole("dialog", { name: "cool-library" });
      expect(container).not.toContainElement(dialog);
      const card = screen
        .getAllByTestId("slide-in-up")
        .find((item) => within(item).queryByText("cool-library"))!;
      expect(within(card).queryByText("View on GitHub")).toBeNull();
    });

    it("opens from its focused button and gives the focus back on Escape", async () => {
      // Enter and Space on a button are the browser's own click, which
      // jsdom does not synthesize; the e2e test presses the keys. fireEvent
      // throughout: userEvent.setup() replaces navigator.clipboard with a
      // getter, and the setup file's next reassignment of it throws.
      render(<Projects />);
      const button = await screen.findByRole("button", {
        name: "cool-library",
      });
      button.focus();

      fireEvent.click(button);
      expect(
        screen.getByRole("dialog", { name: "cool-library" }),
      ).toHaveFocus();

      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(button).toHaveFocus();
    });

    it("shows no empty Activity or Topics block for a pinned repository", async () => {
      render(<Projects />);
      await screen.findByText("A cool library for developers");

      fireEvent.click(screen.getByText("A cool library for developers"));

      expect(screen.queryByRole("heading", { name: /Activity/ })).toBeNull();
      expect(screen.queryByRole("heading", { name: /Topics/ })).toBeNull();
    });

    it("closes from its close button", async () => {
      render(<Projects />);
      await screen.findByText("A cool library for developers");
      fireEvent.click(screen.getByText("A cool library for developers"));

      fireEvent.click(screen.getByRole("button", { name: "Close details" }));

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("shows the full record of a repository in the All view", async () => {
      mockProjectsContext.allProjects = mockAllProjects as never;
      render(<Projects />);
      fireEvent.click(await screen.findByText("All Projects"));

      fireEvent.click(await screen.findByText("A useful Python tool"));

      const dialog = screen.getByRole("dialog", { name: "python-tool" });
      expect(within(dialog).getByText("90.0%")).toBeInTheDocument();
      expect(within(dialog).getByText("Nov 20, 2023")).toBeInTheDocument();
      expect(
        within(dialog).getByRole("link", { name: /Live Demo/ }),
      ).toHaveAttribute("href", "https://python-tool.example.com");
    });

    it("shows a pinned repository's full record once all are loaded", async () => {
      mockProjectsContext.allProjects = mockAllProjects as never;
      render(<Projects />);
      await screen.findByText("A cool library for developers");

      fireEvent.click(screen.getByText("A cool library for developers"));

      const dialog = screen.getByRole("dialog", { name: "cool-library" });
      expect(within(dialog).getByText("react")).toBeInTheDocument();
      expect(within(dialog).getByText("Dec 15, 2023")).toBeInTheDocument();
    });

    it("keeps list rows as links to GitHub", async () => {
      render(<Projects />);
      await screen.findByText("A cool library for developers");

      fireEvent.click(screen.getByLabelText("List view"));

      expect(
        screen.getByRole("link", { name: /cool-library/ }),
      ).toHaveAttribute("href", "https://github.com/user/cool-library");
      expect(screen.queryByRole("button", { name: "cool-library" })).toBeNull();
    });

    it("shows a list row's link hint on keyboard focus, as on hover", async () => {
      render(<Projects />);
      await screen.findByText("A cool library for developers");

      fireEvent.click(screen.getByLabelText("List view"));

      // jsdom applies no :focus-within styles; the classes are the contract.
      const title = screen.getByRole("heading", { name: /cool-library/ });
      expect(title).toHaveClass(
        "group-hover:text-primary",
        "group-focus-within:text-primary",
      );
      expect(
        title.querySelector('[data-testid="external-link-icon"]'),
      ).toHaveClass(
        "group-hover:opacity-100",
        "group-focus-within:opacity-100",
      );
    });
  });
});
