/**
 * The render quality tiers.
 *
 * Lives here rather than in quality-context so the pure decision logic in
 * decide.ts can use it without importing a React context, which would be a
 * cycle. quality-context re-exports it, so existing imports are unaffected.
 */
export enum QualityMode {
  BATTERY_SAVER = "battery",
  LOW = "low",
  BALANCED = "balanced",
  MAXIMUM = "maximum",
}
