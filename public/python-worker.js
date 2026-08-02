/**
 * Python sandbox worker: CPython (Pyodide) in a dedicated Web Worker.
 *
 * Plain untranspiled JS served from public/, so webpack never touches it and
 * `worker-src 'self'` covers it. src/lib/python/worker-contract.test.ts asserts
 * the constant lists below stay in sync with src/lib/python/config.ts, which
 * cannot be imported here.
 *
 * SECURITY MODEL
 * --------------
 * The Python-level restrictions in PRELUDE are hardening, not a boundary. This
 * is measured, not assumed: restoring importlib.machinery.BuiltinImporter into
 * sys.meta_path reaches _pyodide_core, and _pyodide_core.to_js([]) mints a
 * JsProxy whose .constructor.constructor is Function, which yields globalThis.
 * That chain works and cannot be closed from inside Python.
 *
 * What contains the sandbox:
 *   1. the wasm sandbox (no syscalls, no host filesystem)
 *   2. this worker (no window, no document, no storage, no cookies)
 *   3. lockdown() below, which removes the I/O globals from the prototype
 *      chain and shadows them non-configurably, so a recovered globalThis is
 *      an empty room
 *   4. CSP connect-src, which lists concrete origins
 *   5. output sanitization on the main thread, which treats everything this
 *      worker sends as untrusted
 *
 * Boot order matters and is not rearrangeable:
 *   loadPyodide -> setStdin(error) -> loadPackage -> unregisterJsModule
 *   -> PRELUDE -> lockdown -> accept user code
 * Packages must come before PRELUDE because the wheel unpacker lives in
 * _pyodide, which PRELUDE purges. That is also why lockdown can delete fetch
 * outright instead of gating it: nothing needs the network afterward.
 */

import { loadPyodide } from "/pyodide/pyodide.mjs";

// Pin the channel before any Python runs. Python that reaches a JS handle can
// reassign self.postMessage; it cannot reach this binding.
const post = self.postMessage.bind(self);

// --- constants (mirrored from src/lib/python/config.ts) ---------------------

const STRIPPED_GLOBALS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  // A separate global from WebSocket.
  "WebSocketStream",
  "EventSource",
  // HTTP/3 egress; connect-src is not a sufficient backstop.
  "WebTransport",
  // Constructing a FontFace with a url source, adding it and loading it is a
  // real network fetch, governed by font-src rather than connect-src. No
  // quotes in this comment: worker-contract.test.ts extracts the names below
  // with a quote regex.
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
];

// navigator needs its own pass, and an allowlist rather than a denylist: its
// methods live on WorkerNavigator.prototype, and the surface is small enough
// to enumerate, so anything new a browser ships is stripped by default.
const NAVIGATOR_KEPT = [
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
];

const NAVIGATOR_MUST_BE_GONE = [
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
];

const MAX_OUTPUT_CHARS = 512 * 1024;
const OUTPUT_CHUNK_CHARS = 8 * 1024;
const OUTPUT_FLUSH_MS = 40;

// --- output batching -------------------------------------------------------

let currentId = -1;
let buffer = "";
let bufferStream = "out";
let sentChars = 0;
let truncated = false;
let lastFlush = 0;

function flush() {
  if (!buffer) return;
  post({
    t: "out",
    id: currentId,
    s: bufferStream,
    text: buffer,
    truncated: truncated || undefined,
  });
  buffer = "";
  lastFlush = performance.now();
}

/**
 * Collect stdout/stderr, bounded.
 *
 * The slice happens before the concat on purpose. Pyodide's batched writer
 * hands over one string per print call, so `print("x" * 10**9)` arrives as a
 * single gigabyte-long argument; appending it first and trimming after would
 * be the freeze this cap exists to prevent.
 */
function emit(stream, text) {
  if (truncated || typeof text !== "string") return;

  if (sentChars + text.length > MAX_OUTPUT_CHARS) {
    text = text.slice(0, Math.max(0, MAX_OUTPUT_CHARS - sentChars));
    truncated = true;
  }
  sentChars += text.length;

  if (stream !== bufferStream) {
    flush();
    bufferStream = stream;
  }
  buffer += text;

  // performance.now() rather than a timer: the worker thread is blocked inside
  // exec() for the whole run, so no scheduled callback would ever fire.
  const now = performance.now();
  if (
    buffer.length >= OUTPUT_CHUNK_CHARS ||
    now - lastFlush >= OUTPUT_FLUSH_MS ||
    truncated
  ) {
    flush();
  }
}

function resetOutput(id) {
  flush();
  currentId = id;
  buffer = "";
  bufferStream = "out";
  sentChars = 0;
  truncated = false;
  lastFlush = performance.now();
}

// --- lockdown --------------------------------------------------------------

/**
 * Remove the I/O globals. Runs once, after Pyodide has finished booting and
 * before a single line of user code executes.
 *
 * `delete self.fetch` on its own is a no-op: on a DedicatedWorkerGlobalScope
 * these properties live on WorkerGlobalScope.prototype, so the delete returns
 * true and removes nothing. Both steps are required, and the shadow must be
 * non-configurable so Python cannot assign the name back.
 *
 * The result is verified rather than assumed. A strip that silently fails is
 * not hypothetical: `navigator.sendBeacon` shipped reachable for exactly that
 * reason, using a bare delete against a prototype property. lockdownFailures()
 * checks the outcome and boot() refuses to run user code if anything survived.
 *
 * WebAssembly is intentionally left alone: Emscripten holds live Table and
 * addFunction trampolines for C callbacks and finalizers, and it grants no I/O
 * on its own.
 */
function hardRemove(target, names) {
  const protos = [];
  for (let p = Object.getPrototypeOf(target); p; p = Object.getPrototypeOf(p)) {
    protos.push(p);
  }

  for (const name of names) {
    // Walking the chain is the step that actually removes anything: these are
    // prototype properties, so deleting only the own property is a no-op that
    // still reports success.
    for (const proto of protos) {
      try {
        delete proto[name];
      } catch {
        /* non-configurable on the prototype; the shadow below still applies */
      }
    }
    try {
      delete target[name];
    } catch {
      /* ignore */
    }
    try {
      Object.defineProperty(target, name, {
        value: undefined,
        writable: false,
        configurable: false,
        enumerable: false,
      });
    } catch {
      /* already non-configurable, which is the desired end state anyway */
    }
  }
}

/**
 * Replace `navigator` with a frozen snapshot of the harmless fields.
 *
 * Two halves, both required. Scrubbing the live WorkerNavigator alone leaves it
 * as the value of `self.navigator`. Shadowing `self.navigator` alone leaves the
 * real object recoverable by calling the prototype's getter directly, and
 * Emscripten may still hold a reference captured before lockdown ran.
 */
function lockdownNavigator() {
  const nav = self.navigator;
  if (!nav) return;

  const snapshot = {};
  for (const name of NAVIGATOR_KEPT) {
    try {
      const value = nav[name];
      if (value !== undefined) snapshot[name] = value;
    } catch {
      /* a getter that throws is not a value worth keeping */
    }
  }
  Object.freeze(snapshot);

  // 1. Scrub the live object and its prototype chain.
  for (
    let proto = nav;
    proto && proto !== Object.prototype;
    proto = Object.getPrototypeOf(proto)
  ) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === "constructor" || NAVIGATOR_KEPT.indexOf(name) !== -1) {
        continue;
      }
      try {
        delete proto[name];
      } catch {
        /* non-configurable; the shadow below still applies */
      }
      try {
        Object.defineProperty(proto, name, {
          value: undefined,
          writable: false,
          configurable: false,
          enumerable: false,
        });
      } catch {
        /* already sealed, which is the desired end state anyway */
      }
    }
  }

  // 2. Remove the `navigator` getter from the global's prototype chain and
  //    shadow it with the snapshot.
  for (
    let proto = Object.getPrototypeOf(self);
    proto;
    proto = Object.getPrototypeOf(proto)
  ) {
    try {
      delete proto.navigator;
    } catch {
      /* ignore */
    }
  }
  try {
    delete self.navigator;
  } catch {
    /* ignore */
  }
  try {
    Object.defineProperty(self, "navigator", {
      value: snapshot,
      writable: false,
      configurable: false,
      enumerable: true,
    });
  } catch {
    /* lockdownFailures() turns this into a fail-closed boot */
  }
}

/**
 * Names still reachable after a strip. Empty means the lockdown took.
 *
 * A name that does not exist in this browser reads as undefined and is not
 * reported, which is correct: there is nothing to reach.
 */
function lockdownFailures() {
  const failures = [];

  for (const name of STRIPPED_GLOBALS) {
    if (self[name] !== undefined) {
      failures.push(name + ": still defined");
      continue;
    }
    for (let p = Object.getPrototypeOf(self); p; p = Object.getPrototypeOf(p)) {
      if (Object.prototype.hasOwnProperty.call(p, name)) {
        failures.push(name + ": survives on a prototype");
        break;
      }
    }
  }

  const nav = self.navigator;
  if (nav) {
    // The snapshot's prototype is Object.prototype; a real WorkerNavigator's
    // is not, which is how a failed swap is detected.
    if (Object.getPrototypeOf(nav) !== Object.prototype) {
      failures.push("navigator: the real WorkerNavigator is still reachable");
    }
    for (const name of Object.getOwnPropertyNames(nav)) {
      if (NAVIGATOR_KEPT.indexOf(name) === -1) {
        failures.push("navigator." + name + ": unexpected property");
      }
    }
    for (const name of NAVIGATOR_MUST_BE_GONE) {
      if (nav[name] !== undefined) {
        failures.push("navigator." + name + ": still reachable");
      }
    }
  }

  return failures;
}

function lockdown() {
  hardRemove(self, STRIPPED_GLOBALS);
  lockdownNavigator();
}

// --- Python prelude --------------------------------------------------------

const PRELUDE = `
import sys, builtins, os, shutil, codeop, traceback

_BLOCKED = frozenset({
    "js", "pyodide", "pyodide_js", "_pyodide", "_pyodide_core", "micropip",
    "ctypes", "socket", "ssl", "http", "urllib", "ftplib", "smtplib",
    "xmlrpc", "webbrowser", "subprocess", "multiprocessing",
})


class _Blocker:
    """Refuse the JS bridge and the network/process surfaces.

    Hardening only. sys.meta_path is user-writable and this can be removed from
    inside Python; the JS lockdown is what makes that harmless.
    """

    @staticmethod
    def _check(fullname):
        if fullname in _BLOCKED or fullname.split(".")[0] in _BLOCKED:
            raise ImportError(
                "module %r is not available in this sandbox" % fullname,
                name=fullname,
            )

    def find_spec(self, fullname, path=None, target=None):
        self._check(fullname)
        return None

    def find_module(self, fullname, path=None):
        self._check(fullname)
        return None


# Order matters: import consults sys.modules before sys.meta_path, so purging
# is what actually closes the door. The finder only stops re-imports.
for _n in list(sys.modules):
    if _n in _BLOCKED or _n.split(".")[0] in _BLOCKED:
        del sys.modules[_n]

# Drop Pyodide's own finders so clearing sys.meta_path cannot resurrect them.
sys.meta_path[:] = [
    f
    for f in sys.meta_path
    if type(f).__name__
    not in ("JsFinder", "UnvendoredStdlibFinder", "RepodataPackagesFinder")
]
sys.meta_path.insert(0, _Blocker())


def _denied(*args, **kwargs):
    raise RuntimeError("this function is disabled in the sandbox")


# input() has no counterpart here: reading stdin would need to block the worker,
# which without SharedArrayBuffer it cannot do. stdin is also closed at the JS
# level, because sys.stdin.readline() bypasses this stub entirely.
builtins.input = _denied
builtins.breakpoint = _denied
builtins.help = _denied  # pydoc's pager waits on stdin

# The in-memory filesystem holds only CPython's own stdlib and dies with the
# worker, so open() is left alone. Blocking the destructive calls stops one run
# from bricking the interpreter for the next one, which is the useful part.
for _n in ("remove", "unlink", "rmdir", "removedirs", "rename", "replace",
           "truncate", "chmod", "symlink", "link", "system", "popen", "execv",
           "fork", "kill", "abort", "_exit"):
    if hasattr(os, _n):
        setattr(os, _n, _denied)
for _n in ("rmtree", "move", "copytree"):
    if hasattr(shutil, _n):
        setattr(shutil, _n, _denied)


class _Runner:
    """Owns the interpreter namespace and the incremental REPL compile."""

    def __init__(self):
        self.compiler = codeop.CommandCompiler()
        self.buf = []
        self.reset()

    def reset(self):
        self.ns = {
            "__name__": "__main__",
            "__doc__": None,
            "__builtins__": builtins,
        }
        self.buf.clear()

    def push(self, line):
        """Feed one physical line. Returns 'incomplete' while a block is open.

        Only CPython knows whether a triple-quoted string or an open bracket
        needs more input, so this decision is never made on the JS side.
        """
        self.buf.append(line)
        source = "\\n".join(self.buf)
        try:
            code = self.compiler(source, "<console>", "single")
        except (SyntaxError, OverflowError, ValueError):
            self.buf.clear()
            traceback.print_exc(limit=0)
            return "error"
        if code is None:
            return "incomplete"
        self.buf.clear()
        return self._exec(code)

    def clear_block(self):
        self.buf.clear()

    def run(self, source, filename):
        try:
            code = compile(source, filename, "exec")
        except (SyntaxError, ValueError):
            traceback.print_exc(limit=0)
            return "error"
        return self._exec(code)

    def _exec(self, code):
        try:
            exec(code, self.ns)
        except SystemExit:
            return "exit"
        except BaseException:
            kind, value, tb = sys.exc_info()
            # tb_next hides this runner's own frame from the traceback.
            traceback.print_exception(kind, value, tb.tb_next)
            return "error"
        return "ok"


_runner = _Runner()
del _n
_runner
`;

// --- boot ------------------------------------------------------------------

let runner = null;
let pyodide = null;
let pythonVersion = "";
const missingPackages = [];

async function boot(packages) {
  post({ t: "boot", phase: "downloading" });

  pyodide = await loadPyodide({
    indexURL: "/pyodide/",
    stdout: (text) => emit("out", text + "\n"),
    stderr: (text) => emit("err", text + "\n"),
  });

  post({ t: "boot", phase: "booting" });

  // Read the version now, while runPython is still safe to call.
  pythonVersion = pyodide.runPython("import sys; sys.version.split()[0]");

  // Must precede any user code. A Python-level input() stub is not enough:
  // sys.stdin.readline() goes straight past it and would hang the worker until
  // the client's hard timeout kills it.
  pyodide.setStdin({ error: true });

  // Vendored packages load here, before the prelude purges the unpacker.
  for (const name of packages || []) {
    try {
      await pyodide.loadPackage(name);
    } catch {
      missingPackages.push(name);
    }
  }

  post({ t: "boot", phase: "hardening" });

  for (const name of ["js", "pyodide_js"]) {
    try {
      pyodide.unregisterJsModule(name);
    } catch {
      /* not registered in this build */
    }
  }

  runner = pyodide.runPython(PRELUDE);

  // After this point runPython() is off limits: it can route through the
  // Python-side pyodide package the prelude just removed. Everything goes
  // through the runner proxy instead.
  lockdown();

  // Fail closed. The lockdown IS the security boundary, so a partial strip is
  // worse than no interpreter: it would run untrusted code while the design
  // still claims the room is empty.
  const survivors = lockdownFailures();
  if (survivors.length > 0) {
    runner = null;
    throw new Error(
      `sandbox lockdown failed, refusing to run code: ${survivors.join(", ")} still reachable`,
    );
  }

  post({
    t: "ready",
    python: pythonVersion,
    pyodide: pyodide.version || "",
    missing: missingPackages,
  });
}

// --- message handling ------------------------------------------------------

let booted = null;

self.onmessage = async (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.t === "init") {
    if (!booted) {
      booted = boot(msg.packages).catch((err) => {
        post({ t: "fatal", error: String((err && err.message) || err) });
        throw err;
      });
    }
    return;
  }

  if (msg.t === "reset") {
    try {
      if (runner) runner.reset();
    } catch {
      /* ignore */
    }
    return;
  }

  // Ctrl+C at a continuation prompt. The pending block lives in the runner, so
  // abandoning it needs a round-trip, but the worker is idle at a prompt by
  // definition and this never terminates anything.
  if (msg.t === "clearBlock") {
    try {
      if (runner) runner.clear_block();
    } catch {
      /* ignore */
    }
    return;
  }

  if (msg.t !== "run") return;

  const id = msg.id;
  try {
    if (booted) await booted;
    if (!runner) throw new Error("interpreter is not ready");

    resetOutput(id);

    const status =
      msg.kind === "repl"
        ? runner.push(String(msg.code))
        : runner.run(String(msg.code), String(msg.filename || "<stdin>"));

    flush();
    // Also on done: flush() early-returns when the buffer is empty, so a
    // truncation that lands exactly on a flush boundary has no out message
    // left to ride on and would otherwise be silently dropped.
    post({
      t: "done",
      id,
      ok: true,
      status,
      truncated: truncated || undefined,
    });
  } catch (err) {
    flush();
    post({
      t: "done",
      id,
      ok: false,
      error: String((err && err.message) || err),
    });
  }
};
