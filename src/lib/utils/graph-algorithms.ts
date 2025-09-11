import { Publication } from "@/lib/api/fetch-publications";
import { ResearchNodeData } from "@/components/ui/research-node";
import { Paper } from "@/data/sections/papers";

export interface CitationEdge {
  source: string;
  target: string;
  strength: number;
  bidirectional: boolean;
}

export interface CitationGraph {
  nodes: Map<string, ResearchNodeData>;
  edges: CitationEdge[];
  clusters: Map<string, string[]>; // topic -> node ids
}

// Research areas and their associated keywords/venues
const RESEARCH_AREAS = {
  neuroevolution: {
    keywords: ["neural", "evolution", "neuroevolution", "evolving", "genetic"],
    color: "rgb(139, 92, 246)", // Purple
  },
  ml: {
    keywords: [
      "machine learning",
      "deep learning",
      "neural network",
      "ai",
      "artificial intelligence",
    ],
    color: "rgb(59, 130, 246)", // Blue
  },
  nlp: {
    keywords: [
      "natural language",
      "nlp",
      "text",
      "language model",
      "chatbot",
      "question",
      "answering",
    ],
    color: "rgb(34, 197, 94)", // Green
  },
  blockchain: {
    keywords: [
      "blockchain",
      "distributed",
      "ledger",
      "decentralized",
      "crypto",
    ],
    color: "rgb(245, 158, 11)", // Amber
  },
  neuroscience: {
    keywords: [
      "vestibular",
      "perception",
      "neuroscience",
      "brain",
      "cognitive",
    ],
    color: "rgb(236, 72, 153)", // Pink
  },
  general: {
    keywords: [],
    color: "rgb(107, 114, 128)", // Gray
  },
};

// Detect research area from publication or paper
function detectResearchArea(
  pub: Publication | Paper,
): keyof typeof RESEARCH_AREAS {
  const title = pub.title;
  const abstract =
    "abstract" in pub ? pub.abstract : "subtitle" in pub ? pub.subtitle : "";
  const venue = "venue" in pub ? pub.venue : "";
  const text = `${title} ${abstract || ""} ${venue || ""}`.toLowerCase();

  for (const [area, config] of Object.entries(RESEARCH_AREAS)) {
    if (area === "general") continue;

    const hasKeyword = config.keywords.some((keyword) =>
      text.includes(keyword),
    );
    if (hasKeyword) {
      return area as keyof typeof RESEARCH_AREAS;
    }
  }

  return "general";
}

// Calculate influence score based on citations and connections
function calculateInfluence(pub: Publication | Paper): number {
  const citations = "citations" in pub ? pub.citations : 0;
  const year =
    "year" in pub
      ? pub.year
      : "date" in pub
        ? pub.date.split(".")[1]
        : new Date().getFullYear().toString();

  const citationScore = Math.min(1, (citations || 0) / 100);
  const recencyScore = Math.max(
    0,
    1 - (new Date().getFullYear() - parseInt(year)) / 20,
  );
  const connectionScore = 0.5; // Placeholder - would be calculated from actual connections

  return citationScore * 0.5 + recencyScore * 0.3 + connectionScore * 0.2;
}

// Create citation graph from publications
export function createCitationGraph(
  publications: Publication[],
  staticPapers: Paper[],
): CitationGraph {
  const nodes = new Map<string, ResearchNodeData>();
  const edges: CitationEdge[] = [];
  const clusters = new Map<string, string[]>();

  // Initialize clusters
  for (const area of Object.keys(RESEARCH_AREAS)) {
    clusters.set(area, []);
  }

  // Convert publications to nodes
  publications.forEach((pub) => {
    const area = detectResearchArea(pub);
    const influence = calculateInfluence(pub);

    const node: ResearchNodeData = {
      ...pub,
      x: 0, // Will be set by layout algorithm
      y: 0,
      radius: 20 + influence * 30,
      color: RESEARCH_AREAS[area].color,
      influence,
    };

    nodes.set(pub.id, node);
    clusters.get(area)?.push(pub.id);
  });

  // Convert static papers to nodes
  staticPapers.forEach((paper, index) => {
    const area = detectResearchArea(paper);
    const influence = calculateInfluence(paper);
    const id = `static-${index}`;

    // Convert Paper to Publication-like structure
    const node: ResearchNodeData = {
      id,
      title: paper.title,
      authors: [], // Papers don't have authors array
      year: paper.date.split(".")[1] || new Date().getFullYear().toString(),
      venue: undefined,
      citations: 0,
      abstract: paper.subtitle,
      pdfUrl: paper.footerLink.find((link) => link.name === "Paper")?.url,
      source: "static" as const,
      x: 0, // Will be set by layout algorithm
      y: 0,
      radius: 20 + influence * 30,
      color: RESEARCH_AREAS[area].color,
      influence,
    };

    nodes.set(id, node);
    clusters.get(area)?.push(id);
  });

  // Create edges based on various heuristics
  const nodeArray = Array.from(nodes.values());

  for (let i = 0; i < nodeArray.length; i++) {
    const node1 = nodeArray[i];

    for (let j = i + 1; j < nodeArray.length; j++) {
      const node2 = nodeArray[j];

      // Connect papers by same authors
      const sharedAuthors = node1.authors.filter((a1) =>
        node2.authors.some(
          (a2) =>
            a1
              .toLowerCase()
              .includes(a2.split(" ").pop()?.toLowerCase() || "") ||
            a2.toLowerCase().includes(a1.split(" ").pop()?.toLowerCase() || ""),
        ),
      );

      if (sharedAuthors.length > 0) {
        edges.push({
          source: node1.id,
          target: node2.id,
          strength: Math.min(1, sharedAuthors.length / 3),
          bidirectional: true,
        });
        continue;
      }

      // Connect papers in same venue
      if (node1.venue && node2.venue && node1.venue === node2.venue) {
        edges.push({
          source: node1.id,
          target: node2.id,
          strength: 0.3,
          bidirectional: true,
        });
        continue;
      }

      // Connect papers with similar topics (simplified)
      const area1 = detectResearchArea(node1);
      const area2 = detectResearchArea(node2);
      if (area1 === area2 && area1 !== "general") {
        edges.push({
          source: node1.id,
          target: node2.id,
          strength: 0.2,
          bidirectional: true,
        });
      }
    }
  }

  return { nodes, edges, clusters };
}

// Force-directed layout algorithm
export function forceDirectedLayout(
  graph: CitationGraph,
  width: number,
  height: number,
  iterations: number = 100,
): CitationGraph {
  const nodes = Array.from(graph.nodes.values());
  const nodeMap = graph.nodes;

  // Initialize random positions
  nodes.forEach((node) => {
    node.x = Math.random() * width;
    node.y = Math.random() * height;
  });

  // Force simulation parameters
  const repulsionStrength = 5000;
  const attractionStrength = 0.1;
  const centerStrength = 0.01;
  const damping = 0.85;

  // Run simulation
  for (let iter = 0; iter < iterations; iter++) {
    // Apply forces to each node
    nodes.forEach((node) => {
      let fx = 0;
      let fy = 0;

      // Center attraction
      fx += (width / 2 - node.x) * centerStrength;
      fy += (height / 2 - node.y) * centerStrength;

      // Repulsion from other nodes
      nodes.forEach((other) => {
        if (node.id === other.id) return;

        const dx = node.x - other.x;
        const dy = node.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const force = repulsionStrength / (distance * distance);
        fx += (dx / distance) * force;
        fy += (dy / distance) * force;
      });

      // Attraction along edges
      graph.edges.forEach((edge) => {
        if (edge.source !== node.id && edge.target !== node.id) return;

        const otherId = edge.source === node.id ? edge.target : edge.source;
        const other = nodeMap.get(otherId);
        if (!other) return;

        const dx = other.x - node.x;
        const dy = other.y - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const force = distance * attractionStrength * edge.strength;
        fx += (dx / distance) * force;
        fy += (dy / distance) * force;
      });

      // Cluster cohesion
      const nodeCluster = Array.from(graph.clusters.entries()).find(
        ([_, ids]) => ids.includes(node.id),
      );

      if (nodeCluster) {
        const [, clusterNodes] = nodeCluster;
        let clusterCenterX = 0;
        let clusterCenterY = 0;
        let count = 0;

        clusterNodes.forEach((id) => {
          const clusterNode = nodeMap.get(id);
          if (clusterNode && clusterNode.id !== node.id) {
            clusterCenterX += clusterNode.x;
            clusterCenterY += clusterNode.y;
            count++;
          }
        });

        if (count > 0) {
          clusterCenterX /= count;
          clusterCenterY /= count;

          fx += (clusterCenterX - node.x) * 0.05;
          fy += (clusterCenterY - node.y) * 0.05;
        }
      }

      // Apply forces with damping
      node.x += fx * damping;
      node.y += fy * damping;

      // Keep within bounds
      node.x = Math.max(50, Math.min(width - 50, node.x));
      node.y = Math.max(50, Math.min(height - 50, node.y));
    });
  }

  // Update the node positions in the graph
  nodes.forEach((node) => {
    nodeMap.set(node.id, node);
  });

  return graph;
}

// Filter graph based on criteria
export function filterGraph(
  graph: CitationGraph,
  filters: {
    yearRange: [number, number];
    minCitations: number;
    searchQuery: string;
    showTheses: boolean;
    showPapers: boolean;
    showPosters: boolean;
  },
): CitationGraph {
  const filteredNodes = new Map<string, ResearchNodeData>();
  const filteredEdges: CitationEdge[] = [];
  const filteredClusters = new Map<string, string[]>();

  // Filter nodes
  graph.nodes.forEach((node, id) => {
    const year = parseInt(node.year);
    const citations = node.citations || 0;
    const title = node.title.toLowerCase();
    const isThesis = title.includes("thesis");
    const isPoster = title.includes("poster");
    const isPaper = !isThesis && !isPoster;

    // Check filters
    if (year < filters.yearRange[0] || year > filters.yearRange[1]) return;
    if (citations < filters.minCitations) return;
    if (
      filters.searchQuery &&
      !title.includes(filters.searchQuery.toLowerCase())
    )
      return;
    if (isThesis && !filters.showTheses) return;
    if (isPaper && !filters.showPapers) return;
    if (isPoster && !filters.showPosters) return;

    filteredNodes.set(id, node);
  });

  // Filter edges
  graph.edges.forEach((edge) => {
    if (filteredNodes.has(edge.source) && filteredNodes.has(edge.target)) {
      filteredEdges.push(edge);
    }
  });

  // Filter clusters
  graph.clusters.forEach((nodeIds, area) => {
    const filtered = nodeIds.filter((id) => filteredNodes.has(id));
    if (filtered.length > 0) {
      filteredClusters.set(area, filtered);
    }
  });

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    clusters: filteredClusters,
  };
}
