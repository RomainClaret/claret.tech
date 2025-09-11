import { useState, useEffect, useCallback, useMemo } from "react";
import { Publication } from "@/lib/api/fetch-publications";
import { Paper } from "@/data/sections/papers";
import {
  CitationGraph,
  createCitationGraph,
  forceDirectedLayout,
  filterGraph,
} from "@/lib/utils/graph-algorithms";
import { NetworkFilters } from "@/components/ui/network-controls";
import { ResearchNodeData } from "@/components/ui/research-node";

interface UseNeuralNetworkProps {
  publications: Publication[];
  staticPapers: Paper[];
  containerWidth: number;
  containerHeight: number;
}

interface UseNeuralNetworkReturn {
  graph: CitationGraph;
  filteredGraph: CitationGraph;
  selectedNode: ResearchNodeData | null;
  highlightedNode: ResearchNodeData | null;
  connectedNodes: Set<string>;
  viewMode: "network" | "grid";
  filters: NetworkFilters;
  isFullscreen: boolean;
  isLoading: boolean;
  setSelectedNode: (node: ResearchNodeData | null) => void;
  setHighlightedNode: (node: ResearchNodeData | null) => void;
  setViewMode: (mode: "network" | "grid") => void;
  setFilters: (filters: NetworkFilters) => void;
  setFullscreen: (fullscreen: boolean) => void;
  exportVisualization: () => void;
}

export function useNeuralNetwork({
  publications,
  staticPapers,
  containerWidth,
  containerHeight,
}: UseNeuralNetworkProps): UseNeuralNetworkReturn {
  const [selectedNode, setSelectedNode] = useState<ResearchNodeData | null>(
    null,
  );
  const [highlightedNode, setHighlightedNode] =
    useState<ResearchNodeData | null>(null);
  const [viewMode, setViewMode] = useState<"network" | "grid">("grid");
  const [isFullscreen, setFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [filters, setFilters] = useState<NetworkFilters>({
    yearRange: [2010, new Date().getFullYear()],
    minCitations: 0,
    searchQuery: "",
    showTheses: true,
    showPapers: true,
    showPosters: true,
  });

  // Create and layout the citation graph
  const graph = useMemo(() => {
    const citationGraph = createCitationGraph(publications, staticPapers);
    const layoutGraph = forceDirectedLayout(
      citationGraph,
      containerWidth,
      containerHeight,
    );
    return layoutGraph;
  }, [publications, staticPapers, containerWidth, containerHeight]);

  // Manage loading state for graph creation
  useEffect(() => {
    setIsLoading(true);
    // Use a small timeout to ensure the loading state is set before the graph is computed
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [publications, staticPapers, containerWidth, containerHeight]);

  // Filter the graph based on current filters
  const filteredGraph = useMemo(() => {
    return filterGraph(graph, filters);
  }, [graph, filters]);

  // Calculate connected nodes when a node is highlighted or selected
  const connectedNodes = useMemo(() => {
    const connected = new Set<string>();
    const activeNode = highlightedNode || selectedNode;

    if (!activeNode) return connected;

    // Add the active node itself
    connected.add(activeNode.id);

    // Add all nodes connected by edges
    filteredGraph.edges.forEach((edge) => {
      if (edge.source === activeNode.id) {
        connected.add(edge.target);
      } else if (edge.target === activeNode.id) {
        connected.add(edge.source);
      }
    });

    return connected;
  }, [highlightedNode, selectedNode, filteredGraph]);

  // Handle node selection
  const handleNodeSelect = useCallback(
    (node: ResearchNodeData | null) => {
      setSelectedNode(node);

      // If selecting a node in network view, animate to focus on it
      if (node && viewMode === "network") {
        // Could implement zoom/pan to node here
      }
    },
    [viewMode],
  );

  // Handle node hover
  const handleNodeHighlight = useCallback((node: ResearchNodeData | null) => {
    setHighlightedNode(node);
  }, []);

  // Export visualization as image
  const exportVisualization = useCallback(() => {
    // Implementation would capture the SVG/Canvas and download as image
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedNode(null);
        setHighlightedNode(null);
      }

      if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setFullscreen(!isFullscreen);
      }

      if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setViewMode(viewMode === "network" ? "grid" : "network");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isFullscreen, viewMode]);

  return {
    graph,
    filteredGraph,
    selectedNode,
    highlightedNode,
    connectedNodes,
    viewMode,
    filters,
    isFullscreen,
    isLoading,
    setSelectedNode: handleNodeSelect,
    setHighlightedNode: handleNodeHighlight,
    setViewMode,
    setFilters,
    setFullscreen,
    exportVisualization,
  };
}
