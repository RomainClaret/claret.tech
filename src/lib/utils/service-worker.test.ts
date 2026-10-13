import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * public/sw.js, run against a stand-in worker scope and Cache Storage.
 *
 * The site no longer uses a service worker. Browsers that registered an
 * earlier one still run it, and fetch this file on their next update
 * check: it must take over at once, delete the site's own caches and
 * unregister itself. Cache Storage belongs to the whole origin: WebLLM
 * keeps the AI terminal's model there (about 1 GB), and an earlier worker
 * deleted every cache but its own whenever a new version activated.
 */

const workerSource = readFileSync(
  path.resolve(__dirname, "../../../public/sw.js"),
  "utf8",
);

/** Load the worker against stand-ins, with these caches present. */
function loadWorker(cacheNames: string[] = []) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const deleted: string[] = [];
  const fetched: string[] = [];
  const calls: string[] = [];
  const self = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers[type] = handler;
    },
    skipWaiting: async () => {
      calls.push("skipWaiting");
    },
    registration: {
      unregister: async () => {
        // After the caches: an unregistered worker may be stopped at once.
        calls.push(`unregister after deleting ${deleted.length}`);
        return true;
      },
    },
  };
  const caches = {
    keys: async () => cacheNames,
    delete: async (name: string) => {
      deleted.push(name);
      return true;
    },
    open: async () => ({ put: async () => {} }),
  };
  const fetch = async (url: string) => {
    fetched.push(url);
    return new Response("");
  };
  new Function("self", "caches", "fetch", workerSource)(self, caches, fetch);

  /** Dispatch a lifecycle event, if handled, and wait for its work. */
  const dispatch = (type: string) => {
    let settled: Promise<unknown> = Promise.resolve();
    handlers[type]?.({
      waitUntil: (work: Promise<unknown>) => {
        settled = work;
      },
    });
    return settled;
  };
  return { dispatch, deleted, fetched, calls, handlers };
}

describe("service worker", () => {
  it("deletes the site's own caches, and only those, then unregisters", async () => {
    const worker = loadWorker([
      "claret-tech-v5",
      "claret-tech-v6",
      "webllm/model",
      "webllm/config",
      "webllm/wasm",
    ]);

    await worker.dispatch("activate");

    expect(worker.deleted).toEqual(["claret-tech-v5", "claret-tech-v6"]);
    expect(worker.calls).toContain("unregister after deleting 2");
  });

  it("takes over at once, so an old worker does not keep serving", async () => {
    const worker = loadWorker();

    await worker.dispatch("install");

    expect(worker.calls).toContain("skipWaiting");
  });

  it("serves nothing", () => {
    // The old worker answered /images, /fonts and /animations from its own
    // cache, which the HTTP cache already keeps for a year as immutable.
    expect(loadWorker().handlers.fetch).toBeUndefined();
  });

  it("fetches nothing to install", async () => {
    // It used to precache the web manifest, which it never serves.
    const worker = loadWorker();

    await worker.dispatch("install");

    expect(worker.fetched).toEqual([]);
  });
});
