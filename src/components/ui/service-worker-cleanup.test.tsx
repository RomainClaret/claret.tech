import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ServiceWorkerCleanup } from "./service-worker-cleanup";

/**
 * The site's service worker is retired. A browser that registered it still
 * runs it and keeps its cache; any visit with scripts removes both, and
 * nothing else: on localhost other projects' workers can share the origin,
 * and WebLLM keeps the AI terminal's model (about 1 GB) in Cache Storage.
 */

const worker = (path: string) => ({
  scriptURL: `http://localhost:3000${path}`,
});
const registration = (state: Record<string, { scriptURL: string }>) => ({
  ...state,
  unregister: vi.fn(async () => true),
});

let registrations: ReturnType<typeof registration>[] = [];
let cacheNames: string[] = [];
const register = vi.fn();
const deleteCache = vi.fn(async () => true);

beforeEach(() => {
  registrations = [];
  cacheNames = [];
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistrations: async () => registrations,
      register,
    },
  });
  vi.stubGlobal("caches", {
    keys: async () => cacheNames,
    delete: deleteCache,
  });
});

afterEach(() => {
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("ServiceWorkerCleanup", () => {
  it("unregisters the site's worker, and no other", async () => {
    const active = registration({ active: worker("/sw.js") });
    const installing = registration({ installing: worker("/sw.js") });
    const other = registration({ active: worker("/other-project/sw.js") });
    registrations = [active, installing, other];

    render(<ServiceWorkerCleanup />);

    await waitFor(() => expect(active.unregister).toHaveBeenCalled());
    expect(installing.unregister).toHaveBeenCalled();
    expect(other.unregister).not.toHaveBeenCalled();
  });

  it("deletes the site's own caches, and keeps WebLLM's", async () => {
    cacheNames = ["claret-tech-v5", "claret-tech-v6", "webllm/model"];

    render(<ServiceWorkerCleanup />);

    await waitFor(() => expect(deleteCache).toHaveBeenCalledTimes(2));
    expect(deleteCache).toHaveBeenCalledWith("claret-tech-v5");
    expect(deleteCache).toHaveBeenCalledWith("claret-tech-v6");
  });

  it("never registers a worker, in production either", async () => {
    // It registered on the window "load" event, in production builds.
    vi.stubEnv("NODE_ENV", "production");

    render(<ServiceWorkerCleanup />);
    window.dispatchEvent(new Event("load"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(register).not.toHaveBeenCalled();
  });

  it("does nothing where neither service workers nor caches exist", () => {
    // Plain http on another host is not a secure context: no API at all.
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    vi.stubGlobal("caches", undefined);
    delete (window as { caches?: unknown }).caches;

    expect(() => render(<ServiceWorkerCleanup />)).not.toThrow();
  });
});
