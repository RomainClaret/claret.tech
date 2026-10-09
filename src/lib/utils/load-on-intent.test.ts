import { describe, it, expect, vi } from "vitest";
import { loadOnIntent } from "./load-on-intent";

/**
 * Lazily loaded modules (the PDF reader, the terminal, the legal texts) are
 * fetched once, when first wanted: on intent or when first rendered.
 */
describe("loadOnIntent", () => {
  it("does not fetch until asked", () => {
    const importer = vi.fn(() => Promise.resolve({ value: 1 }));

    loadOnIntent(importer);

    expect(importer).not.toHaveBeenCalled();
  });

  it("fetches once and shares the result", async () => {
    const importer = vi.fn(() => Promise.resolve({ value: 1 }));
    const module = loadOnIntent(importer);

    module.preload();
    module.preload();
    const loaded = await module.load();

    expect(importer).toHaveBeenCalledTimes(1);
    expect(loaded).toEqual({ value: 1 });
    expect(await module.load()).toBe(loaded);
  });

  it("tries again after a failed fetch", async () => {
    const importer = vi
      .fn<() => Promise<{ value: number }>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ value: 2 });
    const module = loadOnIntent(importer);

    await expect(module.load()).rejects.toThrow("offline");
    expect(await module.load()).toEqual({ value: 2 });
    expect(importer).toHaveBeenCalledTimes(2);
  });

  it("keeps a failed preload quiet", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const module = loadOnIntent(() => Promise.reject(new Error("offline")));

      module.preload();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
  it("gives what loaded synchronously, from a load or a preload", async () => {
    // For a renderer that must not wait a frame to learn the chunk is in.
    let fail = true;
    const module = { value: 1 };
    const { load, preload, loaded } = loadOnIntent(() =>
      fail ? Promise.reject(new Error("offline")) : Promise.resolve(module),
    );
    expect(loaded()).toBeUndefined();

    await load().catch(() => {});
    expect(loaded()).toBeUndefined(); // a failure leaves nothing

    fail = false;
    preload();
    await load();
    expect(loaded()).toBe(module);
  });
});
