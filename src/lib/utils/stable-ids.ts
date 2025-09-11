/**
 * Stable ID generation utility for React components
 * Provides counter-based unique IDs that remain stable across re-renders
 * and component remounting due to quality/animation mode changes.
 */

// Global counters for different component types
const counters = {
  star: 0,
  signal: 0,
  gridSignal: 0,
  toast: 0,
  particle: 0,
  node: 0,
};

export type ComponentType = keyof typeof counters;

/**
 * Generates a stable unique ID for a component type
 * Uses incrementing counters instead of timestamps to avoid React key collisions
 *
 * @param componentType - The type of component requesting an ID
 * @param suffix - Optional additional identifier for uniqueness
 * @returns A unique stable ID string
 */
export function generateStableId(
  componentType: ComponentType,
  suffix?: string | number,
): string {
  counters[componentType] += 1;
  const baseId = `${componentType}-${counters[componentType]}`;
  return suffix !== undefined ? `${baseId}-${suffix}` : baseId;
}

/**
 * Resets a specific counter (use sparingly - only on major state changes)
 *
 * @param componentType - The counter to reset
 */
export function resetCounter(componentType: ComponentType): void {
  counters[componentType] = 0;
}

/**
 * Resets all counters (use only on page refresh or major app state reset)
 */
export function resetAllCounters(): void {
  Object.keys(counters).forEach((key) => {
    counters[key as ComponentType] = 0;
  });
}

/**
 * Gets current counter value without incrementing
 *
 * @param componentType - The counter type to check
 * @returns Current counter value
 */
export function getCounterValue(componentType: ComponentType): number {
  return counters[componentType];
}
