/**
 * A working in-memory Storage for tests that need values to round-trip.
 *
 * The setup file replaces localStorage with stubs that remember nothing, and
 * context-test-utils does the same to sessionStorage for the rest of the
 * worker, so a test cannot rely on the global it inherits. Install one with
 * vi.stubGlobal("sessionStorage", memoryStorage()) and undo it with
 * vi.unstubAllGlobals().
 */
export function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, String(value)),
  };
}
