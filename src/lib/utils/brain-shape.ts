// Predefined brain shape coordinates for accurate visualization

export interface BrainPoint {
  x: number;
  y: number;
  region: string;
}

// Create brain outline path using normalized coordinates (-1 to 1)
export function getBrainOutline(): { left: BrainPoint[]; right: BrainPoint[] } {
  // Brain outline points (normalized -1 to 1)
  // These create the characteristic brain shape viewed from above

  const leftHemisphere: BrainPoint[] = [
    // Frontal lobe (front-top) - wide dome shape
    { x: -0.02, y: -0.5, region: "frontal-left" }, // Top center
    { x: -0.1, y: -0.52, region: "frontal-left" },
    { x: -0.2, y: -0.53, region: "frontal-left" },
    { x: -0.3, y: -0.52, region: "frontal-left" },
    { x: -0.38, y: -0.48, region: "frontal-left" },
    { x: -0.44, y: -0.42, region: "frontal-left" },
    { x: -0.48, y: -0.35, region: "frontal-left" },
    { x: -0.5, y: -0.25, region: "frontal-left" },
    { x: -0.51, y: -0.15, region: "frontal-left" },

    // Parietal lobe (top-middle) - slight inward curve
    { x: -0.5, y: -0.05, region: "parietal-left" },
    { x: -0.48, y: 0.05, region: "parietal-left" },
    { x: -0.45, y: 0.12, region: "parietal-left" },

    // Temporal lobe (side bulge) - characteristic protrusion
    { x: -0.46, y: 0.18, region: "temporal-left" },
    { x: -0.48, y: 0.25, region: "temporal-left" }, // Maximum bulge
    { x: -0.47, y: 0.32, region: "temporal-left" },
    { x: -0.44, y: 0.38, region: "temporal-left" },
    { x: -0.38, y: 0.42, region: "temporal-left" },
    { x: -0.3, y: 0.44, region: "temporal-left" },

    // Occipital lobe (back) - rounded
    { x: -0.22, y: 0.45, region: "occipital" },
    { x: -0.15, y: 0.46, region: "occipital" },
    { x: -0.08, y: 0.45, region: "occipital" },

    // Cerebellum (bottom-back) - small bulge below occipital
    { x: -0.12, y: 0.48, region: "cerebellum" },
    { x: -0.15, y: 0.52, region: "cerebellum" },
    { x: -0.12, y: 0.55, region: "cerebellum" },
    { x: -0.08, y: 0.56, region: "cerebellum" },
    { x: -0.04, y: 0.55, region: "cerebellum" },

    // Brain stem (bottom) - narrow taper
    { x: -0.03, y: 0.52, region: "brainstem" },
    { x: -0.02, y: 0.48, region: "brainstem" },
    { x: -0.01, y: 0.4, region: "brainstem" },
  ];

  // Mirror for right hemisphere
  const rightHemisphere: BrainPoint[] = leftHemisphere.map((point) => ({
    x: -point.x,
    y: point.y,
    region: point.region
      .replace("-left", "-right")
      .replace("occipital", "occipital")
      .replace("cerebellum", "cerebellum")
      .replace("brainstem", "brainstem"),
  }));

  return { left: leftHemisphere, right: rightHemisphere };
}

// Generate points within brain shape
export function generateBrainShapeNodes(
  width: number,
  height: number,
  nodeCount: number = 120,
): Array<{ x: number; y: number; region: string }> {
  const nodes: Array<{ x: number; y: number; region: string }> = [];
  const centerX = width / 2;
  const centerY = height / 2;
  const scale = Math.min(width, height) * 0.45;

  const outline = getBrainOutline();
  const allOutlinePoints = [...outline.left, ...outline.right];

  // Add outline nodes first (about 50% of nodes for clearer shape)
  const outlineNodeCount = Math.floor(nodeCount * 0.5);

  // Distribute nodes along the outline more densely
  for (let i = 0; i < outlineNodeCount; i++) {
    const t = i / outlineNodeCount;
    const pointIndex = Math.floor(t * allOutlinePoints.length);
    const nextIndex = (pointIndex + 1) % allOutlinePoints.length;
    const point = allOutlinePoints[pointIndex];
    const nextPoint = allOutlinePoints[nextIndex];

    // Interpolate between points for smoother outline
    const localT = t * allOutlinePoints.length - pointIndex;
    const x = point.x + (nextPoint.x - point.x) * localT;
    const y = point.y + (nextPoint.y - point.y) * localT;

    // Add very slight randomization
    const jitter = 0.01;
    nodes.push({
      x: centerX + (x + (Math.random() - 0.5) * jitter) * scale,
      y: centerY + (y + (Math.random() - 0.5) * jitter) * scale,
      region: point.region,
    });
  }

  // Fill interior with remaining nodes
  const interiorNodeCount = nodeCount - outlineNodeCount;

  // Define interior regions - adjusted for new brain shape
  const interiorRegions = [
    // Frontal interior - larger area
    {
      cx: -0.25,
      cy: -0.35,
      rx: 0.18,
      ry: 0.12,
      region: "frontal-left",
      weight: 0.18,
    },
    {
      cx: 0.25,
      cy: -0.35,
      rx: 0.18,
      ry: 0.12,
      region: "frontal-right",
      weight: 0.18,
    },

    // Parietal interior
    {
      cx: -0.25,
      cy: -0.1,
      rx: 0.15,
      ry: 0.15,
      region: "parietal-left",
      weight: 0.14,
    },
    {
      cx: 0.25,
      cy: -0.1,
      rx: 0.15,
      ry: 0.15,
      region: "parietal-right",
      weight: 0.14,
    },

    // Temporal interior - in the bulges
    {
      cx: -0.35,
      cy: 0.25,
      rx: 0.12,
      ry: 0.12,
      region: "temporal-left",
      weight: 0.1,
    },
    {
      cx: 0.35,
      cy: 0.25,
      rx: 0.12,
      ry: 0.12,
      region: "temporal-right",
      weight: 0.1,
    },

    // Central structures
    {
      cx: 0,
      cy: -0.15,
      rx: 0.03,
      ry: 0.25,
      region: "corpus-callosum",
      weight: 0.08,
    },
    { cx: 0, cy: 0.35, rx: 0.12, ry: 0.08, region: "occipital", weight: 0.06 },
    { cx: 0, cy: 0.5, rx: 0.08, ry: 0.05, region: "cerebellum", weight: 0.06 },
    { cx: 0, cy: 0.45, rx: 0.02, ry: 0.08, region: "brainstem", weight: 0.04 },
  ];

  for (const region of interiorRegions) {
    const regionNodeCount = Math.floor(interiorNodeCount * region.weight);

    for (let i = 0; i < regionNodeCount; i++) {
      // Generate points within elliptical regions
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());

      const x = centerX + (region.cx + Math.cos(angle) * r * region.rx) * scale;
      const y = centerY + (region.cy + Math.sin(angle) * r * region.ry) * scale;

      nodes.push({
        x,
        y,
        region: region.region,
      });
    }
  }

  return nodes;
}

// Check if a point is inside the brain shape
export function isPointInBrain(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  scale: number,
): boolean {
  // Normalize coordinates
  const nx = (x - centerX) / scale;
  const ny = (y - centerY) / scale;

  // Simple elliptical brain boundary check
  // Top part (cerebrum) - wider ellipse
  if (ny < 0.2) {
    const radiusX = 0.48;
    const radiusY = 0.45;
    const topCheck =
      (nx * nx) / (radiusX * radiusX) +
      ((ny + 0.1) * (ny + 0.1)) / (radiusY * radiusY);
    if (topCheck > 1) return false;
  }

  // Bottom part (cerebellum/brainstem) - narrower
  if (ny > 0.2) {
    const radiusX = 0.25 - ny * 0.3; // Narrows as it goes down
    const radiusY = 0.3;
    const bottomCheck =
      (nx * nx) / (radiusX * radiusX) +
      ((ny - 0.3) * (ny - 0.3)) / (radiusY * radiusY);
    if (bottomCheck > 1) return false;
  }

  // Check for central fissure (gap between hemispheres)
  if (Math.abs(nx) < 0.03 && ny < 0.1) {
    return Math.random() > 0.7; // 30% chance of node in the fissure
  }

  return true;
}
