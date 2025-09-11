import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNeuralNetwork } from "./useNeuralNetwork";
import { Publication } from "@/lib/api/fetch-publications";
import { Paper } from "@/data/sections/papers";
import { ResearchNodeData } from "@/components/ui/research-node";
import type {
  MockGraphNode,
  MockGraphEdge,
  MockGraph,
} from "@/test/mock-types";

// Mock the graph algorithms module
vi.mock("@/lib/utils/graph-algorithms", () => ({
  createCitationGraph: vi.fn((_publications, _staticPapers) => ({
    nodes: new Map([
      [
        "pub1",
        {
          id: "pub1",
          title: "Test Publication 1",
          authors: ["Author 1"],
          year: "2020",
          citations: 10,
          x: 100,
          y: 100,
          radius: 5,
          color: "blue",
          influence: 0.5,
        },
      ],
      [
        "pub2",
        {
          id: "pub2",
          title: "Test Publication 2",
          authors: ["Author 2"],
          year: "2021",
          citations: 5,
          x: 200,
          y: 200,
          radius: 4,
          color: "red",
          influence: 0.3,
        },
      ],
    ]),
    edges: [
      { source: "pub1", target: "pub2", strength: 0.8, bidirectional: false },
    ],
    clusters: new Map([["ai", ["pub1", "pub2"]]]),
  })),
  forceDirectedLayout: vi.fn((graph) => graph),
  filterGraph: vi.fn((graph: MockGraph, filters) => {
    // Simple filter implementation for testing
    const filteredNodes = new Map<string, MockGraphNode>();
    const filteredEdges: MockGraphEdge[] = [];

    graph.nodes.forEach((node: MockGraphNode, id: string) => {
      const year = parseInt(node.year);
      const [minYear, maxYear] = filters.yearRange;
      const meetsYearCriteria = year >= minYear && year <= maxYear;
      const meetsCitationCriteria =
        (node.citations || 0) >= filters.minCitations;
      const meetsSearchCriteria =
        !filters.searchQuery ||
        node.title.toLowerCase().includes(filters.searchQuery.toLowerCase());

      if (meetsYearCriteria && meetsCitationCriteria && meetsSearchCriteria) {
        filteredNodes.set(id, node);
      }
    });

    graph.edges.forEach((edge: MockGraphEdge) => {
      if (filteredNodes.has(edge.source) && filteredNodes.has(edge.target)) {
        filteredEdges.push(edge);
      }
    });

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
      clusters: graph.clusters,
    };
  }),
}));

describe("useNeuralNetwork", () => {
  const mockPublications: Publication[] = [
    {
      id: "pub1",
      title: "Test Publication 1",
      authors: ["Author 1"],
      year: "2020",
      citations: 10,
      source: "static" as const,
    },
    {
      id: "pub2",
      title: "Test Publication 2",
      authors: ["Author 2"],
      year: "2021",
      citations: 5,
      source: "static" as const,
    },
  ];

  const mockStaticPapers: Paper[] = [
    {
      title: "Static Paper 1",
      date: "2019",
      subtitle: "A static paper for testing",
      image: "/test.jpg",
      footerLink: [{ name: "Link", url: "http://test.com" }],
    },
  ];

  const defaultProps = {
    publications: mockPublications,
    staticPapers: mockStaticPapers,
    containerWidth: 800,
    containerHeight: 600,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.useFakeTimers();

    // Mock console.log to avoid test output pollution
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();

    // Clean up any window event listeners that may have been added
    // This prevents test contamination in batch mode
    const listeners = (window as any)._listeners;
    if (listeners) {
      Object.keys(listeners).forEach((event) => {
        delete listeners[event];
      });
    }

    // Alternative approach: create new window event target
    const newListeners = new Map();
    Object.defineProperty(window, "_listeners", {
      value: newListeners,
      writable: true,
      configurable: true,
    });
  });

  describe("Initial State", () => {
    it("returns correct initial state", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      expect(result.current.selectedNode).toBe(null);
      expect(result.current.highlightedNode).toBe(null);
      expect(result.current.viewMode).toBe("grid");
      expect(result.current.isFullscreen).toBe(false);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.connectedNodes).toEqual(new Set());
      expect(result.current.filters).toEqual({
        yearRange: [2010, new Date().getFullYear()],
        minCitations: 0,
        searchQuery: "",
        showTheses: true,
        showPapers: true,
        showPosters: true,
      });
    });

    it("sets loading to false after timeout", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      expect(result.current.isLoading).toBe(true);

      act(() => {
        vi.runAllTimers();
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("Graph Creation", () => {
    it("creates graph with correct structure", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      expect(result.current.graph.nodes.size).toBe(2);
      expect(result.current.graph.edges).toHaveLength(1);
      expect(result.current.graph.nodes.has("pub1")).toBe(true);
      expect(result.current.graph.nodes.has("pub2")).toBe(true);
    });

    it("recreates graph when publications change", () => {
      const { result, rerender } = renderHook(
        (props) => useNeuralNetwork(props),
        {
          initialProps: defaultProps,
        },
      );

      const initialGraph = result.current.graph;

      const newPublications = [
        ...mockPublications,
        {
          id: "pub3",
          title: "New Publication",
          authors: ["Author 3"],
          year: "2022",
          citations: 15,
          source: "static" as const,
        },
      ];

      rerender({
        ...defaultProps,
        publications: newPublications,
      });

      expect(result.current.graph).not.toBe(initialGraph);
    });

    it("recreates graph when container dimensions change", () => {
      const { result, rerender } = renderHook(
        (props) => useNeuralNetwork(props),
        {
          initialProps: defaultProps,
        },
      );

      const initialGraph = result.current.graph;

      rerender({
        ...defaultProps,
        containerWidth: 1000,
        containerHeight: 800,
      });

      expect(result.current.graph).not.toBe(initialGraph);
    });
  });

  describe("Graph Filtering", () => {
    it("filters graph based on year range", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      act(() => {
        result.current.setFilters({
          ...result.current.filters,
          yearRange: [2021, 2023],
        });
      });

      // Should only include pub2 (year 2021)
      expect(result.current.filteredGraph.nodes.size).toBe(1);
      expect(result.current.filteredGraph.nodes.has("pub2")).toBe(true);
      expect(result.current.filteredGraph.nodes.has("pub1")).toBe(false);
    });

    it("filters graph based on minimum citations", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      act(() => {
        result.current.setFilters({
          ...result.current.filters,
          minCitations: 8,
        });
      });

      // Should only include pub1 (10 citations)
      expect(result.current.filteredGraph.nodes.size).toBe(1);
      expect(result.current.filteredGraph.nodes.has("pub1")).toBe(true);
      expect(result.current.filteredGraph.nodes.has("pub2")).toBe(false);
    });

    it("filters graph based on search query", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      act(() => {
        result.current.setFilters({
          ...result.current.filters,
          searchQuery: "Publication 1",
        });
      });

      // Should only include pub1
      expect(result.current.filteredGraph.nodes.size).toBe(1);
      expect(result.current.filteredGraph.nodes.has("pub1")).toBe(true);
      expect(result.current.filteredGraph.nodes.has("pub2")).toBe(false);
    });

    it("filters edges when nodes are filtered out", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      act(() => {
        result.current.setFilters({
          ...result.current.filters,
          yearRange: [2021, 2023], // Only includes pub2
        });
      });

      // Edge should be filtered out because pub1 is not included
      expect(result.current.filteredGraph.edges).toHaveLength(0);
    });
  });

  describe("Node Selection", () => {
    it("selects and deselects nodes", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      const node = result.current.graph.nodes.get("pub1") as ResearchNodeData;

      act(() => {
        result.current.setSelectedNode(node);
      });

      expect(result.current.selectedNode).toBe(node);

      act(() => {
        result.current.setSelectedNode(null);
      });

      expect(result.current.selectedNode).toBe(null);
    });

    it("highlights and unhighlights nodes", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      const node = result.current.graph.nodes.get("pub1") as ResearchNodeData;

      act(() => {
        result.current.setHighlightedNode(node);
      });

      expect(result.current.highlightedNode).toBe(node);

      act(() => {
        result.current.setHighlightedNode(null);
      });

      expect(result.current.highlightedNode).toBe(null);
    });

    it("calculates connected nodes for selected node", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      const node = result.current.graph.nodes.get("pub1") as ResearchNodeData;

      act(() => {
        result.current.setSelectedNode(node);
      });

      const connectedNodes = result.current.connectedNodes;
      expect(connectedNodes.has("pub1")).toBe(true); // Self
      expect(connectedNodes.has("pub2")).toBe(true); // Connected via edge
    });

    it("calculates connected nodes for highlighted node", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      const node = result.current.graph.nodes.get("pub2") as ResearchNodeData;

      act(() => {
        result.current.setHighlightedNode(node);
      });

      const connectedNodes = result.current.connectedNodes;
      expect(connectedNodes.has("pub2")).toBe(true); // Self
      expect(connectedNodes.has("pub1")).toBe(true); // Connected via edge
    });

    it("prioritizes highlighted node over selected node for connections", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      const node1 = result.current.graph.nodes.get("pub1") as ResearchNodeData;
      const node2 = result.current.graph.nodes.get("pub2") as ResearchNodeData;

      act(() => {
        result.current.setSelectedNode(node1);
        result.current.setHighlightedNode(node2);
      });

      // Should prioritize highlighted node (pub2)
      const connectedNodes = result.current.connectedNodes;
      expect(connectedNodes.has("pub2")).toBe(true);
      expect(connectedNodes.has("pub1")).toBe(true);
    });
  });

  describe("View Mode", () => {
    it("changes view mode", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      expect(result.current.viewMode).toBe("grid");

      act(() => {
        result.current.setViewMode("network");
      });

      expect(result.current.viewMode).toBe("network");

      act(() => {
        result.current.setViewMode("grid");
      });

      expect(result.current.viewMode).toBe("grid");
    });
  });

  describe("Fullscreen Mode", () => {
    it("toggles fullscreen mode", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      expect(result.current.isFullscreen).toBe(false);

      act(() => {
        result.current.setFullscreen(true);
      });

      expect(result.current.isFullscreen).toBe(true);

      act(() => {
        result.current.setFullscreen(false);
      });

      expect(result.current.isFullscreen).toBe(false);
    });
  });

  describe("Keyboard Shortcuts", () => {
    it("clears selection on Escape key", () => {
      const { result, unmount } = renderHook(() =>
        useNeuralNetwork(defaultProps),
      );

      const node = result.current.graph.nodes.get("pub1") as ResearchNodeData;

      // Ensure clean initial state (in case of batch mode contamination)
      act(() => {
        result.current.setSelectedNode(null);
        result.current.setHighlightedNode(null);
        result.current.setFullscreen(false);
        result.current.setViewMode("grid");
      });

      act(() => {
        result.current.setSelectedNode(node);
        result.current.setHighlightedNode(node);
      });

      expect(result.current.selectedNode).toBe(node);
      expect(result.current.highlightedNode).toBe(node);

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "Escape" });
        window.dispatchEvent(event);
      });

      expect(result.current.selectedNode).toBe(null);
      expect(result.current.highlightedNode).toBe(null);

      // Clean up to prevent test contamination
      unmount();
    });

    it("toggles fullscreen on Ctrl+F", () => {
      const { result, unmount } = renderHook(() =>
        useNeuralNetwork(defaultProps),
      );

      // Ensure clean initial state (in case of batch mode contamination)
      act(() => {
        result.current.setSelectedNode(null);
        result.current.setHighlightedNode(null);
        result.current.setFullscreen(false);
        result.current.setViewMode("grid");
      });

      expect(result.current.isFullscreen).toBe(false);

      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: "f",
          ctrlKey: true,
        });
        Object.defineProperty(event, "preventDefault", {
          value: vi.fn(),
          writable: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.isFullscreen).toBe(true);

      // Clean up to prevent test contamination
      unmount();
    });

    it("toggles fullscreen on Cmd+F (Mac)", () => {
      const { result, unmount } = renderHook(() =>
        useNeuralNetwork(defaultProps),
      );

      // Ensure clean initial state (in case of batch mode contamination)
      act(() => {
        result.current.setSelectedNode(null);
        result.current.setHighlightedNode(null);
        result.current.setFullscreen(false);
        result.current.setViewMode("grid");
      });

      expect(result.current.isFullscreen).toBe(false);

      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: "f",
          metaKey: true,
        });
        Object.defineProperty(event, "preventDefault", {
          value: vi.fn(),
          writable: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.isFullscreen).toBe(true);

      // Clean up to prevent test contamination
      unmount();
    });

    it("toggles view mode on Ctrl+V", () => {
      const { result, unmount } = renderHook(() =>
        useNeuralNetwork(defaultProps),
      );

      // Ensure clean initial state (in case of batch mode contamination)
      act(() => {
        result.current.setSelectedNode(null);
        result.current.setHighlightedNode(null);
        result.current.setFullscreen(false);
        result.current.setViewMode("grid");
      });

      expect(result.current.viewMode).toBe("grid");

      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: "v",
          ctrlKey: true,
        });
        Object.defineProperty(event, "preventDefault", {
          value: vi.fn(),
          writable: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.viewMode).toBe("network");

      act(() => {
        const event = new KeyboardEvent("keydown", {
          key: "v",
          ctrlKey: true,
        });
        Object.defineProperty(event, "preventDefault", {
          value: vi.fn(),
          writable: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.viewMode).toBe("grid");

      // Clean up to prevent test contamination
      unmount();
    });
  });

  describe("Export Functionality", () => {
    it("provides export function", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      expect(typeof result.current.exportVisualization).toBe("function");

      // Should not throw when called (even though implementation is empty)
      expect(() => {
        result.current.exportVisualization();
      }).not.toThrow();
    });
  });

  describe("Performance and Cleanup", () => {
    it("cleans up keyboard event listeners on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() => useNeuralNetwork(defaultProps));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
      );
    });

    it("cleans up loading timeout on unmount", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const { unmount } = renderHook(() => useNeuralNetwork(defaultProps));

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("memoizes graph creation to avoid unnecessary recalculations", async () => {
      const graphAlgorithms = await import("@/lib/utils/graph-algorithms");
      const createCitationGraphMock = vi.mocked(
        graphAlgorithms.createCitationGraph,
      );

      const { rerender } = renderHook((props) => useNeuralNetwork(props), {
        initialProps: defaultProps,
      });

      const initialCallCount = createCitationGraphMock.mock.calls.length;

      // Rerender with same props - should not call createCitationGraph again
      rerender(defaultProps);

      expect(createCitationGraphMock.mock.calls.length).toBe(initialCallCount);
    });

    it("memoizes filtered graph to avoid unnecessary recalculations", async () => {
      const graphAlgorithms = await import("@/lib/utils/graph-algorithms");
      const filterGraphMock = vi.mocked(graphAlgorithms.filterGraph);

      const { rerender } = renderHook(() => useNeuralNetwork(defaultProps));

      const initialCallCount = filterGraphMock.mock.calls.length;

      // Rerender without changing graph or filters
      rerender();

      expect(filterGraphMock.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe("Edge Cases", () => {
    it("handles empty publications array", () => {
      const emptyProps = {
        ...defaultProps,
        publications: [],
      };

      const { result } = renderHook(() => useNeuralNetwork(emptyProps));

      expect(result.current.graph.nodes.size).toBe(2); // Mock still returns 2 nodes
      expect(result.current.filteredGraph.nodes.size).toBe(2);
    });

    it("handles empty static papers array", () => {
      const emptyProps = {
        ...defaultProps,
        staticPapers: [],
      };

      const { result } = renderHook(() => useNeuralNetwork(emptyProps));

      expect(result.current.graph.nodes.size).toBe(2); // Mock still returns 2 nodes
    });

    it("handles zero container dimensions", () => {
      const zeroProps = {
        ...defaultProps,
        containerWidth: 0,
        containerHeight: 0,
      };

      expect(() => {
        renderHook(() => useNeuralNetwork(zeroProps));
      }).not.toThrow();
    });

    it("handles selecting non-existent node", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      const fakeNode = {
        id: "fake",
        title: "Fake Node",
        authors: ["Fake Author"],
        year: "2023",
        x: 0,
        y: 0,
        radius: 1,
        color: "black",
        influence: 0,
      } as ResearchNodeData;

      act(() => {
        result.current.setSelectedNode(fakeNode);
      });

      expect(result.current.selectedNode).toBe(fakeNode);
      // Connected nodes should just include the fake node itself
      expect(result.current.connectedNodes.has("fake")).toBe(true);
    });

    it("handles invalid filter values gracefully", () => {
      const { result } = renderHook(() => useNeuralNetwork(defaultProps));

      // Set invalid year range (min > max)
      act(() => {
        result.current.setFilters({
          yearRange: [2025, 2020], // Invalid range
          minCitations: -5, // Negative citations
          searchQuery: "",
          showTheses: true,
          showPapers: true,
          showPosters: true,
        });
      });

      // Should not crash
      expect(result.current.filteredGraph).toBeDefined();
    });
  });
});
