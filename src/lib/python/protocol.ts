/**
 * Message contract between the main thread and public/python-worker.js.
 *
 * Worker messages are treated as untrusted input. Sandboxed Python that claws
 * its way back to a JS handle can reach postMessage, so it can forge anything
 * shaped like a protocol message. The validators below are the reason that is
 * merely annoying rather than dangerous: an unrecognized or mistyped message is
 * dropped, ids are matched against the client's own pending map, and all text
 * is sanitized before it reaches the terminal.
 */

import { LIMITS } from "./config";
import { sanitizePythonOutput, capOutput } from "./sanitize";

/** Boot progress. loadPyodide exposes no byte-level hook, so these are phases. */
export type BootPhase = "downloading" | "booting" | "hardening";

export type ToWorkerMessage =
  /**
   * Start booting. `packages` must be complete up front: vendored wheels are
   * unpacked by `_pyodide`, which the prelude purges, so nothing can be loaded
   * once hardening has run.
   */
  | { t: "init"; packages: readonly string[] }
  | {
      t: "run";
      id: number;
      /** "repl" feeds one line to codeop and may answer "incomplete". */
      kind: "exec" | "repl";
      code: string;
      filename: string;
    }
  /** Drop the REPL namespace without paying for a respawn. */
  | { t: "reset" }
  /** Abandon a half-typed block after Ctrl+C at a continuation prompt. */
  | { t: "clearBlock" };

/** Outcome of a completed run. "incomplete" only occurs for kind: "repl". */
export type RunStatus = "ok" | "incomplete" | "error" | "exit";

export type FromWorkerMessage =
  | { t: "boot"; phase: BootPhase }
  /** `missing` lists vendored packages whose wheel failed to load. */
  | { t: "ready"; python: string; pyodide: string; missing: string[] }
  | {
      t: "out";
      id: number;
      s: "out" | "err";
      text: string;
      truncated?: boolean;
    }
  | { t: "done"; id: number; ok: true; status: RunStatus; truncated?: boolean }
  | { t: "done"; id: number; ok: false; error: string }
  | { t: "fatal"; error: string };

/** Why a run stopped without producing a result. */
export type AbortReason = "interrupt" | "timeout" | "crash" | "shutdown";

export class PythonAborted extends Error {
  readonly reason: AbortReason;

  constructor(reason: AbortReason) {
    super(`python run aborted: ${reason}`);
    this.name = "PythonAborted";
    this.reason = reason;
  }
}

/**
 * Recognize an abort without relying solely on `instanceof`.
 *
 * The Python command reaches this module through a dynamic import while the
 * client reaches it statically. Those resolve to one module today, but the
 * production build replaces webpack's splitChunks config wholesale, and a
 * layout that duplicated this module into two chunks would give the class two
 * identities. `instanceof` would then quietly fail and the user would see
 * "python run aborted: timeout" instead of an explanation.
 */
export function isPythonAborted(error: unknown): error is PythonAborted {
  if (error instanceof PythonAborted) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "PythonAborted" &&
    typeof (error as { reason?: unknown }).reason === "string"
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Bound and scrub a short worker-controlled string.
 *
 * Error and version strings are rendered into the terminal just like stdout is,
 * but they used to reach it raw: only `out.text` was sanitized, so a forged
 * `{t:"done", ok:false, error:"<OSC 8 payload>"}` injected a clickable link or
 * a spoofed prompt through the one door the sanitizer did not cover. Doing it
 * here rather than at each call site is what makes the guarantee in this file's
 * header true for every consumer.
 *
 * `out.text` is deliberately NOT handled here: it needs a running per-run
 * budget that only the client tracks.
 */
function safeString(text: string): string {
  return sanitizePythonOutput(capOutput(text, LIMITS.maxMessageChars).text);
}

/**
 * Structural validation of anything arriving from the worker.
 *
 * Deliberately strict about types rather than just checking the tag: a forged
 * `{t:"out", text: <object>}` would otherwise reach term.write().
 */
export function parseWorkerMessage(data: unknown): FromWorkerMessage | null {
  if (!isRecord(data) || typeof data.t !== "string") return null;

  switch (data.t) {
    case "boot":
      return data.phase === "downloading" ||
        data.phase === "booting" ||
        data.phase === "hardening"
        ? { t: "boot", phase: data.phase }
        : null;

    case "ready":
      return typeof data.python === "string" && typeof data.pyodide === "string"
        ? {
            t: "ready",
            python: safeString(data.python),
            pyodide: safeString(data.pyodide),
            missing: Array.isArray(data.missing)
              ? data.missing
                  .filter((m): m is string => typeof m === "string")
                  .map(safeString)
              : [],
          }
        : null;

    case "out":
      return typeof data.id === "number" &&
        (data.s === "out" || data.s === "err") &&
        typeof data.text === "string"
        ? {
            t: "out",
            id: data.id,
            s: data.s,
            text: data.text,
            truncated: data.truncated === true,
          }
        : null;

    case "done": {
      if (typeof data.id !== "number") return null;
      if (data.ok === true) {
        const status = data.status;
        return status === "ok" ||
          status === "incomplete" ||
          status === "error" ||
          status === "exit"
          ? {
              t: "done",
              id: data.id,
              ok: true,
              status,
              truncated: data.truncated === true,
            }
          : null;
      }
      if (data.ok === false) {
        return typeof data.error === "string"
          ? { t: "done", id: data.id, ok: false, error: safeString(data.error) }
          : null;
      }
      return null;
    }

    case "fatal":
      return typeof data.error === "string"
        ? { t: "fatal", error: safeString(data.error) }
        : null;

    default:
      return null;
  }
}
