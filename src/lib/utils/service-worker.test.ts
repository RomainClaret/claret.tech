import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * public/sw.js, run against a stand-in worker scope and Cache Storage. Cache
 * Storage belongs to the whole origin: WebLLM keeps the AI terminal's model
 * there (about 1 GB), and the worker used to delete every cache but its own
 * current one whenever a new version activated.
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
  const self = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers[type] = handler;
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
  return { dispatch, deleted, fetched };
}

/** Activate the worker with these caches present; return what it deletes. */
async function activateWith(cacheNames: string[]) {
  const worker = loadWorker(cacheNames);
  await worker.dispatch("activate");
  return worker.deleted;
}

describe("service worker", () => {
  it("deletes only the site's own old caches", async () => {
    const deleted = await activateWith([
      "claret-tech-v5",
      "claret-tech-v6",
      "webllm/model",
      "webllm/config",
      "webllm/wasm",
    ]);

    expect(deleted).toEqual(["claret-tech-v5"]);
  });
  it("fetches nothing to install", async () => {
    // It used to precache the web manifest, which it never serves.
    const worker = loadWorker();

    await worker.dispatch("install");

    expect(worker.fetched).toEqual([]);
  });
});
