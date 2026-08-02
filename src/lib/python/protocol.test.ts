import { describe, it, expect } from "vitest";
import { parseWorkerMessage, PythonAborted } from "./protocol";

/**
 * Built from char codes rather than escape literals so this file stays pure
 * ASCII. Tab and newline are the only control characters allowed through.
 */
function controlCharsIn(text: string): string[] {
  return [...text].filter((c) => {
    const n = c.charCodeAt(0);
    if (n === 0x09 || n === 0x0a) return false;
    return n <= 0x1f || (n >= 0x7f && n <= 0x9f);
  });
}
/**
 * parseWorkerMessage is the gate between the sandbox and the main thread.
 * Python that claws its way back to a JS handle can call postMessage, so
 * everything below is treated as attacker-controlled input rather than as a
 * well-formed message from code we wrote.
 */
describe("parseWorkerMessage", () => {
  describe("non-messages", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["a number", 7],
      ["a string", '{"t":"ready"}'],
      ["a boolean", true],
      ["a function", Math.max],
    ])("rejects %s", (_label, value) => {
      expect(parseWorkerMessage(value)).toBeNull();
    });

    it("rejects an array, which is an object but has no tag", () => {
      expect(parseWorkerMessage([{ t: "ready" }])).toBeNull();
    });

    it("rejects an object with no tag", () => {
      expect(parseWorkerMessage({ python: "3.14.0" })).toBeNull();
    });

    it("rejects a non-string tag", () => {
      expect(parseWorkerMessage({ t: 1 })).toBeNull();
    });

    it("rejects an unknown tag", () => {
      expect(parseWorkerMessage({ t: "eval", code: "alert(1)" })).toBeNull();
    });
  });

  describe("boot", () => {
    it.each(["downloading", "booting", "hardening"])(
      "accepts the %s phase",
      (phase) => {
        expect(parseWorkerMessage({ t: "boot", phase })).toEqual({
          t: "boot",
          phase,
        });
      },
    );

    it("rejects an unknown phase", () => {
      expect(parseWorkerMessage({ t: "boot", phase: "finished" })).toBeNull();
    });

    it("rejects a missing phase", () => {
      expect(parseWorkerMessage({ t: "boot" })).toBeNull();
    });
  });

  describe("ready", () => {
    it("accepts a complete ready message", () => {
      expect(
        parseWorkerMessage({
          t: "ready",
          python: "3.14.0",
          pyodide: "314.0.3",
          missing: ["numpy"],
        }),
      ).toEqual({
        t: "ready",
        python: "3.14.0",
        pyodide: "314.0.3",
        missing: ["numpy"],
      });
    });

    it("defaults missing to an empty list when it is not an array", () => {
      // The consumer iterates this to warn about unavailable packages, so a
      // non-array would throw at the call site rather than here.
      expect(
        parseWorkerMessage({
          t: "ready",
          python: "3.14.0",
          pyodide: "314.0.3",
          missing: "numpy",
        }),
      ).toEqual({
        t: "ready",
        python: "3.14.0",
        pyodide: "314.0.3",
        missing: [],
      });
    });

    it("drops non-string entries from missing", () => {
      expect(
        parseWorkerMessage({
          t: "ready",
          python: "3.14.0",
          pyodide: "314.0.3",
          missing: ["numpy", 42, null, { name: "scipy" }],
        }),
      ).toMatchObject({ missing: ["numpy"] });
    });

    it("rejects a non-string version, which would be rendered into the banner", () => {
      expect(
        parseWorkerMessage({ t: "ready", python: {}, pyodide: "314.0.3" }),
      ).toBeNull();
      expect(
        parseWorkerMessage({ t: "ready", python: "3.14.0", pyodide: 314 }),
      ).toBeNull();
    });
  });

  describe("out", () => {
    it("accepts stdout and stderr writes", () => {
      expect(
        parseWorkerMessage({ t: "out", id: 3, s: "out", text: "hello\n" }),
      ).toEqual({
        t: "out",
        id: 3,
        s: "out",
        text: "hello\n",
        truncated: false,
      });
      expect(
        parseWorkerMessage({ t: "out", id: 3, s: "err", text: "boom\n" }),
      ).toMatchObject({ s: "err" });
    });

    it("normalizes a missing truncated flag to false", () => {
      expect(
        parseWorkerMessage({ t: "out", id: 1, s: "out", text: "x" }),
      ).toMatchObject({ truncated: false });
    });

    it("only treats truncated as set when it is literally true", () => {
      expect(
        parseWorkerMessage({
          t: "out",
          id: 1,
          s: "out",
          text: "x",
          truncated: "yes",
        }),
      ).toMatchObject({ truncated: false });
    });

    it("rejects a numeric text, which would reach term.write() unsanitized", () => {
      // sanitizePythonOutput calls String.prototype.replace; a number gets there
      // and throws, killing the terminal instead of the message.
      expect(
        parseWorkerMessage({ t: "out", id: 1, s: "out", text: 123 }),
      ).toBeNull();
    });

    it("rejects an object text for the same reason", () => {
      expect(
        parseWorkerMessage({ t: "out", id: 1, s: "out", text: {} }),
      ).toBeNull();
    });

    it("rejects an unknown stream name", () => {
      expect(
        parseWorkerMessage({ t: "out", id: 1, s: "log", text: "x" }),
      ).toBeNull();
    });

    it("rejects a non-numeric id, which could never match a pending run", () => {
      expect(
        parseWorkerMessage({ t: "out", id: "1", s: "out", text: "x" }),
      ).toBeNull();
    });
  });

  describe("done", () => {
    it.each(["ok", "incomplete", "error", "exit"])(
      "accepts the %s status on a successful run",
      (status) => {
        expect(
          parseWorkerMessage({ t: "done", id: 2, ok: true, status }),
        ).toEqual({ t: "done", id: 2, ok: true, status, truncated: false });
      },
    );

    it("carries a truncation flag reported on completion", () => {
      // The worker also reports truncation here, not only on `out`: flush()
      // early-returns on an empty buffer, so a truncation landing exactly on a
      // flush boundary has no out message left to ride on.
      expect(
        parseWorkerMessage({
          t: "done",
          id: 2,
          ok: true,
          status: "ok",
          truncated: true,
        }),
      ).toEqual({ t: "done", id: 2, ok: true, status: "ok", truncated: true });
    });

    it("sanitizes a forged error string before it can reach the terminal", () => {
      // The threat model in protocol.ts assumes the worker may be compromised
      // and can forge any message. This field used to skip the sanitizer
      // entirely: only out.text was scrubbed, so an error carrying an OSC 8
      // hyperlink or a carriage return reached xterm raw.
      const ESC = String.fromCharCode(0x1b);
      const BEL = String.fromCharCode(0x07);
      const payload =
        ESC + "]8;;https://evil.example" + BEL + "click" + ESC + "[2J\rspoofed";

      const parsed = parseWorkerMessage({
        t: "done",
        id: 1,
        ok: false,
        error: payload,
      });

      expect(parsed).not.toBeNull();
      const error = (parsed as { error: string }).error;
      expect(controlCharsIn(error)).toEqual([]);
      expect(error).not.toContain("evil.example");
    });

    it("rejects an unrecognized status", () => {
      expect(
        parseWorkerMessage({ t: "done", id: 2, ok: true, status: "crashed" }),
      ).toBeNull();
    });

    it("rejects a successful run with no status at all", () => {
      expect(parseWorkerMessage({ t: "done", id: 2, ok: true })).toBeNull();
    });

    it("accepts a failed run carrying an error string", () => {
      expect(
        parseWorkerMessage({
          t: "done",
          id: 2,
          ok: false,
          error: "interpreter is not ready",
        }),
      ).toEqual({
        t: "done",
        id: 2,
        ok: false,
        error: "interpreter is not ready",
      });
    });

    it("rejects a failed run whose error is not a string", () => {
      expect(
        parseWorkerMessage({ t: "done", id: 2, ok: false, error: { code: 1 } }),
      ).toBeNull();
    });

    it("rejects a truthy but non-boolean ok, which would pick the wrong branch", () => {
      expect(
        parseWorkerMessage({ t: "done", id: 2, ok: 1, status: "ok" }),
      ).toBeNull();
    });

    it("rejects a done message with no id to correlate against", () => {
      expect(
        parseWorkerMessage({ t: "done", ok: true, status: "ok" }),
      ).toBeNull();
    });
  });

  describe("fatal", () => {
    it("accepts a fatal message with an error string", () => {
      expect(parseWorkerMessage({ t: "fatal", error: "wasm trap" })).toEqual({
        t: "fatal",
        error: "wasm trap",
      });
    });

    it("rejects a fatal message with no error string", () => {
      expect(parseWorkerMessage({ t: "fatal" })).toBeNull();
      expect(parseWorkerMessage({ t: "fatal", error: 500 })).toBeNull();
    });
  });

  it("rebuilds the message so forged extra fields cannot ride along", () => {
    // The return value is a fresh object, not the input with a type assertion,
    // so nothing the worker invents survives past this function.
    const parsed = parseWorkerMessage({
      t: "boot",
      phase: "booting",
      handler: "self.close",
    });

    expect(parsed).toEqual({ t: "boot", phase: "booting" });
  });
});

describe("PythonAborted", () => {
  it("carries the reason a run stopped, which the terminal branches on", () => {
    const error = new PythonAborted("timeout");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("PythonAborted");
    expect(error.reason).toBe("timeout");
    expect(error.message).toContain("timeout");
  });
});
