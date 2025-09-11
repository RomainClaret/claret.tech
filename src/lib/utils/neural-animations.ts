export interface SpikingConfig {
  minInterval: number; // Minimum time between spikes (seconds)
  maxInterval: number; // Maximum time between spikes (seconds)
  signalSpeed: number; // Pixels per second
  spikeDuration: number; // Duration of spike animation (ms)
  signalFadeDistance: number; // Fade trail length in pixels
  spikeScale: number; // How much the node scales during spike
  signalColors: string[]; // Array of RGB color strings
}

export const DEFAULT_SPIKING_CONFIG: SpikingConfig = {
  minInterval: 2,
  maxInterval: 20,
  signalSpeed: 100,
  spikeDuration: 300,
  signalFadeDistance: 50,
  spikeScale: 1.8,
  signalColors: [
    "59, 130, 246", // Blue
    "139, 92, 246", // Purple
    "251, 146, 60", // Orange
    "34, 197, 94", // Green
    "236, 72, 153", // Pink
  ],
};

export function getRandomInterval(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function getRandomColor(colors: string[]): string {
  return colors[Math.floor(Math.random() * colors.length)];
}

export function calculateSignalDuration(
  pathLength: number,
  speed: number,
): number {
  return pathLength / speed;
}

export interface NodeConnection {
  fromNode: { x: number; y: number };
  toNode: { x: number; y: number };
  path?: string; // Optional SVG path for curved connections
  type: "straight" | "curved";
}

export function findConnectedNodes(
  nodeX: number,
  nodeY: number,
  allConnections: NodeConnection[],
): NodeConnection[] {
  return allConnections.filter(
    (conn) =>
      (conn.fromNode.x === nodeX && conn.fromNode.y === nodeY) ||
      (conn.toNode.x === nodeX && conn.toNode.y === nodeY),
  );
}

export function generateSignalPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  curveType?: "quadratic" | "cubic",
): string {
  if (!curveType) {
    return `M${startX},${startY} L${endX},${endY}`;
  }

  if (curveType === "quadratic") {
    const controlX = (startX + endX) / 2 + (Math.random() - 0.5) * 50;
    const controlY = (startY + endY) / 2 + (Math.random() - 0.5) * 50;
    return `M${startX},${startY} Q${controlX},${controlY} ${endX},${endY}`;
  } else {
    const control1X =
      startX + (endX - startX) * 0.33 + (Math.random() - 0.5) * 30;
    const control1Y =
      startY + (endY - startY) * 0.33 + (Math.random() - 0.5) * 30;
    const control2X =
      startX + (endX - startX) * 0.66 + (Math.random() - 0.5) * 30;
    const control2Y =
      startY + (endY - startY) * 0.66 + (Math.random() - 0.5) * 30;
    return `M${startX},${startY} C${control1X},${control1Y} ${control2X},${control2Y} ${endX},${endY}`;
  }
}

export interface ActiveSignal {
  id: string;
  path: string;
  color: string;
  duration: number;
  startTime: number;
}

export class SignalManager {
  private signals: Map<string, ActiveSignal> = new Map();
  private maxConcurrentSignals: number = 50;

  addSignal(signal: ActiveSignal): boolean {
    if (this.signals.size >= this.maxConcurrentSignals) {
      // Remove oldest signal if at capacity
      const oldestSignal = Array.from(this.signals.values()).reduce(
        (oldest, signal) =>
          signal.startTime < oldest.startTime ? signal : oldest,
      );
      this.signals.delete(oldestSignal.id);
    }

    this.signals.set(signal.id, signal);
    return true;
  }

  removeSignal(id: string): void {
    this.signals.delete(id);
  }

  getActiveSignals(): ActiveSignal[] {
    return Array.from(this.signals.values());
  }

  clearExpiredSignals(currentTime: number): void {
    for (const [id, signal] of this.signals.entries()) {
      if (currentTime - signal.startTime > signal.duration * 1000) {
        this.signals.delete(id);
      }
    }
  }
}
