// Brain node and connection data for neural network visualization
// Positions are in coordinate space (centered at 0,0)

export interface BrainNode {
  id: string;
  x: number;
  y: number;
  size: "small" | "medium" | "large";
  radius: number;
}

export interface BrainConnection {
  from: string;
  to: string;
  strength: number;
}

// Generate random internal nodes within brain boundary
export function generateInternalNodes(): BrainNode[] {
  const internalNodes: BrainNode[] = [];

  // Define brain boundary regions for random placement
  // These are approximate zones within the brain contour
  const regions = [
    // Upper brain region
    { minX: -120, maxX: 80, minY: -120, maxY: -60 },
    // Middle brain region
    { minX: -140, maxX: 120, minY: -60, maxY: 20 },
    // Lower brain region
    { minX: -100, maxX: 100, minY: 20, maxY: 70 },
  ];

  for (let i = 1; i <= 10; i++) {
    // Select a random region for this node
    const region = regions[Math.floor(Math.random() * regions.length)];

    // Generate random position within the selected region
    const x = region.minX + Math.random() * (region.maxX - region.minX);
    const y = region.minY + Math.random() * (region.maxY - region.minY);

    internalNodes.push({
      id: `node${i}`,
      x,
      y,
      size: "small",
      radius: 14.25,
    });
  }

  return internalNodes;
}

// Combine contour nodes with dynamically positioned internal nodes
export const BRAIN_NODES: BrainNode[] = [
  // BRAIN CONTOUR NODES - These form the outer boundary of the brain shape
  { id: "contour1", x: 25.5, y: -148.5, size: "small", radius: 14.25 },
  { id: "contour2", x: -16, y: -148.5, size: "small", radius: 14.25 },
  { id: "contour3", x: -87.5, y: -140, size: "small", radius: 14.25 },
  { id: "contour4", x: -155, y: -94.5, size: "small", radius: 14.25 },
  { id: "contour5", x: -174.5, y: -67.5, size: "small", radius: 14.25 },
  { id: "contour6", x: -183.5, y: -21, size: "small", radius: 14.25 },
  { id: "contour7", x: -155, y: 43.5, size: "small", radius: 14.25 },
  { id: "contour8", x: -127, y: 43.5, size: "small", radius: 14.25 },
  { id: "contour9", x: -84, y: 33.5, size: "small", radius: 14.25 },
  { id: "contour10", x: -94, y: 70, size: "small", radius: 14.25 },
  { id: "contour11", x: -79.5, y: 94.5, size: "small", radius: 14.25 },
  { id: "contour12", x: 28.5, y: 71.5, size: "small", radius: 14.25 },
  { id: "contour13", x: 88, y: 153.5, size: "small", radius: 14.25 },
  { id: "contour14", x: 74.375, y: 70.375, size: "small", radius: 14.25 },
  { id: "contour15", x: 140, y: 86, size: "small", radius: 14.25 },
  { id: "contour16", x: 169, y: 72, size: "small", radius: 14.25 },
  { id: "contour17", x: 181, y: 52, size: "small", radius: 14.25 },
  { id: "contour18", x: 184.5, y: 23.5, size: "small", radius: 14.25 },
  { id: "contour19", x: 177.5, y: -22.5, size: "small", radius: 14.25 },
  { id: "contour20", x: 152, y: -69, size: "small", radius: 14.25 },
  { id: "contour21", x: 121, y: -108.5, size: "small", radius: 14.25 },
  { id: "contour22", x: 100.5, y: -123.5, size: "small", radius: 14.25 },
  { id: "contour23", x: 72, y: -136, size: "small", radius: 14.25 },
  { id: "contour24", x: 50, y: -144.5, size: "small", radius: 14.25 },

  // Add dynamically positioned internal nodes
  ...generateInternalNodes(),
];

// Static brain contour connections - these form the brain outline
export const BRAIN_CONTOUR_CONNECTIONS: BrainConnection[] = [
  // CRITICAL: BRAIN CONTOUR CONNECTIONS - These form the visible brain outline
  // Sequential connections create the brain silhouette
  { from: "contour1", to: "contour2", strength: 0.9 },
  { from: "contour2", to: "contour3", strength: 0.9 },
  { from: "contour3", to: "contour4", strength: 0.9 },
  { from: "contour4", to: "contour5", strength: 0.9 },
  { from: "contour5", to: "contour6", strength: 0.9 },
  { from: "contour6", to: "contour7", strength: 0.9 },
  { from: "contour7", to: "contour8", strength: 0.9 },
  { from: "contour8", to: "contour9", strength: 0.9 },
  { from: "contour9", to: "contour10", strength: 0.9 },
  { from: "contour10", to: "contour11", strength: 0.9 },
  { from: "contour11", to: "contour12", strength: 0.9 },
  { from: "contour12", to: "contour13", strength: 0.9 },
  { from: "contour13", to: "contour14", strength: 0.9 },
  { from: "contour14", to: "contour15", strength: 0.9 },
  { from: "contour15", to: "contour16", strength: 0.9 },
  { from: "contour16", to: "contour17", strength: 0.9 },
  { from: "contour17", to: "contour18", strength: 0.9 },
  { from: "contour18", to: "contour19", strength: 0.9 },
  { from: "contour19", to: "contour20", strength: 0.9 },
  { from: "contour20", to: "contour21", strength: 0.9 },
  { from: "contour21", to: "contour22", strength: 0.9 },
  { from: "contour22", to: "contour23", strength: 0.9 },
  { from: "contour23", to: "contour24", strength: 0.9 },
  { from: "contour24", to: "contour1", strength: 0.9 }, // Close the loop

  // Additional contour connections for brain structure
  { from: "contour12", to: "contour14", strength: 0.6 }, // Bottom connection
  { from: "contour3", to: "contour21", strength: 0.5 }, // Top cross connection
];

// Function to generate random internal connections
export function generateInternalConnections(): BrainConnection[] {
  const connections: BrainConnection[] = [];
  const internalNodes = [
    "node1",
    "node2",
    "node3",
    "node4",
    "node5",
    "node6",
    "node7",
    "node8",
    "node9",
    "node10",
  ];
  const contourNodes = Array.from({ length: 24 }, (_, i) => `contour${i + 1}`);

  // Create a set to track unique connections
  const connectionSet = new Set<string>();

  // Generate 10-15 random internal-to-internal connections
  const numInternalConnections = 10 + Math.floor(Math.random() * 6);

  for (let i = 0; i < numInternalConnections; i++) {
    const fromIdx = Math.floor(Math.random() * internalNodes.length);
    let toIdx = Math.floor(Math.random() * internalNodes.length);

    // Ensure we don't connect a node to itself
    while (toIdx === fromIdx) {
      toIdx = Math.floor(Math.random() * internalNodes.length);
    }

    const from = internalNodes[fromIdx];
    const to = internalNodes[toIdx];
    const key = `${from}-${to}`;
    const reverseKey = `${to}-${from}`;

    // Avoid duplicate connections
    if (!connectionSet.has(key) && !connectionSet.has(reverseKey)) {
      connectionSet.add(key);
      connections.push({
        from,
        to,
        strength: 0.3 + Math.random() * 0.3, // Random strength between 0.3 and 0.6
      });
    }
  }

  // IMPORTANT: Connect each internal node to at least 1-2 contour nodes
  // This ensures the internal network appears integrated with the brain outline
  for (const internalNode of internalNodes) {
    const numConnectionsPerNode = 1 + Math.floor(Math.random() * 2); // 1 or 2 connections per node

    for (let i = 0; i < numConnectionsPerNode; i++) {
      // Select random contour nodes, with preference for nearby ones
      const contourIdx = Math.floor(Math.random() * contourNodes.length);
      const key = `${internalNode}-${contourNodes[contourIdx]}`;

      if (!connectionSet.has(key)) {
        connectionSet.add(key);
        connections.push({
          from: internalNode,
          to: contourNodes[contourIdx],
          strength: 0.4 + Math.random() * 0.3, // Stronger connections to contour (0.4-0.7)
        });
      }
    }
  }

  // Add some additional random contour-to-internal connections for variety
  const numExtraContourConnections = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < numExtraContourConnections; i++) {
    const internalIdx = Math.floor(Math.random() * internalNodes.length);
    const contourIdx = Math.floor(Math.random() * contourNodes.length);
    const key = `${contourNodes[contourIdx]}-${internalNodes[internalIdx]}`;

    if (!connectionSet.has(key)) {
      connectionSet.add(key);
      connections.push({
        from: contourNodes[contourIdx],
        to: internalNodes[internalIdx],
        strength: 0.3 + Math.random() * 0.2, // Medium strength (0.3-0.5)
      });
    }
  }

  return connections;
}

// Combine static contour with dynamic internal connections
export const BRAIN_CONNECTIONS: BrainConnection[] = [
  ...BRAIN_CONTOUR_CONNECTIONS,
  ...generateInternalConnections(),
];

// Transform coordinates to canvas coordinates
export function transformToCanvas(
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  // Node positions are relative to origin at (0,0)
  // We need to transform to canvas space

  // Normalize to -1 to 1 range
  const normalizedX = x / 200; // Half-width of original coordinate system
  const normalizedY = y / 200; // Half-height of original coordinate system

  // Transform to canvas space with padding to prevent clipping
  const scale = 0.45; // Reduced to fit within canvas
  const padding = 20; // Minimum distance from edges

  let canvasX = canvasWidth / 2 + normalizedX * canvasWidth * scale;
  let canvasY = canvasHeight / 2 + normalizedY * canvasHeight * scale;

  // Clamp to ensure nodes stay within canvas bounds
  canvasX = Math.max(padding, Math.min(canvasWidth - padding, canvasX));
  canvasY = Math.max(padding, Math.min(canvasHeight - padding, canvasY));

  return { x: canvasX, y: canvasY };
}

// Get node radius based on canvas size
export function getNodeRadius(node: BrainNode, canvasSize: number): number {
  const scale = canvasSize / 400; // Scale relative to original size

  switch (node.size) {
    case "large":
      return 20 * scale; // Increased for visibility
    case "medium":
      return 12 * scale;
    case "small":
      return 6 * scale;
    default:
      return 6 * scale;
  }
}
