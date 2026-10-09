import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { probeDevice, probeDeviceOnce } from "./probe";
import { memoryStorage } from "@/test/memory-storage";

/**
 * The startup check that lets a machine without a graphics card start at LOW
 * instead of stuttering through the seconds the frame-rate loop needs.
 */

const UNMASKED_RENDERER_WEBGL = 0x9246;

/** A WebGL context stand-in that reports `renderer`. */
function fakeGl(renderer: string) {
  const loseContext = vi.fn();
  return {
    gl: {
      RENDERER: 0x1f01,
      getExtension: (name: string) =>
        name === "WEBGL_debug_renderer_info"
          ? { UNMASKED_RENDERER_WEBGL }
          : name === "WEBGL_lose_context"
            ? { loseContext }
            : null,
      getParameter: () => renderer,
    },
    loseContext,
  };
}

/**
 * Answer getContext("webgl") per attempt: [with the caveat flag, plain].
 *
 * The test setup replaces document.createElement and gives every canvas its
 * own getContext, so canvases are intercepted the same way here; the spy is
 * restored after each test (restoreMocks).
 */
function contexts(hardware: unknown, plain: unknown) {
  const getContext = vi.fn((_type: string, options?: WebGLContextAttributes) =>
    options?.failIfMajorPerformanceCaveat ? hardware : plain,
  );
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    const element = Document.prototype.createElement.call(document, tag);
    if (tag === "canvas") {
      (element as HTMLCanvasElement).getContext =
        getContext as unknown as HTMLCanvasElement["getContext"];
    }
    return element;
  }) as typeof document.createElement);
  return getContext;
}

beforeEach(() => {
  vi.stubGlobal("sessionStorage", memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("probeDevice", () => {
  it("passes a machine with a hardware renderer", () => {
    contexts(fakeGl("ANGLE (Apple, Apple M3, OpenGL 4.1)").gl, null);

    expect(probeDevice()).toMatchObject({ weak: false, reason: null });
  });

  it("flags a software renderer by name", () => {
    const { gl, loseContext } = fakeGl(
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0)))",
    );
    contexts(gl, null);

    expect(probeDevice()).toMatchObject({
      weak: true,
      reason: "software-renderer",
    });
    expect(loseContext).toHaveBeenCalled(); // the context is released
  });

  it("flags a browser that reports a major performance caveat", () => {
    const { gl, loseContext } = fakeGl("whatever");
    contexts(null, gl);

    expect(probeDevice()).toMatchObject({
      weak: true,
      reason: "software-webgl",
    });
    expect(loseContext).toHaveBeenCalled();
  });

  it("flags a browser without WebGL", () => {
    contexts(null, null);

    expect(probeDevice()).toMatchObject({ weak: true, reason: "no-webgl" });
  });

  it("flags a visitor who asked to save data, before touching WebGL", () => {
    // A stand-in navigator rather than a property defined on the real one,
    // which an earlier file in the worker may have left non-configurable.
    vi.stubGlobal(
      "navigator",
      Object.create(navigator, { connection: { value: { saveData: true } } }),
    );
    const getContext = contexts(null, null);

    expect(probeDevice()).toMatchObject({ weak: true, reason: "save-data" });
    expect(getContext).not.toHaveBeenCalled();
  });
});

describe("probeDeviceOnce", () => {
  it("probes once per session", () => {
    const getContext = contexts(null, null);

    const first = probeDeviceOnce();
    const callsAfterFirst = getContext.mock.calls.length;
    const second = probeDeviceOnce();

    expect(second).toEqual(first);
    expect(getContext.mock.calls.length).toBe(callsAfterFirst);
  });

  it.each(["null", "{}", '{"weak":"no"}'])(
    "probes again over a cached %s rather than returning it",
    (cached) => {
      // Returned as is, the caller's `.weak` threw on null.
      sessionStorage.setItem("quality-probe", cached);
      contexts(null, null);

      expect(probeDeviceOnce()).toEqual({
        weak: true,
        reason: "no-webgl",
        renderer: null,
      });
    },
  );
});
