import { afterEach, describe, expect, it, vi } from "vitest";
import { WebLLMClient } from "./client";
import { WEBLLM_CONFIG, WEBLLM_PINS } from "./config";

// The terminal offers its AI commands only where isSupported() finds WebGPU.
// The command tests mock the client, so the check itself is tested here.
describe("WebLLMClient.isSupported", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is true where the browser has WebGPU", () => {
    vi.stubGlobal("navigator", { gpu: {} });

    expect(WebLLMClient.isSupported()).toBe(true);
  });

  it("is false where the browser has no WebGPU", () => {
    vi.stubGlobal("navigator", {});

    expect(WebLLMClient.isSupported()).toBe(false);
  });

  it("is false on the server, where there is no navigator", () => {
    vi.stubGlobal("navigator", undefined);

    expect(WebLLMClient.isSupported()).toBe(false);
  });
});

// web-llm's prebuilt records load each model from mutable `main` refs with
// no integrity, so whoever writes those refs decides what runs and prints
// (security audit run 1, finding 4.2). The client must load only the pinned,
// reviewed artifacts, and refuse a model with no pin.
const createEngine = vi.hoisted(() => vi.fn(async () => ({ unload: vi.fn() })));
vi.mock("@mlc-ai/web-llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mlc-ai/web-llm")>()),
  CreateMLCEngine: createEngine,
}));

describe("WebLLMClient.initialize", () => {
  afterEach(() => {
    createEngine.mockClear();
  });

  it.each(WEBLLM_CONFIG.models.map((model) => model.id))(
    "loads %s only from its pinned commits, with integrity enforced",
    async (id) => {
      const pin = WEBLLM_PINS[id];
      expect(pin).toBeDefined();

      await new WebLLMClient().initialize(id);

      const [modelId, options] = createEngine.mock.calls[0] as unknown as [
        string,
        { appConfig: { model_list: Record<string, unknown>[] } },
      ];
      expect(modelId).toBe(id);
      const [record] = options.appConfig.model_list;
      expect(options.appConfig.model_list).toHaveLength(1);
      expect(record.model).toBe(
        `https://huggingface.co/mlc-ai/${id}/resolve/${pin!.revision}/`,
      );
      expect(record.model_lib).toContain(
        `/binary-mlc-llm-libs/${pin!.libCommit}/`,
      );
      expect(record.model_lib).not.toContain("/main/");
      expect(record.integrity).toEqual({
        ...pin!.integrity,
        onFailure: "error",
      });
    },
  );

  it("refuses a model with no pinned artifacts, before loading anything", async () => {
    await expect(
      new WebLLMClient().initialize("SmolLM2-135M-Instruct-q0f16-MLC"),
    ).rejects.toThrow(/No reviewed artifacts/);
    expect(createEngine).not.toHaveBeenCalled();
  });
});
