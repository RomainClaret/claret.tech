/**
 * Main-thread half of the Python sandbox.
 *
 * Owns the worker lifecycle, the request/response correlation, and the only
 * interrupt available. There is no cooperative interrupt: Pyodide's
 * setInterruptBuffer needs SharedArrayBuffer, which needs COEP, which is
 * deliberately not set on this site (it would break cross-origin images and
 * WebLLM). So `worker.terminate()` is the whole story, and every caller has to
 * accept that interrupting a running statement destroys interpreter state.
 *
 * The client, never the worker, owns settlement. A terminated worker cannot
 * reject its own pending promises, so every teardown path walks the pending map
 * itself. Getting this wrong leaves a REPL that accepts input and never answers.
 */

import {
  LIMITS,
  PYTHON_WORKER_URL,
  VENDORED_PACKAGES,
  PACKAGE_IMPORT_PATTERN,
} from "./config";
import {
  PythonAborted,
  parseWorkerMessage,
  type AbortReason,
  type BootPhase,
  type RunStatus,
  type ToWorkerMessage,
} from "./protocol";
import { sanitizePythonOutput, capOutput } from "./sanitize";

export type OutputStream = "out" | "err";

export interface RunOptions {
  /** "repl" feeds a single line to codeop and may answer "incomplete". */
  kind?: "exec" | "repl";
  /** Shown in tracebacks. */
  filename?: string;
  /** Sanitized output, streamed as it arrives. */
  onOutput?: (text: string, stream: OutputStream) => void;
  /** Fires once if the run outlives LIMITS.softTimeoutMs. Advisory only. */
  onSlow?: () => void;
  /** Overrides the hard timeout. REPL statements get a shorter one. */
  timeoutMs?: number;
}

export interface RunResult {
  status: RunStatus;
  /** True when output hit the cap and was cut short. */
  truncated: boolean;
}

export interface BootInfo {
  python: string;
  pyodide: string;
  /** Vendored packages whose wheel failed to load in this deployment. */
  missing: string[];
}

interface Pending {
  resolve: (r: RunResult) => void;
  reject: (e: Error) => void;
  hardTimer: ReturnType<typeof setTimeout> | null;
  softTimer: ReturnType<typeof setTimeout> | null;
  onOutput?: (text: string, stream: OutputStream) => void;
  truncated: boolean;
  /**
   * Characters delivered so far for this run. Mirrors the worker's own
   * cumulative ceiling, because the worker sits inside the boundary being
   * defended and is not trusted to have enforced it. A per-message cap would
   * not be a copy of that check: the worker can send unbounded messages.
   */
  chars: number;
}

/**
 * Scan source for imports of packages this deployment vendors.
 *
 * Packages have to be loaded before the sandbox hardens, so a one-shot run
 * declares what it needs up front and skips the rest. The REPL cannot predict
 * what will be typed and asks for everything.
 */
export function detectRequiredPackages(source: string): string[] {
  const found = new Set<string>();
  // A global regex carries lastIndex between calls; reset so repeated scans of
  // different sources cannot skip a leading match.
  PACKAGE_IMPORT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PACKAGE_IMPORT_PATTERN.exec(source)) !== null) {
    const name = match[1];
    if ((VENDORED_PACKAGES as readonly string[]).includes(name)) {
      found.add(name);
    }
  }
  return [...found];
}

export class PythonClient {
  private worker: Worker | null = null;
  private readyPromise: Promise<BootInfo> | null = null;
  private loadedPackages: string[] = [];
  private seq = 0;
  /** Bumped on every teardown so late messages from a dead worker are ignored. */
  private epoch = 0;
  private pending = new Map<number, Pending>();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Instance state, not a local in spawn(): teardown() has to be able to clear
   * it. A superseded boot left an armed timer that fired minutes later and tore
   * down whatever healthy interpreter had replaced it.
   */
  private bootTimer: ReturnType<typeof setTimeout> | null = null;
  private bootInfo: BootInfo | null = null;
  private restartCount = 0;

  /** How many times the interpreter has been rebuilt. Drives the "state lost" notice. */
  get generation(): number {
    return this.restartCount;
  }

  get isReady(): boolean {
    return this.bootInfo !== null && this.worker !== null;
  }

  get info(): BootInfo | null {
    return this.bootInfo;
  }

  /**
   * Boot if needed. Memoized, so concurrent callers share one boot.
   *
   * If a caller needs a package the running interpreter was not booted with,
   * the worker is replaced: wheels are unpacked by machinery the prelude
   * purges, so nothing can be added after hardening.
   */
  ensureReady(
    packages: readonly string[] = [],
    onProgress?: (phase: BootPhase) => void,
  ): Promise<BootInfo> {
    const missing = packages.filter((p) => !this.loadedPackages.includes(p));
    if (this.readyPromise && missing.length > 0) {
      this.teardown("shutdown");
    }

    if (!this.readyPromise) {
      const wanted = [...new Set([...this.loadedPackages, ...packages])];
      this.loadedPackages = wanted;
      this.readyPromise = this.spawn(wanted, onProgress);
    }
    return this.readyPromise;
  }

  private spawn(
    packages: string[],
    onProgress?: (phase: BootPhase) => void,
  ): Promise<BootInfo> {
    return new Promise<BootInfo>((resolve, reject) => {
      let worker: Worker;
      try {
        // Module worker: the 314.x distribution is ESM-first. Same-origin, so
        // `worker-src 'self'` covers it without touching the CSP.
        worker = new Worker(PYTHON_WORKER_URL, { type: "module" });
      } catch (err) {
        reject(
          new Error(
            `could not start the Python worker: ${(err as Error).message}`,
          ),
        );
        return;
      }
      this.worker = worker;

      this.bootTimer = setTimeout(() => {
        this.teardown("crash");
        reject(new Error("Python interpreter timed out while starting"));
      }, LIMITS.bootTimeoutMs);

      worker.onmessage = (event: MessageEvent) => {
        // terminate() is synchronous but already-queued events still dispatch,
        // so identity is checked rather than trusting the handler's liveness.
        if (worker !== this.worker) return;

        const msg = parseWorkerMessage(event.data);
        if (!msg) return; // forged or malformed: drop it

        switch (msg.t) {
          case "boot":
            onProgress?.(msg.phase);
            return;

          case "ready": {
            this.clearBootTimer();
            this.bootInfo = {
              python: msg.python,
              pyodide: msg.pyodide,
              missing: msg.missing,
            };
            resolve(this.bootInfo);
            return;
          }

          case "out": {
            const entry = this.pending.get(msg.id);
            if (!entry) return; // output from a run nobody is waiting on
            if (msg.truncated) entry.truncated = true;

            // Cap against the remaining run budget before sanitizing, so the
            // work is bounded for the whole run rather than per message. A
            // forged stream of 512KB messages is otherwise unbounded work on
            // the main thread.
            const remaining = LIMITS.maxOutputChars - entry.chars;
            if (remaining <= 0) {
              entry.truncated = true;
              return;
            }
            const capped = capOutput(msg.text, remaining);
            entry.chars += capped.text.length;
            if (capped.truncated) entry.truncated = true;

            const text = sanitizePythonOutput(capped.text);
            if (text) entry.onOutput?.(text, msg.s);
            return;
          }

          case "done": {
            const entry = this.pending.get(msg.id);
            if (!entry) return;
            this.settle(msg.id);
            if (msg.ok) {
              if (msg.truncated) entry.truncated = true;
              entry.resolve({ status: msg.status, truncated: entry.truncated });
            } else {
              entry.reject(new Error(msg.error));
            }
            this.scheduleIdleShutdown();
            return;
          }

          case "fatal":
            this.clearBootTimer();
            reject(new Error(msg.error));
            this.teardown("crash");
            return;
        }
      };

      // A wasm trap or an out-of-memory kill surfaces here. Without this the
      // pending promise never settles.
      worker.onerror = () => {
        this.clearBootTimer();
        this.teardown("crash");
        reject(new Error("the Python interpreter crashed while starting"));
      };
      worker.onmessageerror = () => {
        // Also settles the boot promise. Without this a messageerror during
        // startup leaves ensureReady() pending for the full boot timeout.
        this.clearBootTimer();
        this.teardown("crash");
        reject(new Error("the Python interpreter sent an unreadable message"));
      };

      this.send({ t: "init", packages });
    });
  }

  private send(msg: ToWorkerMessage): void {
    this.worker?.postMessage(msg);
  }

  private settle(id: number): void {
    const entry = this.pending.get(id);
    if (!entry) return;
    if (entry.hardTimer) clearTimeout(entry.hardTimer);
    if (entry.softTimer) clearTimeout(entry.softTimer);
    this.pending.delete(id);
  }

  /**
   * Kill the interpreter and settle everything waiting on it.
   *
   * Every in-flight run is rejected, not just the targeted one: the worker is
   * gone and none of them can ever complete.
   */
  private clearBootTimer(): void {
    if (this.bootTimer) {
      clearTimeout(this.bootTimer);
      this.bootTimer = null;
    }
  }

  private teardown(reason: AbortReason): void {
    this.epoch++;
    this.clearBootTimer();
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    const worker = this.worker;
    this.worker = null;
    this.readyPromise = null;
    this.bootInfo = null;
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      try {
        worker.terminate();
      } catch {
        /* already gone */
      }
    }

    const waiting = [...this.pending.keys()];
    for (const id of waiting) {
      const entry = this.pending.get(id);
      this.settle(id);
      entry?.reject(new PythonAborted(reason));
    }
    this.pending.clear();

    if (reason !== "shutdown") this.restartCount++;
  }

  /**
   * Ctrl+C on a running statement, or a hard timeout.
   *
   * Respawn starts immediately so the reboot overlaps with the user reading the
   * interrupt message. No progress callback is attached: a stray boot phase
   * would paint over the prompt.
   */
  interrupt(reason: Extract<AbortReason, "interrupt" | "timeout">): void {
    if (!this.worker && this.pending.size === 0) return;
    const packages = this.loadedPackages;
    this.teardown(reason);
    void this.ensureReady(packages).catch(() => {
      /* surfaced on the next run instead */
    });
  }

  /** Abandon a half-typed REPL block. Cheap: the worker is idle at a prompt. */
  clearBlock(): void {
    this.send({ t: "clearBlock" });
  }

  /** Drop all user variables without paying for a respawn. */
  reset(): void {
    this.send({ t: "reset" });
  }

  /** Release the worker and its heap. Called when the terminal closes. */
  shutdown(): void {
    this.teardown("shutdown");
    this.loadedPackages = [];
    this.restartCount = 0;
  }

  private scheduleIdleShutdown(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.pending.size !== 0) return;
      // NOT shutdown(): that resets the generation counter, which is how
      // callers detect that their variables are gone. Reclaiming the heap
      // behind a REPL is still discarding its session, so it has to be
      // observable - otherwise the next statement fails with a bare NameError
      // and no explanation.
      this.teardown("shutdown");
      this.restartCount++;
    }, LIMITS.idleShutdownMs);
  }

  /**
   * Execute code and stream its output.
   *
   * Rejects with PythonAborted when the run is interrupted, times out, or the
   * worker dies. A Python-level error is NOT a rejection: it resolves with
   * status "error" and the traceback already delivered through onOutput, which
   * is what a terminal wants.
   */
  async run(code: string, options: RunOptions = {}): Promise<RunResult> {
    const kind = options.kind ?? "exec";

    if (code.length > LIMITS.maxSourceChars) {
      throw new Error(
        `source is too large (${code.length} characters, limit ${LIMITS.maxSourceChars})`,
      );
    }

    await this.ensureReady(
      kind === "repl" ? VENDORED_PACKAGES : detectRequiredPackages(code),
    );

    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    const id = ++this.seq;
    const epochAtStart = this.epoch;
    const timeoutMs =
      options.timeoutMs ??
      (kind === "repl" ? LIMITS.replTimeoutMs : LIMITS.hardTimeoutMs);

    return new Promise<RunResult>((resolve, reject) => {
      const entry: Pending = {
        resolve,
        reject,
        truncated: false,
        chars: 0,
        onOutput: options.onOutput
          ? (text, stream) => {
              // A run from a previous interpreter must never paint over the
              // prompt of the current one.
              if (this.epoch !== epochAtStart) return;
              options.onOutput?.(text, stream);
            }
          : undefined,
        softTimer: options.onSlow
          ? setTimeout(() => options.onSlow?.(), LIMITS.softTimeoutMs)
          : null,
        hardTimer: setTimeout(() => {
          if (this.pending.has(id)) this.interrupt("timeout");
        }, timeoutMs),
      };
      this.pending.set(id, entry);

      this.send({
        t: "run",
        id,
        kind,
        code,
        filename: options.filename ?? "<stdin>",
      });
    });
  }
}

/** Shared instance. Tests construct their own rather than reaching for this. */
export const pythonClient = new PythonClient();
