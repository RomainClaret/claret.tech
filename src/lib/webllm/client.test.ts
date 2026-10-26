import { afterEach, describe, expect, it, vi } from "vitest";
import { WebLLMClient } from "./client";

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
