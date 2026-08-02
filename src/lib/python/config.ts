/**
 * Tunables for the in-browser Python sandbox.
 *
 * Everything a reviewer might want to change lives here rather than being
 * scattered through the worker and the client: resource ceilings, the module
 * denylist, and the JS globals the worker strips before running user code.
 *
 * The denylist and the strip list are consumed by public/python-worker.js,
 * which is plain untranspiled JS and cannot import this module. They are
 * duplicated there deliberately, and worker-contract.test.ts asserts the two
 * copies stay in sync.
 */

/** Where the vendored runtime is served from. Must stay same-origin. */
export const PYODIDE_BASE_URL = "/pyodide/";

/** Worker script path. Same-origin, so `worker-src 'self'` covers it. */
export const PYTHON_WORKER_URL = "/python-worker.js";

/**
 * Pinned so `python --version` can answer instantly. Booting an 11MB runtime
 * to print a version string would be absurd.
 *
 * Keep in sync with the `pyodide` dependency in package.json.
 */
export const PYODIDE_VERSION = "314.0.3";
export const PYTHON_VERSION = "3.14.0";

/** Packages vendored by scripts/setup-assets.js. Nothing else can be loaded. */
export const VENDORED_PACKAGES = ["numpy"] as const;

export const LIMITS = {
  /** Ceiling on a single `python file.py` or `python -c` run, in ms. */
  hardTimeoutMs: 30_000,
  /** Ceiling on one REPL statement, in ms. Lower: interactive work is short. */
  replTimeoutMs: 15_000,
  /**
   * When a run passes this, tell the user Ctrl+C exists. Purely advisory; it
   * does not terminate anything.
   */
  softTimeoutMs: 5_000,
  /** How long an idle interpreter stays warm before being torn down, in ms. */
  idleShutdownMs: 5 * 60_000,
  /** Total characters of stdout+stderr kept per run. Excess is truncated. */
  maxOutputChars: 512 * 1024,
  /** Worker flushes stdout once this many characters have accumulated. */
  outputChunkChars: 8 * 1024,
  /** ...or once this many ms have passed, whichever comes first. */
  outputFlushMs: 40,
  /** Rejects absurd pastes before they reach the interpreter. */
  maxSourceChars: 256 * 1024,
  /**
   * Ceiling for worker-controlled strings that are not stdout: error messages
   * and version strings. A compromised worker can make these any length, and
   * they are rendered directly, so they get their own much tighter bound.
   */
  maxMessageChars: 4 * 1024,
  /** Boot is slow but not unbounded; past this the worker is presumed wedged. */
  bootTimeoutMs: 120_000,
} as const;

/**
 * Python modules the prelude refuses to import.
 *
 * This is hardening, not a security boundary. A determined caller restores
 * `importlib.machinery.BuiltinImporter` into `sys.meta_path` and reaches
 * `_pyodide_core` regardless (verified, not theorized). What actually contains
 * the sandbox is STRIPPED_GLOBALS below plus the worker's lack of DOM access.
 * The denylist exists so ordinary mistakes produce a clear message instead of
 * a confusing one.
 */
export const BLOCKED_MODULES = [
  // The JS bridge and everything that can rebuild it.
  "js",
  "pyodide",
  "pyodide_js",
  "_pyodide",
  "_pyodide_core",
  "micropip",
  "ctypes",
  // Network and process surfaces. Mostly non-functional under Emscripten
  // anyway, but blocking them keeps the error message honest.
  "socket",
  "ssl",
  "http",
  "urllib",
  "ftplib",
  "smtplib",
  "xmlrpc",
  "webbrowser",
  "subprocess",
  "multiprocessing",
] as const;

/**
 * JS globals deleted from the worker after Pyodide boots and before any user
 * code runs. This IS the security boundary.
 *
 * Deleting from `self` alone is not enough: on a DedicatedWorkerGlobalScope
 * these live on WorkerGlobalScope.prototype, so `delete self.fetch` returns
 * true and removes nothing. The worker walks the prototype chain and then
 * shadows each name with a non-writable, non-configurable `undefined`.
 *
 * `WebAssembly` is deliberately absent: Emscripten holds live Table and
 * addFunction trampolines for C callbacks, and it grants no I/O by itself.
 *
 * `fetch` IS in this list. Vendored packages are loaded before hardening (the
 * wheel unpacker lives in `_pyodide`, which the prelude then purges), so
 * nothing needs the network afterward and it can be removed outright rather
 * than gated.
 */
export const STRIPPED_GLOBALS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  // A separate global from WebSocket, and the reason a name-by-name denylist
  // is not a strategy on its own.
  "WebSocketStream",
  "EventSource",
  // HTTP/3 egress. connect-src is not a sufficient backstop: it lists
  // s3.amazonaws.com and raw.githubusercontent.com, and a public-writable
  // bucket is a working exfiltration endpoint.
  "WebTransport",
  // The least obvious entry here: new FontFace(name, "url(...)") plus
  // fonts.add() and .load() performs a real network fetch, governed by
  // font-src rather than connect-src.
  "FontFace",
  "FontFaceSet",
  "fonts",
  "importScripts",
  "Worker",
  "SharedWorker",
  "BroadcastChannel",
  "MessageChannel",
  "MessagePort",
  "indexedDB",
  "caches",
  "Notification",
  "PushManager",
  "RTCPeerConnection",
  "RTCDataChannel",
  "createImageBitmap",
  "SharedArrayBuffer",
  "reportError",
] as const;

/**
 * What survives on `navigator`. Everything else is removed.
 *
 * An ALLOWLIST, unlike STRIPPED_GLOBALS. The navigator surface is small and
 * fully enumerable, which makes it the one place a blanket sweep is low risk,
 * and it means a browser shipping `navigator.<something new>` is stripped by
 * default instead of by a later commit. These entries are information, not
 * capability.
 *
 * `navigator` also needs its own pass because it is not a plain global: it is
 * a getter on WorkerGlobalScope.prototype returning a WorkerNavigator whose
 * methods live on WorkerNavigator.prototype. Hoping that
 * `delete self.navigator.sendBeacon` removes one is exactly how `sendBeacon`
 * shipped reachable: it targets an own property that was never there, returns
 * true, and removes nothing.
 */
export const NAVIGATOR_KEPT = [
  "appCodeName",
  "appName",
  "appVersion",
  "platform",
  "product",
  "userAgent",
  "hardwareConcurrency",
  "language",
  "languages",
  "onLine",
] as const;

/**
 * Spot-checked by the worker's post-lockdown assertion. Redundant with the
 * allowlist above and deliberately so: these are the ones whose reappearance
 * would matter most, and naming them makes the check readable.
 *
 * - `sendBeacon`: fire-and-forget egress to any `connect-src` origin, needs no
 *   response, and outlives the worker being terminated.
 * - `serviceWorker`: register() is a persistent, origin-wide state change that
 *   survives the tab.
 * - `storage`: getDirectory() is OPFS, and FileSystemSyncAccessHandle gives a
 *   worker synchronous, persistent disk writes.
 * - `usb`/`serial`/`hid`: getDevices() returns already-granted devices with no
 *   prompt.
 */
export const NAVIGATOR_MUST_BE_GONE = [
  "sendBeacon",
  "serviceWorker",
  "storage",
  "locks",
  "permissions",
  "usb",
  "serial",
  "hid",
  "bluetooth",
  "gpu",
  "setAppBadge",
  "clearAppBadge",
  "mediaCapabilities",
] as const;

/**
 * Modules whose presence in the source triggers a vendored-package preload.
 *
 * Packages must be loaded before the prelude runs, so the worker cannot fetch
 * one on demand later. For a one-shot run the source is known up front and is
 * scanned; the REPL cannot predict what will be typed, so it preloads
 * everything in VENDORED_PACKAGES.
 */
export const PACKAGE_IMPORT_PATTERN =
  /^[ \t]*(?:import[ \t]+|from[ \t]+)([A-Za-z_][A-Za-z0-9_]*)/gm;

/** Prompts. Both are 4 columns wide, which the line-wrap math depends on. */
export const REPL_PROMPT = ">>> ";
export const REPL_CONTINUATION_PROMPT = "... ";
