/**
 * Make sandbox output safe to hand to xterm.
 *
 * Everything the Python worker sends is untrusted. Python that reaches a JS
 * handle can call postMessage directly, and even ordinary user code can print
 * whatever it likes. Writing that into a terminal emulator unfiltered allows:
 *
 *   - prompt spoofing: print("\rguest@Claret.Tech % rm -rf /") repaints the
 *     current line so the fake prompt is indistinguishable from the real one
 *   - clickable link injection: OSC 8 hyperlinks, which the terminal's
 *     WebLinksAddon will happily render
 *   - screen manipulation: CSI 2J to clear, cursor moves to overwrite earlier
 *     output, DECSC/DECRC to corrupt the line editor's saved cursor
 *
 * This runs on the main thread rather than in the worker on purpose: the worker
 * is inside the trust boundary being defended against.
 *
 * IMPLEMENTATION: a single left-to-right state machine, not regexes.
 *
 * The previous version used lazy quantifiers with no guaranteed terminator
 * (`/\][\s\S]*?(?:|\\)/g`). Against `"]".repeat(262144)`
 * every escape started a scan to end-of-string that failed and then retried one
 * position later, which is quadratic. The worker is allowed to send 512KB in a
 * single message, so ordinary sandboxed Python could freeze the main thread
 * without escaping anything. This parser visits each character exactly once.
 */

// Control characters, by code. Tab and newline are the only ones allowed out.
const TAB = 0x09;
const NEWLINE = 0x0a;
const BELL = 0x07;
const ESC = 0x1b;
const CSI_8BIT = 0x9b;
const DEL = 0x7f;
const C1_END = 0x9f;

/**
 * Give up on an unterminated escape sequence after this many characters.
 *
 * Without a cap, a stray `ESC ]` with no terminator would swallow every
 * subsequent byte of legitimate output. The budget is per sequence and the
 * parser never rewinds, so this stays linear.
 */
const MAX_SEQUENCE_LENGTH = 512;

// Plain constants rather than a const enum: Next.js compiles with
// isolatedModules, which does not support them.
const State = {
  Normal: 0,
  EscSeen: 1,
  /** CSI parameter/intermediate bytes, ended by a final byte 0x40-0x7E. */
  Csi: 2,
  /** OSC / DCS / PM / APC / SOS string, ended by BEL or ST (ESC backslash). */
  StringSeq: 3,
  /** Saw ESC inside a string sequence: a backslash here completes ST. */
  StringSeqEsc: 4,
} as const;

type StateValue = (typeof State)[keyof typeof State];

/** Bidi overrides: they cannot drive the terminal but they disguise text. */
function isBidiOverride(code: number): boolean {
  return (
    code === 0x200e ||
    code === 0x200f ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
}

/**
 * THIS IS THE SECURITY PROPERTY.
 *
 * Every ESC (0x1B), 8-bit CSI (0x9B), BEL, CR, DEL and C0/C1 control character
 * is removed; only tab and newline survive. Once they are gone, no remaining
 * byte sequence can reach xterm's parser as anything but printable text.
 */
function isStrippableControl(code: number): boolean {
  if (code === TAB || code === NEWLINE) return false;
  return code <= 0x1f || (code >= DEL && code <= C1_END);
}

/**
 * Strip everything a terminal could act on, keeping `\n` and `\t`.
 *
 * Every byte that reaches the terminal from the sandbox must pass through here:
 * stdout, stderr, tracebacks (a raised exception's message is attacker
 * controlled), REPL repr echoes (a custom __repr__ can return raw bytes), and
 * the worker's own error and version strings.
 */
export function sanitizePythonOutput(text: string): string {
  const length = text.length;

  let state: StateValue = State.Normal;
  let result = "";
  // Start of the current run of characters that are being kept, so benign
  // output costs one slice rather than one concatenation per character.
  let keepFrom = 0;
  let sequenceLength = 0;

  const drop = (index: number) => {
    if (index > keepFrom) result += text.slice(keepFrom, index);
    keepFrom = index + 1;
  };

  for (let i = 0; i < length; i++) {
    const code = text.charCodeAt(i);

    switch (state) {
      case State.Normal:
        if (code === ESC) {
          drop(i);
          state = State.EscSeen;
          sequenceLength = 0;
        } else if (code === CSI_8BIT) {
          drop(i);
          state = State.Csi;
          sequenceLength = 0;
        } else if (isStrippableControl(code) || isBidiOverride(code)) {
          drop(i);
        }
        break;

      case State.EscSeen:
        drop(i);
        if (code === 0x5b) {
          state = State.Csi; // ESC [
        } else if (
          code === 0x5d || // OSC
          code === 0x50 || // DCS
          code === 0x5e || // PM
          code === 0x5f || // APC
          code === 0x58 // SOS
        ) {
          state = State.StringSeq;
        } else {
          // Two-character escape (RIS, DECSC, DECRC, charset selection).
          state = State.Normal;
        }
        break;

      case State.Csi:
        drop(i);
        // Final byte ends the sequence; anything else is a parameter or
        // intermediate byte.
        if (
          (code >= 0x40 && code <= 0x7e) ||
          ++sequenceLength > MAX_SEQUENCE_LENGTH
        ) {
          state = State.Normal;
        }
        break;

      case State.StringSeq:
        drop(i);
        if (code === BELL) {
          state = State.Normal;
        } else if (code === ESC) {
          state = State.StringSeqEsc;
        } else if (++sequenceLength > MAX_SEQUENCE_LENGTH) {
          state = State.Normal;
        }
        break;

      case State.StringSeqEsc:
        drop(i);
        // ESC backslash is ST and ends the string; anything else was just an
        // ESC inside the payload.
        state = code === 0x5c ? State.Normal : State.StringSeq;
        break;
    }
  }

  if (keepFrom < length) result += text.slice(keepFrom);
  return result;
}

/**
 * Cap a single write so one runaway print cannot stall the main thread.
 *
 * The worker enforces its own ceiling before anything crosses the postMessage
 * boundary. This is the second copy of that check, because the worker sits
 * inside the boundary being defended and is not trusted to have done it.
 *
 * Call this BEFORE sanitizing, so oversized input is bounded before any
 * per-character work happens.
 */
export function capOutput(
  text: string,
  limit: number,
): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };
  return { text: text.slice(0, limit), truncated: true };
}
