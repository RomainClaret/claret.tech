/**
 * SVG validation utilities for circle radius and other SVG attributes
 */

/**
 * Validates and normalizes a circle radius value, ensuring it's never undefined or invalid.
 * This prevents SVG rendering errors from undefined radius values.
 *
 * @param radius - The radius value to validate (can be any type due to React prop handling)
 * @param fallback - Default radius to use if validation fails (defaults to "4")
 * @param _component - Component name for debugging (currently unused but kept for compatibility)
 * @param _context - Additional context for debugging (currently unused but kept for compatibility)
 * @returns A valid string radius value
 */
export const validateRadius = (
  radius: unknown,
  fallback: string = "4",
  _component?: string,
  _context?: unknown,
): string => {
  // Check for invalid values BEFORE converting to string
  if (
    radius === undefined ||
    radius === null ||
    (typeof radius === "number" && isNaN(radius))
  ) {
    return fallback;
  }

  const stringRadius = String(radius);
  if (
    !stringRadius ||
    stringRadius === "" ||
    stringRadius === "undefined" ||
    stringRadius === "NaN" ||
    stringRadius === "null"
  ) {
    return fallback;
  }

  // Final safety check - ensure we never return undefined
  const result = stringRadius || fallback;
  return result;
};
