import { describe, it, expect, vi } from "vitest";
import { parsePythonArgs, type PathLookup } from "./arg-parser";

/**
 * The resolver is injected, so the virtual filesystem is a plain map here.
 * Anything absent from the map is missing, which is the common case.
 */
const fsOf =
  (entries: Record<string, PathLookup>) =>
  (path: string): PathLookup =>
    entries[path] ?? { kind: "missing" };

const emptyFs = fsOf({});

describe("parsePythonArgs", () => {
  describe("no arguments", () => {
    it("starts the interactive interpreter when there are no arguments", () => {
      expect(parsePythonArgs("", emptyFs)).toEqual({ mode: "repl" });
    });

    it("starts the interactive interpreter for whitespace-only arguments", () => {
      // The terminal hands over everything that followed the command name, so a
      // trailing space arrives here as an argument string rather than as "".
      expect(parsePythonArgs("   \t ", emptyFs)).toEqual({ mode: "repl" });
    });
  });

  describe("-c inline source", () => {
    it("removes the outer quote pair that a shell would normally have eaten", () => {
      // Nothing parses quotes in front of this command, so they arrive verbatim
      // and would otherwise end up inside the compiled source.
      expect(parsePythonArgs('-c "print(1)"', emptyFs)).toEqual({
        mode: "code",
        code: "print(1)",
        filename: "<string>",
      });
    });

    it("keeps inner quotes, because only a matched outer pair is removed", () => {
      expect(parsePythonArgs(`-c 'print("hi")'`, emptyFs)).toEqual({
        mode: "code",
        code: 'print("hi")',
        filename: "<string>",
      });
    });

    it("leaves an unbalanced quote alone rather than eating half of it", () => {
      expect(parsePythonArgs(`-c "print(1)'`, emptyFs)).toEqual({
        mode: "code",
        code: `"print(1)'`,
        filename: "<string>",
      });
    });

    it("turns \\n and \\t into real whitespace, the only way to type a block", () => {
      // A literal newline cannot be typed at the prompt, so this is how a
      // multi-line one-liner reaches the compiler with its indentation intact.
      expect(
        parsePythonArgs(String.raw`-c "for i in r:\n\tprint(i)"`, emptyFs),
      ).toEqual({
        mode: "code",
        code: "for i in r:\n\tprint(i)",
        filename: "<string>",
      });
    });

    it("drops \\r so a pasted CRLF cannot become a stray carriage return", () => {
      expect(parsePythonArgs(String.raw`-c "a=1\r\nb=2"`, emptyFs)).toEqual({
        mode: "code",
        code: "a=1\nb=2",
        filename: "<string>",
      });
    });

    it("collapses a doubled backslash, which is how a Python-level escape gets through", () => {
      // The user wants Python to see the two characters \ and n, not a newline.
      expect(parsePythonArgs(String.raw`-c "print('a\\nb')"`, emptyFs)).toEqual(
        {
          mode: "code",
          code: String.raw`print('a\nb')`,
          filename: "<string>",
        },
      );
    });

    it("keeps an unrecognized escape as typed", () => {
      // \d has no meaning here; rewriting it would silently corrupt a regex.
      expect(
        parsePythonArgs(String.raw`-c "re.compile('\d')"`, emptyFs),
      ).toEqual({
        mode: "code",
        code: String.raw`re.compile('\d')`,
        filename: "<string>",
      });
    });

    it("reports a missing argument instead of running an empty program", () => {
      expect(parsePythonArgs("-c", emptyFs)).toEqual({
        mode: "error",
        message: "python: argument -c: expected one argument",
      });
    });

    it("reports a missing argument when only whitespace follows -c", () => {
      expect(parsePythonArgs("-c    ", emptyFs)).toEqual({
        mode: "error",
        message: "python: argument -c: expected one argument",
      });
    });
  });

  describe("informational flags", () => {
    it("answers -V without booting the interpreter", () => {
      expect(parsePythonArgs("-V", emptyFs)).toEqual({ mode: "version" });
    });

    it("answers --version the same way", () => {
      expect(parsePythonArgs("--version", emptyFs)).toEqual({
        mode: "version",
      });
    });

    it("answers -h with help", () => {
      expect(parsePythonArgs("-h", emptyFs)).toEqual({ mode: "help" });
    });

    it("answers --help with help", () => {
      expect(parsePythonArgs("--help", emptyFs)).toEqual({ mode: "help" });
    });

    it("answers -? with help, even though it does not match the flag pattern", () => {
      // "?" is not in the flag character class, so this only works because the
      // whole trimmed string is used as the flag when the pattern fails.
      expect(parsePythonArgs("-?", emptyFs)).toEqual({ mode: "help" });
    });
  });

  describe("unsupported options", () => {
    it("falls back to the REPL for a bare dash instead of trying to read stdin", () => {
      // Real CPython reads a program from stdin here. Reading stdin would need
      // to block the worker, which it cannot do without SharedArrayBuffer.
      expect(parsePythonArgs("-", emptyFs)).toEqual({ mode: "repl" });
    });

    it("rejects -m by name rather than evaluating it as an expression", () => {
      // The failure mode this prevents: `python -m foo` compiling "-m foo" and
      // reporting a NameError, which reads as nonsense.
      const parsed = parsePythonArgs("-m foo", emptyFs);

      expect(parsed).toEqual({
        mode: "error",
        message: "python: unsupported option '-m'",
      });
    });

    it("names the flag, not the whole command line, in the error", () => {
      expect(parsePythonArgs("--frozen-modules off", emptyFs)).toEqual({
        mode: "error",
        message: "python: unsupported option '--frozen-modules'",
      });
    });
  });

  describe("script paths", () => {
    it("runs a file that exists, which is what typing a filename means", () => {
      const fs = fsOf({
        "fib.py": { kind: "file", content: "print('fib')\n" },
      });

      expect(parsePythonArgs("fib.py", fs)).toEqual({
        mode: "file",
        path: "fib.py",
        code: "print('fib')\n",
        filename: "fib.py",
      });
    });

    it("runs an existing file even when its name does not end in .py", () => {
      const fs = fsOf({ script: { kind: "file", content: "print(1)" } });

      expect(parsePythonArgs("script", fs)).toEqual({
        mode: "file",
        path: "script",
        code: "print(1)",
        filename: "script",
      });
    });

    it("reports Errno 21 for a directory", () => {
      const fs = fsOf({ projects: { kind: "directory" } });

      expect(parsePythonArgs("projects", fs)).toEqual({
        mode: "error",
        message:
          "python: can't open file 'projects': [Errno 21] Is a directory",
      });
    });

    it("prefers the directory error over the .py typo error", () => {
      const fs = fsOf({ "build.py": { kind: "directory" } });

      expect(parsePythonArgs("build.py", fs)).toEqual({
        mode: "error",
        message:
          "python: can't open file 'build.py': [Errno 21] Is a directory",
      });
    });

    it("reports Errno 2 for a mistyped .py file instead of evaluating the name", () => {
      // The `python fibonaci.py` case. Falling through to Rule 4 would compile
      // the bare name and report a NameError, which tells the user nothing
      // about the actual mistake.
      expect(parsePythonArgs("fibonaci.py", emptyFs)).toEqual({
        mode: "error",
        message:
          "python: can't open file 'fibonaci.py': [Errno 2] No such file or directory",
      });
    });
  });

  describe("bare source", () => {
    it("treats a missing single token that is not a script as an expression", () => {
      // `python foo` where foo does not exist is a name lookup, and NameError is
      // the correct answer for it.
      expect(parsePythonArgs("foo", emptyFs)).toEqual({
        mode: "code",
        code: "foo",
        filename: "<stdin>",
      });
    });

    it("treats a single token that looks like code as code", () => {
      // No whitespace, so this reaches the resolver first and only becomes code
      // once the lookup misses.
      expect(parsePythonArgs("print(1+1)", emptyFs)).toEqual({
        mode: "code",
        code: "print(1+1)",
        filename: "<stdin>",
      });
    });

    it("never consults the filesystem for something containing whitespace", () => {
      const resolve = vi.fn(emptyFs);

      expect(parsePythonArgs("print(1 + 1)", resolve)).toEqual({
        mode: "code",
        code: "print(1 + 1)",
        filename: "<stdin>",
      });
      expect(resolve).not.toHaveBeenCalled();
    });

    it("trims the source it compiles", () => {
      expect(parsePythonArgs("  2 ** 10  ", emptyFs)).toEqual({
        mode: "code",
        code: "2 ** 10",
        filename: "<stdin>",
      });
    });
  });
});
