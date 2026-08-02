import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import {
  PythonClient,
  detectRequiredPackages,
  type RunResult,
} from "./pyodide-client";
import { PythonAborted } from "./protocol";
import {
  LIMITS,
  PACKAGE_IMPORT_PATTERN,
  PYTHON_WORKER_URL,
  PYODIDE_VERSION,
  PYTHON_VERSION,
  VENDORED_PACKAGES,
} from "./config";

// Built from a char code so this file stays pure ASCII. An invisible ESC byte
// in a fixture is how you end up debugging the test instead of the code.
const ESC = String.fromCharCode(0x1b);

/**
 * A worker the test drives by hand.
 *
 * jsdom has no Worker at all, so this is the only implementation the client
 * ever sees here. It records what was posted and exposes `emit` to push a
 * message back the way a real worker would.
 */
class FakeWorker {
  static instances: FakeWorker[] = [];

  readonly url: string;
  readonly options: unknown;
  readonly posted: unknown[] = [];
  terminated = 0;

  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessageerror: ((event: { data: unknown }) => void) | null = null;

  constructor(url: string | URL, options?: unknown) {
    this.url = String(url);
    this.options = options;
    FakeWorker.instances.push(this);
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated++;
  }

  /** Deliver a message from the worker to the client. */
  emit(data: unknown): void {
    this.onmessage?.({ data });
  }
}

function currentWorker(): FakeWorker {
  const worker = FakeWorker.instances.at(-1);
  if (!worker) throw new Error("the client never constructed a worker");
  return worker;
}

/**
 * Drain the microtask queue.
 *
 * setTimeout(0) would be the obvious way to do this and is wrong: several tests
 * run on fake timers, where a real timeout never fires.
 */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

/** Answer the client's init message so it considers the interpreter up. */
async function bootClient(
  client: PythonClient,
  missing: string[] = [],
): Promise<void> {
  const ready = client.ensureReady();
  currentWorker().emit({
    t: "ready",
    python: PYTHON_VERSION,
    pyodide: PYODIDE_VERSION,
    missing,
  });
  await ready;
}

/** Resolve to the outcome of a run without ever leaving it unhandled. */
function outcome(promise: Promise<RunResult>): Promise<RunResult | Error> {
  return promise.then(
    (result) => result,
    (error: Error) => error,
  );
}

const globalScope = globalThis as unknown as { Worker?: typeof Worker };
const originalWorker = globalScope.Worker;

let client: PythonClient;

beforeEach(() => {
  FakeWorker.instances.length = 0;
  globalScope.Worker = FakeWorker as unknown as typeof Worker;
  // Every teardown path arms a timer measured in seconds or minutes. On the
  // fake clock they vanish with useRealTimers instead of outliving the run.
  vi.useFakeTimers();
  // A fresh client per test: the exported singleton would carry a booted worker
  // and a restart count between cases.
  client = new PythonClient();
});

afterEach(() => {
  client.shutdown();
  vi.useRealTimers();
});

afterAll(() => {
  // This suite shares a fork with every other test file, and a leaked global
  // has caused flaky failures in this repo before.
  if (originalWorker) globalScope.Worker = originalWorker;
  else delete globalScope.Worker;
});

describe("detectRequiredPackages", () => {
  it("finds a plain import of a vendored package", () => {
    expect(detectRequiredPackages("import numpy\nprint(1)\n")).toEqual([
      "numpy",
    ]);
  });

  it("finds a from-import", () => {
    expect(detectRequiredPackages("from numpy import array")).toEqual([
      "numpy",
    ]);
  });

  it("finds an import nested inside a function body", () => {
    expect(detectRequiredPackages("def f():\n    import numpy\n")).toEqual([
      "numpy",
    ]);
  });

  it("ignores packages this deployment does not vendor", () => {
    // Loading is impossible after hardening, so asking for json would force a
    // pointless respawn and still fail.
    expect(detectRequiredPackages("import json\nimport os\n")).toEqual([]);
  });

  it("reports each package once however often it is imported", () => {
    expect(
      detectRequiredPackages("import numpy\nfrom numpy import mean\n"),
    ).toEqual(["numpy"]);
  });

  it("returns nothing for empty source", () => {
    expect(detectRequiredPackages("")).toEqual([]);
  });

  it("ignores an import that is not at the start of a line", () => {
    // The pattern is line anchored on purpose: this is a string, not an import.
    expect(detectRequiredPackages("s = 'import numpy'")).toEqual([]);
  });

  it("gives the same answer on a repeated call", () => {
    const source = "import numpy\n";

    expect(detectRequiredPackages(source)).toEqual(["numpy"]);
    expect(detectRequiredPackages(source)).toEqual(["numpy"]);
  });

  it("is not thrown off by a scan of a different source in between", () => {
    detectRequiredPackages("import numpy\nimport numpy\nimport numpy\n");

    expect(detectRequiredPackages("import numpy")).toEqual(["numpy"]);
  });

  it("recovers a lastIndex left behind by another consumer of the pattern", () => {
    // PACKAGE_IMPORT_PATTERN is a module-level global regex, so lastIndex is
    // shared state. The scan below exhausts it, which resets it as a side
    // effect, so today only a second consumer can leave a stale offset. Seeding
    // one here is what makes the explicit reset testable rather than dead code:
    // without it the scan starts past the only import and returns nothing.
    PACKAGE_IMPORT_PATTERN.lastIndex = 5;

    expect(detectRequiredPackages("import numpy")).toEqual(["numpy"]);
  });
});

describe("PythonClient boot", () => {
  it("starts a module worker and asks it to initialize", async () => {
    const ready = client.ensureReady();
    const worker = currentWorker();

    expect(worker.url).toBe(PYTHON_WORKER_URL);
    // The 314.x distribution is ESM first, so a classic worker would not load.
    expect(worker.options).toEqual({ type: "module" });
    expect(worker.posted).toEqual([{ t: "init", packages: [] }]);

    worker.emit({
      t: "ready",
      python: PYTHON_VERSION,
      pyodide: PYODIDE_VERSION,
      missing: [],
    });

    await expect(ready).resolves.toEqual({
      python: PYTHON_VERSION,
      pyodide: PYODIDE_VERSION,
      missing: [],
    });
  });

  it("reports vendored packages whose wheel failed to load", async () => {
    await bootClient(client, ["numpy"]);

    expect(client.info).toEqual({
      python: PYTHON_VERSION,
      pyodide: PYODIDE_VERSION,
      missing: ["numpy"],
    });
    expect(client.isReady).toBe(true);
  });

  it("rejects the boot when the worker sends an unreadable message", async () => {
    // A structured-clone failure is otherwise silent: ensureReady() stayed
    // pending for the full two-minute boot timeout while the terminal showed a
    // spinner, and only then reported anything.
    const ready = client.ensureReady();
    const settled = ready.then(
      () => null,
      (error: Error) => error,
    );
    const worker = currentWorker();

    worker.onmessageerror?.({ data: undefined });
    const error = await settled;

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/unreadable message/);
    expect(worker.terminated).toBe(1);
    expect(client.isReady).toBe(false);

    // The boot timer went with it, so nothing fires against the dead worker.
    vi.advanceTimersByTime(LIMITS.bootTimeoutMs * 2);

    expect(worker.terminated).toBe(1);
  });

  it("clears a superseded boot timer, so it cannot kill the interpreter that replaced it", async () => {
    // The bug: bootTimer was a local in spawn(), so a superseded boot left an
    // armed timer behind. Two minutes later it fired, called teardown("crash"),
    // and killed whatever healthy interpreter had taken its place.
    const abandoned = client.ensureReady();
    let abandonedError: unknown = null;
    void abandoned.catch((error: unknown) => (abandonedError = error));
    const firstWorker = currentWorker();

    // Asking for a package the running interpreter was not booted with forces
    // the respawn: wheels are unpacked by machinery the prelude purges.
    const ready = client.ensureReady(["numpy"]);
    const secondWorker = currentWorker();
    expect(secondWorker).not.toBe(firstWorker);

    secondWorker.emit({
      t: "ready",
      python: PYTHON_VERSION,
      pyodide: PYODIDE_VERSION,
      missing: [],
    });
    await ready;

    vi.advanceTimersByTime(LIMITS.bootTimeoutMs * 2);
    await flushMicrotasks();

    expect(secondWorker.terminated).toBe(0);
    expect(client.isReady).toBe(true);
    expect(client.generation).toBe(0);
    // The abandoned boot is never spoken for again, in either direction.
    expect(abandonedError).toBeNull();
  });

  it("shares one boot between concurrent callers", async () => {
    const first = client.ensureReady();
    const second = client.ensureReady();

    expect(FakeWorker.instances).toHaveLength(1);

    currentWorker().emit({
      t: "ready",
      python: PYTHON_VERSION,
      pyodide: PYODIDE_VERSION,
      missing: [],
    });

    expect(await first).toBe(await second);
  });
});

describe("PythonClient.run", () => {
  it("sends the code to the worker and resolves when it reports success", async () => {
    await bootClient(client);
    const worker = currentWorker();

    const promise = client.run("print(1)", { filename: "main.py" });
    await flushMicrotasks();

    expect(worker.posted).toContainEqual({
      t: "run",
      id: 1,
      kind: "exec",
      code: "print(1)",
      filename: "main.py",
    });

    worker.emit({ t: "done", id: 1, ok: true, status: "ok" });

    await expect(promise).resolves.toEqual({ status: "ok", truncated: false });
  });

  it("streams output through onOutput", async () => {
    await bootClient(client);
    const worker = currentWorker();
    const chunks: Array<[string, string]> = [];

    const promise = client.run("print('hi')", {
      onOutput: (text, stream) => chunks.push([text, stream]),
    });
    await flushMicrotasks();

    worker.emit({ t: "out", id: 1, s: "out", text: "hi\n" });
    worker.emit({ t: "out", id: 1, s: "err", text: "warning\n" });
    worker.emit({ t: "done", id: 1, ok: true, status: "ok" });
    await promise;

    expect(chunks).toEqual([
      ["hi\n", "out"],
      ["warning\n", "err"],
    ]);
  });

  it("sanitizes output before the caller ever sees it", async () => {
    await bootClient(client);
    const worker = currentWorker();
    const chunks: string[] = [];

    const promise = client.run("print('x')", {
      onOutput: (text) => chunks.push(text),
    });
    await flushMicrotasks();

    // A clear-screen followed by a colour reset. The worker is inside the trust
    // boundary, so nothing it sends is assumed to be printable.
    worker.emit({
      t: "out",
      id: 1,
      s: "out",
      text: ESC + "[2Jhello" + ESC + "[0m\n",
    });
    worker.emit({ t: "done", id: 1, ok: true, status: "ok" });
    await promise;

    expect(chunks).toEqual(["hello\n"]);
  });

  it("drops a malformed message instead of forwarding it to the terminal", async () => {
    await bootClient(client);
    const worker = currentWorker();
    const chunks: string[] = [];

    const promise = client.run("print('x')", {
      onOutput: (text) => chunks.push(text),
    });
    await flushMicrotasks();

    worker.emit({ t: "out", id: 1, s: "out", text: { toString: "nope" } });
    worker.emit({ t: "out", id: 1, s: "out", text: "real\n" });
    worker.emit({ t: "done", id: 1, ok: true, status: "ok" });
    await promise;

    expect(chunks).toEqual(["real\n"]);
  });

  it("reports truncation on the result", async () => {
    await bootClient(client);
    const worker = currentWorker();

    const promise = client.run("print('x' * 10**9)");
    await flushMicrotasks();

    worker.emit({ t: "out", id: 1, s: "out", text: "xxx", truncated: true });
    worker.emit({ t: "done", id: 1, ok: true, status: "ok" });

    await expect(promise).resolves.toEqual({ status: "ok", truncated: true });
  });

  it("honors a truncation flag that only the done message carries", async () => {
    await bootClient(client);
    const worker = currentWorker();

    const promise = client.run("print('x' * 10**9)");
    await flushMicrotasks();

    // The worker's flush() early-returns on an empty buffer, so a truncation
    // landing exactly on a flush boundary has no out message left to ride on.
    // Without the flag on done, that run would claim complete output.
    worker.emit({ t: "out", id: 1, s: "out", text: "xxx" });
    worker.emit({ t: "done", id: 1, ok: true, status: "ok", truncated: true });

    await expect(promise).resolves.toEqual({ status: "ok", truncated: true });
  });

  it("caps output across the whole run, not one message at a time", async () => {
    await bootClient(client);
    const worker = currentWorker();
    const chunks: string[] = [];

    const promise = client.run("print('x' * 10**9)", {
      onOutput: (text) => chunks.push(text),
    });
    await flushMicrotasks();

    // Each message is comfortably under the ceiling on its own, so only a
    // running total catches this. A per-message cap is not a copy of the
    // worker's check: the worker sits inside the boundary being defended and
    // can send as many messages as it likes.
    const chunk = "x".repeat(Math.ceil(LIMITS.maxOutputChars * 0.6));
    expect(chunk.length).toBeLessThan(LIMITS.maxOutputChars);

    worker.emit({ t: "out", id: 1, s: "out", text: chunk });
    worker.emit({ t: "out", id: 1, s: "out", text: chunk });
    worker.emit({ t: "out", id: 1, s: "out", text: chunk });
    worker.emit({ t: "done", id: 1, ok: true, status: "ok" });

    const result = await promise;

    expect(chunks.join("").length).toBe(LIMITS.maxOutputChars);
    expect(result.truncated).toBe(true);
  });

  it("resolves with an error status when Python raises, rather than rejecting", async () => {
    await bootClient(client);
    const worker = currentWorker();
    const chunks: string[] = [];

    const promise = client.run("1/0", {
      onOutput: (text) => chunks.push(text),
    });
    await flushMicrotasks();

    // A traceback is ordinary terminal output, not a failure of the sandbox.
    worker.emit({
      t: "out",
      id: 1,
      s: "err",
      text: "ZeroDivisionError: division by zero\n",
    });
    worker.emit({ t: "done", id: 1, ok: true, status: "error" });

    await expect(promise).resolves.toEqual({
      status: "error",
      truncated: false,
    });
    expect(chunks).toEqual(["ZeroDivisionError: division by zero\n"]);
  });

  it("rejects with the worker's own message when the run could not be attempted", async () => {
    await bootClient(client);
    const worker = currentWorker();

    const promise = client.run("print(1)");
    await flushMicrotasks();

    worker.emit({
      t: "done",
      id: 1,
      ok: false,
      error: "interpreter is not ready",
    });

    await expect(promise).rejects.toThrow("interpreter is not ready");
  });

  it("refuses an oversized source before any worker exists", async () => {
    const huge = "x".repeat(LIMITS.maxSourceChars + 1);

    await expect(client.run(huge)).rejects.toThrow(/too large/);
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("preloads every vendored package for the REPL, which cannot predict imports", async () => {
    const promise = client.run("if True:", { kind: "repl" });
    const worker = currentWorker();

    // Wheels are unpacked by machinery the prelude purges, so a REPL that
    // discovers `import numpy` later has no way to satisfy it.
    expect(worker.posted).toEqual([
      { t: "init", packages: [...VENDORED_PACKAGES] },
    ]);

    worker.emit({
      t: "ready",
      python: PYTHON_VERSION,
      pyodide: PYODIDE_VERSION,
      missing: [],
    });
    await flushMicrotasks();

    expect(worker.posted).toContainEqual({
      t: "run",
      id: 1,
      kind: "repl",
      code: "if True:",
      filename: "<stdin>",
    });

    worker.emit({ t: "done", id: 1, ok: true, status: "incomplete" });

    await expect(promise).resolves.toEqual({
      status: "incomplete",
      truncated: false,
    });
  });
});

describe("PythonClient teardown", () => {
  it("aborts a run that outlives its timeout and kills the worker", async () => {
    await bootClient(client);
    const worker = currentWorker();

    const promise = client.run("while True: pass", { timeoutMs: 50 });
    await flushMicrotasks();
    const settled = outcome(promise);

    vi.advanceTimersByTime(60);
    const error = await settled;

    expect(error).toBeInstanceOf(PythonAborted);
    expect((error as PythonAborted).reason).toBe("timeout");
    // terminate() is the only interrupt available: setInterruptBuffer needs
    // SharedArrayBuffer, which needs COEP, which this site does not set.
    expect(worker.terminated).toBe(1);
    expect(client.generation).toBe(1);
  });

  it("does not fire the timeout for a run that finished in time", async () => {
    await bootClient(client);
    const worker = currentWorker();

    const promise = client.run("print(1)", { timeoutMs: 50 });
    await flushMicrotasks();
    worker.emit({ t: "done", id: 1, ok: true, status: "ok" });
    await promise;

    vi.advanceTimersByTime(1000);

    expect(worker.terminated).toBe(0);
  });

  it("rejects every in-flight run when the worker crashes, not just the first", async () => {
    await bootClient(client);
    const worker = currentWorker();

    const first = client.run("a()");
    const second = client.run("b()");
    await flushMicrotasks();
    const settled = Promise.all([outcome(first), outcome(second)]);

    // A wasm trap or an out-of-memory kill surfaces as onerror. Anything the
    // client fails to settle here becomes a REPL that accepts input and never
    // answers.
    worker.onerror?.(new Event("error"));

    const [firstError, secondError] = await settled;

    expect(firstError).toBeInstanceOf(PythonAborted);
    expect((firstError as PythonAborted).reason).toBe("crash");
    expect(secondError).toBeInstanceOf(PythonAborted);
    expect((secondError as PythonAborted).reason).toBe("crash");
  });

  it("ignores a late message from an interpreter that has been replaced", async () => {
    await bootClient(client);
    const dyingWorker = currentWorker();

    const interrupted = client.run("input()");
    await flushMicrotasks();
    const settled = outcome(interrupted);

    // terminate() is synchronous but events already queued still dispatch, so
    // the old handler is captured and called directly rather than via emit.
    const staleHandler = dyingWorker.onmessage;
    client.interrupt("interrupt");
    expect(await settled).toBeInstanceOf(PythonAborted);

    const replacement = currentWorker();
    expect(replacement).not.toBe(dyingWorker);
    replacement.emit({
      t: "ready",
      python: PYTHON_VERSION,
      pyodide: PYODIDE_VERSION,
      missing: [],
    });

    const chunks: string[] = [];
    let finished = false;
    const next = client.run("2 + 2", { onOutput: (text) => chunks.push(text) });
    void next.then(
      () => (finished = true),
      () => (finished = true),
    );
    await flushMicrotasks();

    // Ids are not reset across a respawn, so the dead worker's messages carry
    // the same id as this live run. Only the worker identity check tells them
    // apart, and without it the old interpreter answers for the new one.
    expect(replacement.posted).toContainEqual(
      expect.objectContaining({ t: "run", id: 2 }),
    );
    expect(() => {
      staleHandler?.({ data: { t: "out", id: 2, s: "out", text: "ghost\n" } });
      staleHandler?.({ data: { t: "done", id: 2, ok: true, status: "ok" } });
    }).not.toThrow();
    await flushMicrotasks();

    expect(chunks).toEqual([]);
    expect(finished).toBe(false);

    replacement.emit({ t: "out", id: 2, s: "out", text: "4\n" });
    replacement.emit({ t: "done", id: 2, ok: true, status: "ok" });

    await expect(next).resolves.toEqual({ status: "ok", truncated: false });
    expect(chunks).toEqual(["4\n"]);
  });

  it("respawns after an interrupt so the next run does not pay for a cold boot", async () => {
    await bootClient(client);

    client.interrupt("interrupt");

    expect(FakeWorker.instances).toHaveLength(2);
    expect(currentWorker().posted).toEqual([{ t: "init", packages: [] }]);
    expect(client.generation).toBe(1);
  });

  it("terminates the worker on shutdown", async () => {
    await bootClient(client);
    const worker = currentWorker();

    client.shutdown();

    expect(worker.terminated).toBe(1);
    expect(client.isReady).toBe(false);
    expect(client.info).toBeNull();
    // A deliberate shutdown is not a lost-state event, so the counter resets.
    expect(client.generation).toBe(0);
  });

  it("survives a shutdown with no worker running", () => {
    expect(() => client.shutdown()).not.toThrow();
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("does not fire the boot timeout after a shutdown abandoned the boot", async () => {
    const ready = client.ensureReady();
    let rejected: unknown = null;
    void ready.catch((error: unknown) => (rejected = error));
    const worker = currentWorker();

    client.shutdown();
    expect(worker.terminated).toBe(1);

    vi.advanceTimersByTime(LIMITS.bootTimeoutMs * 2);
    await flushMicrotasks();

    // A second terminate() would mean the timer fired against a worker the
    // client had already released, its rejection would land on a promise
    // nobody holds any more, and the crash teardown would count as a lost
    // interpreter generation for a session that ended deliberately.
    expect(worker.terminated).toBe(1);
    expect(rejected).toBeNull();
    expect(client.generation).toBe(0);
  });

  it("bumps the generation when the idle timer reclaims a warm interpreter", async () => {
    await bootClient(client);
    const worker = currentWorker();

    const promise = client.run("x = 1");
    await flushMicrotasks();
    worker.emit({ t: "done", id: 1, ok: true, status: "ok" });
    await promise;

    expect(client.generation).toBe(0);

    vi.advanceTimersByTime(LIMITS.idleShutdownMs + 1);

    // This path used to call shutdown(), which resets the counter to 0, so the
    // REPL had no way to notice its variables were gone: the next statement
    // failed with a bare NameError and no explanation. Reclaiming the heap
    // behind a live session has to be observable.
    expect(worker.terminated).toBe(1);
    expect(client.generation).toBe(1);
    expect(client.isReady).toBe(false);
  });

  it("leaves a warm interpreter alone while a run is still outstanding", async () => {
    await bootClient(client);
    const worker = currentWorker();

    const promise = client.run("x = 1");
    await flushMicrotasks();
    worker.emit({ t: "done", id: 1, ok: true, status: "ok" });
    await promise;

    // A second run inside the idle window cancels the pending reclaim, so a
    // long-lived REPL is not torn down between two statements. The generous
    // hard timeout is what keeps this test about the idle timer: the default
    // one would fire first and terminate the worker for an unrelated reason.
    const next = client.run("x + 1", { timeoutMs: LIMITS.idleShutdownMs * 4 });
    await flushMicrotasks();
    vi.advanceTimersByTime(LIMITS.idleShutdownMs + 1);
    worker.emit({ t: "done", id: 2, ok: true, status: "ok" });

    await expect(next).resolves.toEqual({ status: "ok", truncated: false });
    expect(worker.terminated).toBe(0);
    expect(client.generation).toBe(0);
  });
});

describe("PythonClient control messages", () => {
  it("posts reset and clearBlock without disturbing the worker", async () => {
    await bootClient(client);
    const worker = currentWorker();

    client.reset();
    client.clearBlock();

    expect(worker.posted).toEqual([
      { t: "init", packages: [] },
      { t: "reset" },
      { t: "clearBlock" },
    ]);
    expect(worker.terminated).toBe(0);
  });

  it("drops control messages when no interpreter is running", () => {
    // Ctrl+C at a prompt before the first boot must not spawn a worker just to
    // tell it to forget a block it never had.
    expect(() => {
      client.clearBlock();
      client.reset();
    }).not.toThrow();
    expect(FakeWorker.instances).toHaveLength(0);
  });
});
