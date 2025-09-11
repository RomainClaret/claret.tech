/**
 * Projects Context Tests
 *
 * Project data management context that handles repository information,
 * loading states, and provides data to components throughout the application.
 */

import { render, screen, act, renderHook } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProjectsProvider, useProjects } from "./projects-context";
import {
  renderHookWithErrorBoundary,
  expectHookError,
} from "../test/error-test-utils";

// Mock repository data for testing
const mockRepository = {
  id: "repo-1",
  name: "test-repo",
  description: "A test repository",
  url: "https://github.com/user/test-repo",
  homepageUrl: "https://test-repo.com",
  stargazerCount: 15,
  forkCount: 3,
  primaryLanguage: {
    name: "TypeScript",
    color: "#3178c6",
  },
  languages: {
    edges: [
      {
        node: { name: "TypeScript", color: "#3178c6" },
        size: 80000,
      },
      {
        node: { name: "CSS", color: "#563d7c" },
        size: 15000,
      },
    ],
  },
  topics: {
    edges: [
      {
        node: { topic: { name: "react" } },
      },
      {
        node: { topic: { name: "typescript" } },
      },
    ],
  },
  createdAt: "2023-01-15T10:00:00Z",
  updatedAt: "2023-12-01T15:30:00Z",
  pushedAt: "2023-12-01T15:30:00Z",
  isPrivate: false,
  isArchived: false,
  diskUsage: 1024,
  isFork: false,
  parent: null,
};

const mockForkRepository = {
  ...mockRepository,
  id: "fork-repo-1",
  name: "forked-repo",
  isFork: true,
  parent: {
    nameWithOwner: "original/repo",
  },
};

const mockRepositoryWithNulls = {
  ...mockRepository,
  id: "null-repo-1",
  description: null,
  homepageUrl: null,
  primaryLanguage: null,
  languages: undefined,
  topics: undefined,
  parent: null,
};

// Test component to access the context
function TestComponent() {
  const { allProjects, setAllProjects, isLoading, setIsLoading } =
    useProjects();

  return (
    <div data-testid="test-component">
      <div data-testid="projects-count">{allProjects.length}</div>
      <div data-testid="loading-state">{isLoading.toString()}</div>
      <button
        data-testid="add-project"
        onClick={() => setAllProjects([...allProjects, mockRepository])}
      >
        Add Project
      </button>
      <button
        data-testid="set-loading"
        onClick={() => setIsLoading(!isLoading)}
      >
        Toggle Loading
      </button>
      <button data-testid="clear-projects" onClick={() => setAllProjects([])}>
        Clear Projects
      </button>
      {allProjects.map((project) => (
        <div key={project.id} data-testid={`project-${project.id}`}>
          {project.name}
        </div>
      ))}
    </div>
  );
}

describe("ProjectsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("ProjectsProvider", () => {
    it("renders children without crashing", () => {
      expect(() => {
        render(
          <ProjectsProvider>
            <div data-testid="child">Test Child</div>
          </ProjectsProvider>,
        );
      }).not.toThrow();

      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("provides default empty projects array", () => {
      render(
        <ProjectsProvider>
          <TestComponent />
        </ProjectsProvider>,
      );

      expect(screen.getByTestId("projects-count")).toHaveTextContent("0");
      expect(screen.getByTestId("loading-state")).toHaveTextContent("false");
    });

    it("provides loading state management", () => {
      render(
        <ProjectsProvider>
          <TestComponent />
        </ProjectsProvider>,
      );

      const loadingState = screen.getByTestId("loading-state");
      const toggleButton = screen.getByTestId("set-loading");

      expect(loadingState).toHaveTextContent("false");

      act(() => {
        toggleButton.click();
      });

      expect(loadingState).toHaveTextContent("true");
    });

    it("handles multiple children correctly", () => {
      render(
        <ProjectsProvider>
          <div data-testid="child1">Child 1</div>
          <div data-testid="child2">Child 2</div>
          <TestComponent />
        </ProjectsProvider>,
      );

      expect(screen.getByTestId("child1")).toBeInTheDocument();
      expect(screen.getByTestId("child2")).toBeInTheDocument();
      expect(screen.getByTestId("test-component")).toBeInTheDocument();
    });
  });

  describe("useProjects Hook", () => {
    it("throws error when used outside provider", () => {
      // ⚠️ INTENTIONAL ERROR TEST - The following stderr error is expected and proves
      // our error handling infrastructure works correctly. This is a success indicator.
      console.info("⚠️ Expected error test: useProjects hook error validation");

      // Using our custom error testing utilities that properly handle
      // React hook errors with error boundaries and custom environment
      const { getError } = renderHookWithErrorBoundary(() => useProjects(), {
        expectError: true,
      });

      expectHookError(getError(), {
        message: "useProjects must be used within a ProjectsProvider",
        type: Error as new (...args: unknown[]) => Error,
      });
    });

    it("returns all context methods", () => {
      const { result } = renderHook(() => useProjects(), {
        wrapper: ({ children }) => (
          <ProjectsProvider>{children}</ProjectsProvider>
        ),
      });

      expect(result.current.allProjects).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(typeof result.current.setAllProjects).toBe("function");
      expect(typeof result.current.setIsLoading).toBe("function");
    });
  });

  describe("State Management", () => {
    it("sets projects array correctly", () => {
      render(
        <ProjectsProvider>
          <TestComponent />
        </ProjectsProvider>,
      );

      const projectsCount = screen.getByTestId("projects-count");
      const addButton = screen.getByTestId("add-project");

      expect(projectsCount).toHaveTextContent("0");

      act(() => {
        addButton.click();
      });

      expect(projectsCount).toHaveTextContent("1");
      expect(screen.getByTestId("project-repo-1")).toBeInTheDocument();
    });

    it("updates loading state", () => {
      const { result } = renderHook(() => useProjects(), {
        wrapper: ({ children }) => (
          <ProjectsProvider>{children}</ProjectsProvider>
        ),
      });

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.setIsLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setIsLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("handles empty projects list", () => {
      const { result } = renderHook(() => useProjects(), {
        wrapper: ({ children }) => (
          <ProjectsProvider>{children}</ProjectsProvider>
        ),
      });

      act(() => {
        result.current.setAllProjects([]);
      });

      expect(result.current.allProjects).toEqual([]);
      expect(result.current.allProjects).toHaveLength(0);
    });

    it("handles large project arrays", () => {
      const largeProjectArray = Array.from({ length: 100 }, (_, i) => ({
        ...mockRepository,
        id: `repo-${i}`,
        name: `test-repo-${i}`,
      }));

      const { result } = renderHook(() => useProjects(), {
        wrapper: ({ children }) => (
          <ProjectsProvider>{children}</ProjectsProvider>
        ),
      });

      act(() => {
        result.current.setAllProjects(largeProjectArray);
      });

      expect(result.current.allProjects).toHaveLength(100);
      expect(result.current.allProjects[0].name).toBe("test-repo-0");
      expect(result.current.allProjects[99].name).toBe("test-repo-99");
    });

    it("maintains project data integrity", () => {
      const { result } = renderHook(() => useProjects(), {
        wrapper: ({ children }) => (
          <ProjectsProvider>{children}</ProjectsProvider>
        ),
      });

      const projects = [mockRepository, mockForkRepository];

      act(() => {
        result.current.setAllProjects(projects);
      });

      expect(result.current.allProjects).toHaveLength(2);
      expect(result.current.allProjects[0]).toEqual(mockRepository);
      expect(result.current.allProjects[1]).toEqual(mockForkRepository);

      // Verify deep equality
      expect(result.current.allProjects[0].primaryLanguage?.name).toBe(
        "TypeScript",
      );
      expect(result.current.allProjects[1].parent?.nameWithOwner).toBe(
        "original/repo",
      );
    });

    it("clears projects when needed", () => {
      render(
        <ProjectsProvider>
          <TestComponent />
        </ProjectsProvider>,
      );

      const addButton = screen.getByTestId("add-project");
      const clearButton = screen.getByTestId("clear-projects");
      const projectsCount = screen.getByTestId("projects-count");

      // Add some projects
      act(() => {
        addButton.click();
      });

      act(() => {
        addButton.click();
      });

      expect(projectsCount).toHaveTextContent("2");

      // Clear projects
      act(() => {
        clearButton.click();
      });

      expect(projectsCount).toHaveTextContent("0");
    });

    it("handles loading state transitions", () => {
      const { result } = renderHook(() => useProjects(), {
        wrapper: ({ children }) => (
          <ProjectsProvider>{children}</ProjectsProvider>
        ),
      });

      // Initial state
      expect(result.current.isLoading).toBe(false);

      // Start loading
      act(() => {
        result.current.setIsLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      // Add projects while loading
      act(() => {
        result.current.setAllProjects([mockRepository]);
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.allProjects).toHaveLength(1);

      // Finish loading
      act(() => {
        result.current.setIsLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.allProjects).toHaveLength(1);
    });

    it("handles malformed project data", () => {
      const malformedProject = {
        // Missing required fields to test robustness
        id: "malformed-1",
        name: "malformed-repo",
        // description is missing (should be string | null)
        url: null as unknown as string, // Wrong type
        stargazerCount: "not-a-number" as unknown as number, // Wrong type
        createdAt: "invalid-date",
      };

      const { result } = renderHook(() => useProjects(), {
        wrapper: ({ children }) => (
          <ProjectsProvider>{children}</ProjectsProvider>
        ),
      });

      expect(() => {
        act(() => {
          result.current.setAllProjects([malformedProject as unknown as never]);
        });
      }).not.toThrow();

      expect(result.current.allProjects).toHaveLength(1);
      expect(result.current.allProjects[0].id).toBe("malformed-1");
    });
  });

  describe("Repository Data Tests", () => {
    it("handles complete repository objects", () => {
      const { result } = renderHook(() => useProjects(), {
        wrapper: ({ children }) => (
          <ProjectsProvider>{children}</ProjectsProvider>
        ),
      });

      act(() => {
        result.current.setAllProjects([mockRepository]);
      });

      const project = result.current.allProjects[0];

      expect(project.id).toBe("repo-1");
      expect(project.name).toBe("test-repo");
      expect(project.description).toBe("A test repository");
      expect(project.url).toBe("https://github.com/user/test-repo");
      expect(project.homepageUrl).toBe("https://test-repo.com");
      expect(project.stargazerCount).toBe(15);
      expect(project.forkCount).toBe(3);
      expect(project.primaryLanguage?.name).toBe("TypeScript");
      expect(project.primaryLanguage?.color).toBe("#3178c6");
      expect(project.isPrivate).toBe(false);
      expect(project.isArchived).toBe(false);
      expect(project.isFork).toBe(false);
    });

    it("handles repositories with null fields", () => {
      const { result } = renderHook(() => useProjects(), {
        wrapper: ({ children }) => (
          <ProjectsProvider>{children}</ProjectsProvider>
        ),
      });

      act(() => {
        result.current.setAllProjects([mockRepositoryWithNulls]);
      });

      const project = result.current.allProjects[0];

      expect(project.description).toBeNull();
      expect(project.homepageUrl).toBeNull();
      expect(project.primaryLanguage).toBeNull();
      expect(project.languages).toBeUndefined();
      expect(project.topics).toBeUndefined();
      expect(project.parent).toBeNull();
    });

    it("manages language and topic edges", () => {
      const { result } = renderHook(() => useProjects(), {
        wrapper: ({ children }) => (
          <ProjectsProvider>{children}</ProjectsProvider>
        ),
      });

      act(() => {
        result.current.setAllProjects([mockRepository]);
      });

      const project = result.current.allProjects[0];

      expect(project.languages?.edges).toHaveLength(2);
      expect(project.languages?.edges[0].node.name).toBe("TypeScript");
      expect(project.languages?.edges[0].size).toBe(80000);
      expect(project.languages?.edges[1].node.name).toBe("CSS");

      expect(project.topics?.edges).toHaveLength(2);
      expect(project.topics?.edges[0].node.topic.name).toBe("react");
      expect(project.topics?.edges[1].node.topic.name).toBe("typescript");
    });

    it("handles fork relationships", () => {
      const { result } = renderHook(() => useProjects(), {
        wrapper: ({ children }) => (
          <ProjectsProvider>{children}</ProjectsProvider>
        ),
      });

      act(() => {
        result.current.setAllProjects([mockRepository, mockForkRepository]);
      });

      const normalRepo = result.current.allProjects[0];
      const forkRepo = result.current.allProjects[1];

      expect(normalRepo.isFork).toBe(false);
      expect(normalRepo.parent).toBeNull();

      expect(forkRepo.isFork).toBe(true);
      expect(forkRepo.parent?.nameWithOwner).toBe("original/repo");
    });

    it("preserves all repository fields", () => {
      const { result } = renderHook(() => useProjects(), {
        wrapper: ({ children }) => (
          <ProjectsProvider>{children}</ProjectsProvider>
        ),
      });

      act(() => {
        result.current.setAllProjects([mockRepository]);
      });

      const project = result.current.allProjects[0];

      // Check that all fields are preserved
      expect(project.createdAt).toBe("2023-01-15T10:00:00Z");
      expect(project.updatedAt).toBe("2023-12-01T15:30:00Z");
      expect(project.pushedAt).toBe("2023-12-01T15:30:00Z");
      expect(project.diskUsage).toBe(1024);
      expect(project.stargazerCount).toBe(15);
      expect(project.forkCount).toBe(3);
      expect(project.isPrivate).toBe(false);
      expect(project.isArchived).toBe(false);
    });
  });

  describe("Component Integration", () => {
    it("works with multiple components accessing same data", () => {
      const SecondComponent = () => {
        const { allProjects, isLoading } = useProjects();
        return (
          <div data-testid="second-component">
            <span data-testid="second-count">{allProjects.length}</span>
            <span data-testid="second-loading">{isLoading.toString()}</span>
          </div>
        );
      };

      render(
        <ProjectsProvider>
          <TestComponent />
          <SecondComponent />
        </ProjectsProvider>,
      );

      const addButton = screen.getByTestId("add-project");

      act(() => {
        addButton.click();
      });

      // Both components should reflect the same state
      expect(screen.getByTestId("projects-count")).toHaveTextContent("1");
      expect(screen.getByTestId("second-count")).toHaveTextContent("1");
    });

    it("handles conditional rendering based on loading state", () => {
      const ConditionalComponent = () => {
        const { isLoading, allProjects } = useProjects();
        return (
          <div data-testid="conditional">
            {isLoading ? (
              <div data-testid="loading-indicator">Loading...</div>
            ) : (
              <div data-testid="projects-list">
                {allProjects.length} projects loaded
              </div>
            )}
          </div>
        );
      };

      render(
        <ProjectsProvider>
          <TestComponent />
          <ConditionalComponent />
        </ProjectsProvider>,
      );

      // Initially should show projects list
      expect(screen.getByTestId("projects-list")).toBeInTheDocument();
      expect(screen.queryByTestId("loading-indicator")).not.toBeInTheDocument();

      const toggleLoadingButton = screen.getByTestId("set-loading");

      act(() => {
        toggleLoadingButton.click();
      });

      // Should now show loading indicator
      expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();
      expect(screen.queryByTestId("projects-list")).not.toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("handles undefined children gracefully", () => {
      expect(() => {
        render(<ProjectsProvider>{undefined}</ProjectsProvider>);
      }).not.toThrow();
    });

    it("handles empty children gracefully", () => {
      expect(() => {
        render(<ProjectsProvider>{[]}</ProjectsProvider>);
      });
    });

    it("maintains consistent state after errors", () => {
      const { result } = renderHook(() => useProjects(), {
        wrapper: ({ children }) => (
          <ProjectsProvider>{children}</ProjectsProvider>
        ),
      });

      // Add valid data
      act(() => {
        result.current.setAllProjects([mockRepository]);
      });

      expect(result.current.allProjects).toHaveLength(1);

      // Try to add invalid data - should not crash
      act(() => {
        try {
          result.current.setAllProjects(null as unknown as never[]);
        } catch {
          // Ignore error, testing resilience
        }
      });

      // State management should still work
      act(() => {
        result.current.setAllProjects([]);
      });

      expect(result.current.allProjects).toHaveLength(0);
    });
  });

  describe("Performance", () => {
    it("renders efficiently", () => {
      const startTime = Date.now();

      render(
        <ProjectsProvider>
          <TestComponent />
        </ProjectsProvider>,
      );

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(50); // 50ms threshold
    });

    it("handles rapid state changes efficiently", () => {
      const { result } = renderHook(() => useProjects(), {
        wrapper: ({ children }) => (
          <ProjectsProvider>{children}</ProjectsProvider>
        ),
      });

      // Rapid state changes
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.setIsLoading(i % 2 === 0);
          result.current.setAllProjects([
            { ...mockRepository, id: `repo-${i}` },
          ]);
        }
      });

      // Should end in consistent state
      // Loop goes 0,1,2,3,4,5,6,7,8,9 - last iteration (i=9) gives i%2===0 -> false
      expect(result.current.isLoading).toBe(false); // Last iteration was odd
      expect(result.current.allProjects).toHaveLength(1);
      expect(result.current.allProjects[0].id).toBe("repo-9");
    });
  });
});
