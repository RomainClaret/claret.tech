/**
 * A command taking over the input line.
 *
 * The terminal normally reads a line, runs a command, and prints a prompt. A
 * REPL inverts that: it holds the line editor for many lines with its own
 * prompt, its own history, and its own interrupt behavior.
 *
 * This module deliberately knows nothing about Python. Terminal.tsx imports
 * only these types, so the Pyodide client never enters the terminal chunk and
 * the terminal stays testable without mocking a Worker. Any future interactive
 * command (`ai chat` is the obvious candidate) can adopt it instead of growing
 * another special case in the keypress handler.
 */

/** Mutable box, so the terminal and the mode owner see the same value. */
export interface Ref<T> {
  current: T;
}

export interface LineMode {
  /**
   * Prompt to draw. `length` is the VISIBLE width and must exclude any SGR
   * escapes in `text`: the terminal's line-wrapping math uses it to convert
   * between buffer offsets and screen coordinates, and a one-character
   * disagreement corrupts every cursor calculation on the line.
   */
  prompt(): { text: string; length: number };

  /**
   * Handle one submitted line. Resolves when the next prompt should be drawn.
   * The mode is responsible for writing its own output.
   */
  onLine(line: string): Promise<void>;

  /** Ctrl+C. The mode decides whether that abandons a block or kills a run. */
  onInterrupt(): void;

  /** Ctrl+D on an empty line. Conventionally exits. */
  onEof(): void;

  /**
   * The mode's own history, kept separate from the shell's on purpose. Sharing
   * one ring means a later shell Up-arrow replays `for i in range(3):` into the
   * command dispatcher.
   */
  history: string[];
  historyIndex: Ref<number>;

  /**
   * True while a submitted line is still running, so keystrokes are discarded.
   *
   * This is NOT the terminal's `isCommandRunningRef`. That flag also gates the
   * resize backup, so holding it for a whole REPL session would silently break
   * input restoration on window resize.
   */
  busy: Ref<boolean>;
}

/** What the terminal shows before user input. */
export type PromptMode =
  /** Derived from the current user, which login/logout can change. */
  | { kind: "shell" }
  /** Owned by a LineMode. `length` is the visible width. */
  | { kind: "custom"; text: string; length: number };

/**
 * Build a custom prompt, deriving the visible width from the uncolored text.
 *
 * Using one source for both prevents the classic failure where the drawn
 * prompt includes SGR escapes but the measured width does not.
 */
export type CustomPrompt = Extract<PromptMode, { kind: "custom" }>;

export function makePrompt(visible: string, sgr?: string): CustomPrompt {
  return {
    kind: "custom",
    text: sgr ? `${sgr}${visible}${SGR_RESET}` : visible,
    length: visible.length,
  };
}

/**
 * Built from a char code rather than an escape literal: this repo has had
 * invisible control bytes silently corrupt source files, and an ESC that goes
 * missing here produces colour bleed that is hard to trace back.
 */
const SGR_RESET = `${String.fromCharCode(27)}[0m`;

export function createRef<T>(initial: T): Ref<T> {
  return { current: initial };
}
