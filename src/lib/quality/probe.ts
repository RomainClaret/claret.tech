/**
 * A one-off startup check for machines that clearly cannot keep up.
 *
 * The frame-rate loop in quality-context lowers quality only after it has
 * measured a few seconds of stutter, and on a machine without a graphics card
 * that is most of a first visit spent struggling. A software renderer is
 * known before the first frame, so such a machine can start at LOW instead.
 *
 * Weak means any of:
 *   - WebGL with `failIfMajorPerformanceCaveat` fails while plain WebGL
 *     works: the browser itself reports a software fallback. Only Chromium
 *     does (Safari ignores the flag, and Firefox does by default), only when
 *     WebGL runs on SwiftShader or WARP (Chromium's
 *     gpu/ipc/service/gles2_command_buffer_stub.cc), and then it composites
 *     and rasterizes in software too;
 *   - the renderer names a software rasterizer (SwiftShader, llvmpipe, ...);
 *   - no WebGL at all;
 *   - the visitor asked to save data.
 *
 * Creating a WebGL context costs a few milliseconds up to tens of them, so
 * callers run this in idle time, once per session (probeDeviceOnce caches it
 * in sessionStorage), and every context is released straight away.
 */

export type WeakDeviceReason =
  | "save-data"
  | "no-webgl"
  | "software-webgl"
  | "software-renderer";

export interface DeviceProbe {
  weak: boolean;
  reason: WeakDeviceReason | null;
  /** The renderer string, when the browser exposes it. */
  renderer: string | null;
}

const SOFTWARE_RENDERER =
  /swiftshader|llvmpipe|softpipe|software|basic render/i;
const CACHE_KEY = "quality-probe";
const CAPABLE: DeviceProbe = { weak: false, reason: null, renderer: null };

function webgl(options?: WebGLContextAttributes): WebGLRenderingContext | null {
  try {
    return document
      .createElement("canvas")
      .getContext("webgl", options) as WebGLRenderingContext | null;
  } catch {
    return null;
  }
}

function release(gl: WebGLRenderingContext) {
  try {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    // Nothing to release.
  }
}

export function probeDevice(): DeviceProbe {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return CAPABLE;
  }

  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  if (connection?.saveData) {
    return { weak: true, reason: "save-data", renderer: null };
  }

  const hardware = webgl({ failIfMajorPerformanceCaveat: true });
  if (!hardware) {
    const plain = webgl();
    if (!plain) return { weak: true, reason: "no-webgl", renderer: null };
    release(plain);
    return { weak: true, reason: "software-webgl", renderer: null };
  }

  let renderer: string | null = null;
  try {
    const info = hardware.getExtension("WEBGL_debug_renderer_info");
    renderer = String(
      hardware.getParameter(
        info ? info.UNMASKED_RENDERER_WEBGL : hardware.RENDERER,
      ),
    );
  } catch {
    renderer = null;
  }
  release(hardware);

  if (renderer && SOFTWARE_RENDERER.test(renderer)) {
    return { weak: true, reason: "software-renderer", renderer };
  }
  return { weak: false, reason: null, renderer };
}

/** probeDevice, run at most once per session. */
export function probeDeviceOnce(): DeviceProbe {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    // Checked, not cast: a stored "null" or an old shape made the caller's
    // `.weak` throw.
    const parsed = cached ? (JSON.parse(cached) as Partial<DeviceProbe>) : null;
    if (parsed && typeof parsed.weak === "boolean")
      return parsed as DeviceProbe;
  } catch {
    // Unreadable storage: probe again.
  }
  const result = probeDevice();
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(result));
  } catch {
    // Storage full or blocked: the next call probes again, which is fine.
  }
  return result;
}
