/**
 * Request-scoped API caching utility
 *
 * Provides in-memory caching for API routes without module-level state
 * that can cause issues in tests. Uses a Map for better cache management.
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

// Global cache store - but we'll provide methods to clear it for testing
const apiCache = new Map<string, CacheEntry>();

export class ApiCache {
  private static readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  /**
   * Get cached data if it exists and is still valid
   */
  static get<T>(key: string): T | null {
    const entry = apiCache.get(key);

    if (!entry) {
      return null;
    }

    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > this.CACHE_DURATION) {
      apiCache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set data in cache with current timestamp
   */
  static set<T>(key: string, data: T): void {
    apiCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear specific cache entry
   */
  static delete(key: string): void {
    apiCache.delete(key);
  }

  /**
   * Clear all cache entries (useful for tests)
   */
  static clear(): void {
    apiCache.clear();
  }

  /**
   * Get cache statistics (useful for debugging)
   */
  static getStats() {
    return {
      size: apiCache.size,
      keys: Array.from(apiCache.keys()),
    };
  }
}
