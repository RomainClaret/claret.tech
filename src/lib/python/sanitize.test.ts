import { describe, it, expect } from "vitest";
import { sanitizePythonOutput, capOutput } from "./sanitize";

// Built from char codes rather than escape literals so the source file stays
// pure ASCII and greppable. Invisible control bytes in a test fixture are how
// you end up debugging the test instead of the code.
const ch = (code: number) => String.fromCharCode(code);
const ESC = ch(0x1b);
const BEL = ch(0x07);
const CSI8 = ch(0x9b); // 8-bit CSI: the single-byte form of ESC [
const ST = ESC + "\\"; // string terminator

/**
 * The invariant the whole module exists to guarantee: nothing a terminal
 * parser can act on survives. Tab (0x09) and newline (0x0A) are the only
 * control characters allowed through.
 */
function controlCharsIn(text: string): string[] {
  return [...text].filter((c) => {
    const n = c.charCodeAt(0);
    const isTabOrNewline = n === 0x09 || n === 0x0a;
    const isC0 = n <= 0x1f;
    const isDelOrC1 = n >= 0x7f && n <= 0x9f;
    return !isTabOrNewline && (isC0 || isDelOrC1);
  });
}

describe("sanitizePythonOutput", () => {
  it("strips every control character from a mixed attack payload", () => {
    const payload = [
      ESC + "[2J", // clear screen
      ESC + "]8;;https://evil.example" + BEL + "click" + ESC + "]8;;" + BEL,
      ESC + "]52;c;ZXZpbA==" + BEL, // clipboard write
      CSI8 + "31m",
      ESC + "7" + ESC + "8", // DECSC / DECRC
      ESC + "Pq" + ST, // DCS
      "\r",
      ch(0x00) + ch(0x7f),
    ].join("");

    expect(controlCharsIn(sanitizePythonOutput(payload))).toEqual([]);
  });

  it("defeats prompt spoofing by removing the carriage return", () => {
    const spoof = "\rguest@Claret.Tech % rm -rf /";
    const out = sanitizePythonOutput(spoof);

    expect(out).not.toContain("\r");
    // The text remains, harmlessly, on the current line: it can no longer
    // repaint over the real prompt.
    expect(out).toBe("guest@Claret.Tech % rm -rf /");
  });

  it("removes OSC 8 hyperlinks so WebLinksAddon cannot render them", () => {
    const link =
      ESC +
      "]8;;https://evil.example" +
      BEL +
      "harmless text" +
      ESC +
      "]8;;" +
      BEL;

    expect(sanitizePythonOutput(link)).toBe("harmless text");
  });

  it("removes CSI colour codes without eating the surrounding text", () => {
    expect(sanitizePythonOutput(ESC + "[31mred" + ESC + "[0m")).toBe("red");
  });

  it("keeps tabs and newlines, which the terminal needs", () => {
    expect(sanitizePythonOutput("a\tb\nc")).toBe("a\tb\nc");
  });

  it("strips bidirectional overrides used to disguise text", () => {
    const disguised = "safe" + ch(0x202e) + "exe.gnp";

    expect(sanitizePythonOutput(disguised)).toBe("safeexe.gnp");
  });

  it("leaves ordinary output completely alone", () => {
    const normal = "Hello, world!\n[1, 2, 3]\n{'a': 1}\n";

    expect(sanitizePythonOutput(normal)).toBe(normal);
  });

  it("handles an ESC at the very end without hanging or throwing", () => {
    expect(controlCharsIn(sanitizePythonOutput("done" + ESC))).toEqual([]);
  });

  it("is idempotent", () => {
    const payload = ESC + "[2Jhello" + ESC + "]8;;x" + BEL;
    const once = sanitizePythonOutput(payload);

    expect(sanitizePythonOutput(once)).toBe(once);
  });
});

describe("capOutput", () => {
  it("passes short text through untouched", () => {
    expect(capOutput("hi", 10)).toEqual({ text: "hi", truncated: false });
  });

  it("truncates and flags oversized text", () => {
    // The realistic case: print("x" * 10**9) arrives as one enormous string.
    const huge = "x".repeat(5000);

    expect(capOutput(huge, 100)).toEqual({
      text: "x".repeat(100),
      truncated: true,
    });
  });

  it("treats the boundary as inclusive", () => {
    expect(capOutput("abc", 3)).toEqual({ text: "abc", truncated: false });
  });
});

describe("sanitizePythonOutput: adversarial input", () => {
  // The worker is allowed to send LIMITS.maxOutputChars (512KB) in one message,
  // so these are sizes ordinary sandboxed Python can actually produce.
  const SIZE = 262144;

  /**
   * A generous ceiling. The point is not to measure throughput but to catch a
   * return to quadratic scanning, which on these inputs is slower by orders of
   * magnitude rather than by a factor. Loose enough not to flake on a loaded
   * CI runner.
   */
  const BUDGET_MS = 2000;

  const timed = (input: string) => {
    const start = performance.now();
    const output = sanitizePythonOutput(input);
    return { output, elapsed: performance.now() - start };
  };

  it("survives unterminated OSC introducers without quadratic scanning", () => {
    // The freeze case. The old implementation used /\][\s\S]*?.../g, so
    // every one of these started a scan to end-of-string that failed and then
    // retried one position later.
    const { output, elapsed } = timed((ESC + "]").repeat(SIZE));

    expect(controlCharsIn(output)).toEqual([]);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it("survives unterminated DCS introducers", () => {
    const { output, elapsed } = timed((ESC + "P").repeat(SIZE));

    expect(controlCharsIn(output)).toEqual([]);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it("survives a flood of complete colour codes", () => {
    const { output, elapsed } = timed((ESC + "[31m").repeat(SIZE / 2));

    expect(output).toBe("");
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it("survives a flood of 8-bit CSI", () => {
    const { output, elapsed } = timed((CSI8 + "31m").repeat(SIZE / 2));

    expect(controlCharsIn(output)).toEqual([]);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it("handles half a megabyte of benign text without mangling it", () => {
    const benign = "penguin ".repeat(SIZE / 4);
    const { output, elapsed } = timed(benign);

    expect(output).toBe(benign);
    expect(elapsed).toBeLessThan(BUDGET_MS);
  });

  it("gives up on an unterminated sequence instead of swallowing the rest", () => {
    // A stray OSC introducer must not hide every subsequent line of output.
    // The parser abandons a sequence that runs past MAX_SEQUENCE_LENGTH.
    const stray = ESC + "]" + "x".repeat(4000) + "\nrecovered\n";

    expect(sanitizePythonOutput(stray)).toContain("recovered");
  });

  it("still terminates a well-formed OSC at its BEL", () => {
    const wellFormed = ESC + "]8;;https://example.com" + BEL + "after";

    expect(sanitizePythonOutput(wellFormed)).toBe("after");
  });

  it("terminates a well-formed OSC at ST", () => {
    const wellFormed = ESC + "]0;title" + ST + "after";

    expect(sanitizePythonOutput(wellFormed)).toBe("after");
  });
});
