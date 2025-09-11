// Brain structure definitions for neural brain visualization

export interface BrainNode {
  id: string;
  x: number;
  y: number;
  region: BrainRegion;
  baseRadius: number;
  pulsePhase: number;
  activity: number;
  connections: string[];
}

export type BrainRegion =
  | "frontal-left"
  | "frontal-right"
  | "parietal-left"
  | "parietal-right"
  | "temporal-left"
  | "temporal-right"
  | "occipital"
  | "cerebellum"
  | "brainstem"
  | "corpus-callosum";

export const REGION_COLORS: Record<BrainRegion, string> = {
  "frontal-left": "59, 130, 246", // Blue - Logic
  "frontal-right": "139, 92, 246", // Purple - Creativity
  "parietal-left": "79, 110, 226", // Blue-Purple mix
  "parietal-right": "119, 102, 236", // Purple-Blue mix
  "temporal-left": "99, 102, 241", // Indigo
  "temporal-right": "124, 58, 237", // Violet
  occipital: "109, 92, 246", // Mixed
  cerebellum: "89, 102, 236", // Muted purple
  brainstem: "69, 120, 236", // Muted blue
  "corpus-callosum": "94, 111, 241", // Bridge color
};

// Generate brain-shaped node positions
export function generateBrainNodes(
  width: number,
  height: number,
  nodeCount: number = 100,
): BrainNode[] {
  const nodes: BrainNode[] = [];
  const centerX = width / 2;
  const centerY = height / 2;
  const scale = Math.min(width, height) * 0.4;

  // Brain regions with their relative positions and densities
  // Adjusted for better brain shape visualization
  const regions: Array<{
    region: BrainRegion;
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    density: number;
  }> = [
    // Frontal lobes (front/top of brain) - larger and more prominent
    {
      region: "frontal-left",
      centerX: -0.15,
      centerY: -0.3,
      radiusX: 0.25,
      radiusY: 0.3,
      density: 0.18,
    },
    {
      region: "frontal-right",
      centerX: 0.15,
      centerY: -0.3,
      radiusX: 0.25,
      radiusY: 0.3,
      density: 0.18,
    },

    // Parietal lobes (top-middle)
    {
      region: "parietal-left",
      centerX: -0.12,
      centerY: 0,
      radiusX: 0.22,
      radiusY: 0.25,
      density: 0.15,
    },
    {
      region: "parietal-right",
      centerX: 0.12,
      centerY: 0,
      radiusX: 0.22,
      radiusY: 0.25,
      density: 0.15,
    },

    // Temporal lobes (lower sides)
    {
      region: "temporal-left",
      centerX: -0.2,
      centerY: 0.15,
      radiusX: 0.18,
      radiusY: 0.22,
      density: 0.12,
    },
    {
      region: "temporal-right",
      centerX: 0.2,
      centerY: 0.15,
      radiusX: 0.18,
      radiusY: 0.22,
      density: 0.12,
    },

    // Occipital lobe (back/bottom)
    {
      region: "occipital",
      centerX: 0,
      centerY: 0.25,
      radiusX: 0.2,
      radiusY: 0.18,
      density: 0.1,
    },

    // Cerebellum (bottom-back, more compact)
    {
      region: "cerebellum",
      centerX: 0,
      centerY: 0.35,
      radiusX: 0.15,
      radiusY: 0.12,
      density: 0.08,
    },

    // Brainstem (bottom-center, smaller)
    {
      region: "brainstem",
      centerX: 0,
      centerY: 0.4,
      radiusX: 0.08,
      radiusY: 0.15,
      density: 0.04,
    },

    // Corpus callosum (center bridge)
    {
      region: "corpus-callosum",
      centerX: 0,
      centerY: -0.05,
      radiusX: 0.05,
      radiusY: 0.2,
      density: 0.06,
    },
  ];

  let nodeId = 0;

  for (const regionDef of regions) {
    const regionNodeCount = Math.floor(nodeCount * regionDef.density);

    for (let i = 0; i < regionNodeCount; i++) {
      // Generate points within elliptical regions using polar coordinates
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()); // Square root for uniform distribution

      const x =
        centerX +
        regionDef.centerX * scale +
        Math.cos(angle) * radius * regionDef.radiusX * scale;
      const y =
        centerY +
        regionDef.centerY * scale +
        Math.sin(angle) * radius * regionDef.radiusY * scale;

      nodes.push({
        id: `node-${nodeId++}`,
        x,
        y,
        region: regionDef.region,
        baseRadius: 1.5 + Math.random() * 1.5,
        pulsePhase: Math.random() * Math.PI * 2,
        activity: Math.random() * 0.3,
        connections: [],
      });
    }
  }

  // Generate connections based on proximity and region relationships
  generateConnections(nodes);

  return nodes;
}

// Generate connections between nodes
function generateConnections(nodes: BrainNode[]) {
  const maxDistance = 80;
  const maxConnections = 4;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const connections: Array<{ id: string; distance: number }> = [];

    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;

      const other = nodes[j];
      const dx = other.x - node.x;
      const dy = other.y - node.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Prefer connections within regions or to corpus callosum
      const sameRegion = node.region === other.region;
      const connectsToCorpus =
        node.region === "corpus-callosum" || other.region === "corpus-callosum";

      const effectiveDistance = sameRegion
        ? distance * 0.7
        : connectsToCorpus
          ? distance * 0.8
          : distance;

      if (effectiveDistance < maxDistance) {
        connections.push({ id: other.id, distance: effectiveDistance });
      }
    }

    // Sort by distance and take closest connections
    connections.sort((a, b) => a.distance - b.distance);
    node.connections = connections.slice(0, maxConnections).map((c) => c.id);
  }
}

// Calculate signal path between nodes
export function calculateSignalPath(
  from: BrainNode,
  to: BrainNode,
  curvature: number = 0.2,
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // Calculate control point for quadratic curve
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  // Perpendicular offset for curve
  const perpX = -dy * curvature;
  const perpY = dx * curvature;

  const controlX = midX + perpX;
  const controlY = midY + perpY;

  return `M${from.x},${from.y} Q${controlX},${controlY} ${to.x},${to.y}`;
}

// Activity propagation for neural signals
export function propagateActivity(
  nodes: BrainNode[],
  sourceNodeId: string,
  strength: number = 1.0,
  decay: number = 0.7,
): void {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; strength: number }> = [
    { nodeId: sourceNodeId, strength },
  ];

  while (queue.length > 0) {
    const { nodeId, strength: currentStrength } = queue.shift()!;

    if (visited.has(nodeId) || currentStrength < 0.1) continue;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) continue;

    // Update node activity
    node.activity = Math.min(1, node.activity + currentStrength);

    // Propagate to connected nodes
    for (const connectedId of node.connections) {
      if (!visited.has(connectedId)) {
        queue.push({
          nodeId: connectedId,
          strength: currentStrength * decay,
        });
      }
    }
  }
}

// Get region description for tooltips
export function getRegionDescription(region: BrainRegion): string {
  const descriptions: Record<BrainRegion, string> = {
    "frontal-left": "Logic & Analysis",
    "frontal-right": "Creativity & Innovation",
    "parietal-left": "Spatial Processing",
    "parietal-right": "Pattern Recognition",
    "temporal-left": "Language & Memory",
    "temporal-right": "Music & Emotion",
    occipital: "Visual Processing",
    cerebellum: "Motor Control",
    brainstem: "Core Functions",
    "corpus-callosum": "Hemispheric Bridge",
  };

  return descriptions[region] || "Neural Processing";
}
