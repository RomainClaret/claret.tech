/**
 * Make localStorage and sessionStorage throw on access, as they do where the
 * browser blocks storage (Chrome's "block all cookies", some webviews): even
 * reading the property raises a SecurityError. Returns a restore function.
 */
export function blockStorage(): () => void {
  const names = ["localStorage", "sessionStorage"] as const;
  const saved = names.map((name) =>
    Object.getOwnPropertyDescriptor(globalThis, name),
  );
  const denied = () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  };
  for (const name of names) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get: denied,
    });
  }
  return () =>
    names.forEach((name, i) => {
      const descriptor = saved[i];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete (globalThis as Record<string, unknown>)[name];
    });
}
