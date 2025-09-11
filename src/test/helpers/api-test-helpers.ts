/**
 * Test helpers for API route testing
 *
 * Provides utilities for isolating API tests and managing cache state
 * to prevent test interference.
 */

import { vi, beforeEach, afterEach } from "vitest";
import { ApiCache } from "@/lib/utils/api-cache";

/**
 * Clear API cache before each test to prevent cache pollution
 */
export function clearApiCache(): void {
  ApiCache.clear();
}

/**
 * Mock the API cache for testing with predictable behavior
 */
export function mockApiCache() {
  const mockGet = vi.fn();
  const mockSet = vi.fn();
  const mockDelete = vi.fn();
  const mockClear = vi.fn();

  vi.spyOn(ApiCache, "get").mockImplementation(mockGet);
  vi.spyOn(ApiCache, "set").mockImplementation(mockSet);
  vi.spyOn(ApiCache, "delete").mockImplementation(mockDelete);
  vi.spyOn(ApiCache, "clear").mockImplementation(mockClear);

  return {
    mockGet,
    mockSet,
    mockDelete,
    mockClear,
  };
}

/**
 * Run a test with isolated modules to prevent cache leakage
 * Note: vi.isolateModules is not available in current Vitest version
 */
export function isolateApiTest<T>(testFn: () => T): T {
  vi.resetModules();
  clearApiCache();
  return testFn();
}

/**
 * Setup common beforeEach hooks for API tests
 */
export function setupApiTestHooks() {
  beforeEach(() => {
    vi.clearAllMocks();
    clearApiCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    clearApiCache();
  });
}
