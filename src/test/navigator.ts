/**
 * Override navigator properties for a test, and put them back.
 *
 * Tests share one worker (singleFork), so an override outlives its file
 * unless it is restored. Several defined them without `configurable`, which
 * made them permanent: a later file could neither redefine nor delete them,
 * and probe.test.ts then failed all nine of its tests, or the context utils
 * failed every test, depending on the file order. Stub with stubNavigator
 * and call restoreNavigator in afterEach.
 */

const saved = new Map<string, PropertyDescriptor | undefined>();
const props = navigator as unknown as Record<string, unknown>;

export function stubNavigator(key: string, value: unknown): void {
  const current = Object.getOwnPropertyDescriptor(navigator, key);
  if (!saved.has(key)) saved.set(key, current);
  if (current && !current.configurable) {
    // Left non-configurable by an older override: only its value can change.
    props[key] = value;
    return;
  }
  Object.defineProperty(navigator, key, {
    value,
    writable: true,
    configurable: true,
  });
}

export function restoreNavigator(): void {
  saved.forEach((descriptor, key) => {
    const current = Object.getOwnPropertyDescriptor(navigator, key);
    if (current && !current.configurable) {
      if (descriptor && "value" in descriptor) props[key] = descriptor.value;
    } else if (descriptor) {
      Object.defineProperty(navigator, key, descriptor);
    } else {
      delete props[key];
    }
  });
  saved.clear();
}
