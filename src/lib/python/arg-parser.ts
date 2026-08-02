/**
 * Turn a `python ...` command line into an intent.
 *
 * Pure and filesystem-agnostic: the caller injects a resolver, so this is fully
 * unit-testable and the virtual filesystem stays the terminal's business.
 *
 * The terminal's dispatcher splits on whitespace and does not parse quotes, so
 * the raw argument string is used instead of the tokenized array. Otherwise
 * `python -c "for i in x:\n  print(i)"` loses its indentation and the quotes
 * arrive as literal characters.
 */

/** What the virtual filesystem says about a path. */
export type PathLookup =
  | { kind: "file"; content: string }
  | { kind: "directory" }
  | { kind: "missing" };

export type PythonInvocation =
  | { mode: "repl" }
  | { mode: "version" }
  | { mode: "help" }
  /** Inline source, from `-c` or a bare expression. */
  | { mode: "code"; code: string; filename: string }
  /** A script loaded out of the virtual filesystem. */
  | { mode: "file"; path: string; code: string; filename: string }
  | { mode: "error"; message: string };

/**
 * Remove one balanced pair of surrounding quotes.
 *
 * There is no shell in front of this command, so the quotes a user types in
 * `python -c "print(1)"` arrive verbatim and would otherwise become part of the
 * source. Only a matched outer pair is removed, so `-c 'print("hi")'` keeps its
 * inner quotes.
 */
function stripOuterQuotes(text: string): string {
  const first = text[0];
  const last = text[text.length - 1];
  if (text.length >= 2 && (first === '"' || first === "'") && last === first) {
    return text.slice(1, -1);
  }
  return text;
}

/**
 * Interpret backslash escapes in `-c` source.
 *
 * A literal newline cannot be typed at the prompt, so `\n` is the only way to
 * express a multi-line one-liner. Real CPython leaves this to the shell; here
 * there is no shell to do it.
 */
function unescapeInlineSource(text: string): string {
  return text.replace(/\\(.)/g, (_match, char: string) => {
    switch (char) {
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "r":
        return "";
      case "\\":
        return "\\";
      default:
        return `\\${char}`;
    }
  });
}

/** Looks like a path the user meant as a script, rather than an expression. */
function looksLikeScriptPath(token: string): boolean {
  return token.endsWith(".py");
}

export function parsePythonArgs(
  rawArgs: string,
  lookup: (path: string) => PathLookup,
): PythonInvocation {
  const trimmed = rawArgs.trim();

  // Rule 0: no arguments starts the interactive interpreter.
  if (!trimmed) return { mode: "repl" };

  // Rule 1: options.
  if (trimmed.startsWith("-")) {
    const flagMatch = /^(-{1,2}[A-Za-z-]*)(?:[ \t]+([\s\S]*))?$/.exec(trimmed);
    const flag = flagMatch ? flagMatch[1] : trimmed;
    const rest = flagMatch?.[2] ?? "";

    switch (flag) {
      case "-c": {
        if (!rest.trim()) {
          return {
            mode: "error",
            message: "python: argument -c: expected one argument",
          };
        }
        return {
          mode: "code",
          code: unescapeInlineSource(stripOuterQuotes(rest)),
          filename: "<string>",
        };
      }

      case "-V":
      case "--version":
        return { mode: "version" };

      case "-h":
      case "--help":
      case "-?":
        return { mode: "help" };

      case "-":
        // Real CPython would read a program from stdin. There is no stdin here
        // (reading it would need to block the worker, which without
        // SharedArrayBuffer it cannot do), so fall back to the REPL.
        return { mode: "repl" };

      default:
        // Never silently reinterpret an unknown flag as source: `python -m foo`
        // evaluating `-m foo` as an expression is a baffling error.
        return {
          mode: "error",
          message: `python: unsupported option '${flag}'`,
        };
    }
  }

  const isSingleToken = !/\s/.test(trimmed);

  if (isSingleToken) {
    const found = lookup(trimmed);

    // Rule 2: an existing file wins. This is what someone typing a filename
    // expects, and it is the only ambiguous case worth resolving in their
    // favour.
    if (found.kind === "file") {
      return {
        mode: "file",
        path: trimmed,
        code: found.content,
        filename: trimmed,
      };
    }

    if (found.kind === "directory") {
      return {
        mode: "error",
        message: `python: can't open file '${trimmed}': [Errno 21] Is a directory`,
      };
    }

    // Rule 3: something that looks like a script but is not there is a typo,
    // not an expression. Falling through would evaluate the bare name and
    // report a NameError, which reads as nonsense for a mistyped filename.
    if (looksLikeScriptPath(trimmed)) {
      return {
        mode: "error",
        message: `python: can't open file '${trimmed}': [Errno 2] No such file or directory`,
      };
    }
  }

  // Rule 4: anything else is source.
  return { mode: "code", code: trimmed, filename: "<stdin>" };
}
