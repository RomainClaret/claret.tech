/**
 * Test helpers for API route testing
 *
 * Clears the API cache between tests, so one test's cached response
 * cannot answer another's.
 */

import { ApiCache } from "@/lib/utils/api-cache";

/**
 * Clear API cache before each test to prevent cache pollution
 */
export function clearApiCache(): void {
  ApiCache.clear();
}
