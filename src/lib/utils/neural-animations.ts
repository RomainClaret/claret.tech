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
