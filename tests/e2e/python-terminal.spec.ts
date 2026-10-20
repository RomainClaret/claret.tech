import { test, expect, type Page } from "./utils/fixtures";
import { dismissToasts } from "./utils/toast-utils";
// The two helpers every keyboard-driven terminal test needs. They live in
// utils/ because terminal.spec.ts needs exactly the same ones, and having two
// copies is how one of them ends up reading `.xterm-screen` again.
import { screen, focusTerminal } from "./utils/terminal-utils";
import { routeChunk } from "./utils/chunks";

/**
 * End-to-end coverage for the `python` terminal command.
 *
 * This file carries the security assertions, and it is the only place they can
 * honestly be made. The unit tests exercise mocks: a fake Worker, a fake
 * client. Whether `import js` actually fails, whether the JS globals are really
 * gone, and whether an infinite loop can really be stopped are properties of a
 * real browser running real WebAssembly, so they are checked here or nowhere.
 *
 * Chromium only: the assertions are about the sandbox, not about rendering, and
 * booting an 18MB runtime once per browser is a poor trade.
 */

const isCI = !!process.env.CI;

// Booting Pyodide means fetching ~12MB and initializing CPython. Generous, but
// still bounded: a hang should fail the test rather than stall the suite.
const BOOT_TIMEOUT = isCI ? 120_000 : 60_000;

/**
 * What the screen shows below the last echo of `command`, where its output
 * goes. A wait on the whole screen passed on the echo itself, or on an
 * earlier line: "echo still-alive" waited for /still-alive/, and "exit()"
 * for a prompt the shell had shown before Python started. The command is
 * walked past character by character, row breaks skipped, so a long one
 * that wraps is passed too. Off screen, it cannot match anything.
 */
function below(text: string, command: string): string {
  const start = text.lastIndexOf(command.slice(0, 24));
  if (start < 0) return text;
  let index = start;
  for (
    let matched = 0;
    index < text.length && matched < command.length;
    index++
  ) {
    if (text[index] !== "\n") matched++;
  }
  return text.slice(index);
}

test.describe("Terminal: python", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "chromium only");

  test.beforeEach(async ({ page, isMobile }, testInfo) => {
    // Reason goes in the call, not only the comment: a bare test.skip() shows
    // up in the report with no explanation, which is how skips stop being
    // reviewed.
    test.skip(
      isMobile,
      "the terminal is desktop-only and the REPL needs a physical keyboard",
    );
    testInfo.setTimeout(BOOT_TIMEOUT + 60_000);

    await page.goto("/");
    await page.waitForSelector("nav", { timeout: 15_000 });
    await dismissToasts(page, { timeout: 5000 });
    await openTerminal(page);
  });

  async function openTerminal(page: Page) {
    const toggles = [
      'button[aria-label="Toggle terminal"]',
      '[data-testid="terminal-toggle"]',
      'nav button[aria-label*="terminal" i]',
    ];
    for (const selector of toggles) {
      const button = page.locator(selector).first();
      if ((await button.count()) > 0 && (await button.isVisible())) {
        await button.click();
        await page.waitForSelector('[data-testid="terminal"]', {
          timeout: 30_000,
        });
        // The element appearing is not the same as xterm being ready to take
        // input: it is imported dynamically and its welcome text is written
        // after initialization. Typing before that lands nowhere.
        await expect
          .poll(
            async () => ((await screen(page)).length > 0 ? "ready" : "..."),
            {
              timeout: 30_000,
              intervals: [250, 500, 1000],
            },
          )
          .toBe("ready");
        await page.waitForTimeout(500);
        await focusTerminal(page);
        return;
      }
    }
    // throw, do not skip: this gates every test in the file, and a toggle the
    // app no longer renders is a regression rather than an environment the
    // suite should route around.
    throw new Error(
      `terminal toggle not found (tried: ${toggles.join(", ")}) - the terminal did not render`,
    );
  }

  /**
   * Type a line, submit it, and wait until `expected` shows up on screen.
   *
   * Deliberately not the shared runCommand(): the boot timeout and the
   * whole-screen echo check are specific to a REPL that can take a minute to
   * answer its first line.
   */
  async function run(
    page: Page,
    command: string,
    expected: RegExp,
    timeout = BOOT_TIMEOUT,
  ): Promise<string> {
    await focusTerminal(page);
    await page.keyboard.type(command);

    // Confirm the keystrokes actually landed before submitting. Without this a
    // focus problem shows up much later as "the interpreter produced nothing",
    // which is a slow and misleading way to learn that nothing was typed.
    const echo = command.slice(0, 24);
    await expect
      .poll(
        async () => ((await screen(page)).includes(echo) ? "echoed" : "..."),
        { timeout: 20_000, intervals: [250, 500, 1000] },
      )
      .toBe("echoed");

    await page.keyboard.press("Enter");
    await expect
      .poll(
        async () =>
          expected.test(below(await screen(page), command)) ? "found" : "...",
        { timeout, intervals: [500, 1000, 2000] },
      )
      .toBe("found");
    return screen(page);
  }

  test("answers --version without downloading the runtime", async ({
    page,
  }) => {
    let pyodideRequested = false;
    page.on("request", (req) => {
      if (req.url().includes("/pyodide/")) pyodideRequested = true;
    });

    // Deliberately a short timeout: this must be instant. If it needs a boot,
    // the constant is not pinned and every visitor pays 12MB for a reflex.
    await run(page, "python --version", /Python 3\.\d+/, 10_000);

    expect(pyodideRequested).toBe(false);
  });

  test("says at once when the browser has no WebAssembly", async ({ page }) => {
    // iOS Lockdown Mode and browsers without a JIT offer no WebAssembly. The
    // terminal downloaded the 12 MB runtime anyway, then waited out its 120 s
    // boot timeout to say it "timed out while starting".
    let pyodideRequested = false;
    page.on("request", (req) => {
      if (req.url().includes("/pyodide/")) pyodideRequested = true;
    });
    await page.evaluate(() => {
      delete (window as { WebAssembly?: unknown }).WebAssembly;
    });

    await run(page, 'python -c "print(6*7)"', /needs WebAssembly/, 10_000);

    expect(pyodideRequested).toBe(false);
  });

  test("says in --version what the runtime reports", async ({ page }) => {
    // --version answers from config.ts without a boot, so only this holds
    // those constants to the runtime: they said Python 3.14.0 while Pyodide
    // 314.0.3 runs 3.14.2 (round 24). The package's lock file says 3.14.0
    // too, so only the booted runtime can tell.
    const versions = /Python (\d+\.\d+\.\d+) \(Pyodide (\d+\.\d+\.\d+)\)/;
    const instant = versions.exec(
      below(
        await run(page, "python --version", versions, 10_000),
        "python --version",
      ),
    );

    await focusTerminal(page);
    await page.keyboard.type("python");
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (/>>>/.test(await screen(page)) ? "ready" : "..."), {
        timeout: BOOT_TIMEOUT,
        intervals: [1000, 2000, 5000],
      })
      .toBe("ready");
    // The REPL's banner prints the versions the booted worker reported.
    const banner = new RegExp(`${versions.source} in a sandboxed`).exec(
      await screen(page),
    );

    expect(instant).not.toBeNull();
    expect(banner?.slice(1)).toEqual(instant?.slice(1));
  });

  test("runs inline code", async ({ page }) => {
    const text = await run(page, 'python -c "print(1+1)"', /\b2\b/);
    expect(text).toContain("2");
  });

  test("runs a script from the virtual filesystem", async ({ page }) => {
    const text = await run(
      page,
      "python examples/hello.py",
      /Hello from CPython/,
    );
    expect(text).toContain("Hello from CPython");
  });

  test("reports a mistyped script as a missing file, not a NameError", async ({
    page,
  }) => {
    const text = await run(
      page,
      "python fibonaci.py",
      /No such file or directory/,
      15_000,
    );

    expect(text).toContain("[Errno 2]");
    // The failure mode this guards against: falling through to "run it as
    // code", compiling the bare name, and reporting a NameError.
    expect(text).not.toContain("NameError");
  });

  test.describe("sandbox", () => {
    test("refuses to import the JavaScript bridge", async ({ page }) => {
      const text = await run(page, 'python -c "import js"', /Error/);
      expect(text).toMatch(/ImportError|ModuleNotFoundError/);
    });

    test("survives clearing sys.meta_path to defeat the import blocker", async ({
      page,
    }) => {
      // The obvious bypass: the blocker lives in sys.meta_path, which user code
      // can empty. Pyodide's own finders are removed too, so there is nothing
      // left that knows how to resolve `js`.
      const text = await run(
        page,
        "python -c \"import sys; sys.meta_path.clear(); __import__('js')\"",
        /Error/,
      );
      expect(text).toMatch(/ImportError|ModuleNotFoundError/);
    });

    test("leaves no network globals reachable from Python", async ({
      page,
    }) => {
      // This is the real boundary. Restoring BuiltinImporter reaches
      // _pyodide_core, and to_js mints a JsProxy whose constructor chain yields
      // globalThis. That escape works by design and cannot be closed from
      // inside Python. What must hold is that the room it opens into is empty.
      // The list is deliberately longer than the obvious suspects. The first
      // version checked seven names and would not have caught sendBeacon,
      // which shipped reachable because it was stripped with a bare delete
      // against a prototype property. Everything that can cause egress or a
      // persistent side effect belongs here, including the ones that are not
      // network APIs at first glance:
      //   FontFace  - constructing one with a url source and loading it is a
      //               real fetch, governed by font-src
      //   storage   - getDirectory() is OPFS, i.e. persistent disk writes
      //   serviceWorker - register() is an origin-wide change outliving the tab
      const probe = [
        "import sys, importlib.machinery as m",
        "sys.meta_path[:] = [m.BuiltinImporter]",
        "import _pyodide_core as C",
        "g = C.to_js([]).constructor.constructor('return globalThis')()",
        "names = ['fetch','XMLHttpRequest','WebSocket','WebSocketStream',",
        "         'EventSource','WebTransport','FontFace','FontFaceSet','fonts',",
        "         'importScripts','Worker','SharedWorker','BroadcastChannel',",
        "         'MessageChannel','indexedDB','caches','Notification',",
        "         'RTCPeerConnection','createImageBitmap','SharedArrayBuffer']",
        "nav = ['sendBeacon','serviceWorker','storage','locks','permissions',",
        "       'usb','serial','hid','bluetooth','gpu']",
        "bad = [n for n in names if getattr(g, n, None) is not None]",
        "navobj = getattr(g, 'navigator', None)",
        "bad += ['navigator.'+n for n in nav",
        "        if navobj is not None and getattr(navobj, n, None) is not None]",
        "print('REACH'+'ABLE:', bad)",
      ].join("\\n");

      const text = await run(
        page,
        `python -c "${probe}"`,
        /REACHABLE: \[|Error/,
      );

      // Either the escape fails outright or it lands somewhere with no I/O.
      // Both are acceptable; a populated list is not.
      expect(text).toContain("REACHABLE: []");
    });

    test("cannot manipulate the terminal with escape sequences", async ({
      page,
    }) => {
      // Markers are assembled at runtime so they never appear in the echoed
      // command, which is on screen too and would otherwise satisfy the poll
      // before Python had run at all.
      await run(page, "python -c \"print('SENT'+'INEL')\"", /SENTINEL/);

      // A screen clear, then a carriage return and a spoofed prompt. Neither
      // may take effect: output is stripped of everything a terminal parser
      // can act on.
      const text = await run(
        page,
        "python -c \"print('\\x1b[2J'+'CLR'+'MARK'+'\\\\r'+'guest@Claret.Tech % rm -rf /')\"",
        /CLRMARK/,
      );

      // The screen was not cleared: the earlier marker is still on it.
      expect(text).toContain("SENTINEL");
      expect(text).toContain("CLRMARK");
      // The carriage return did not repaint the line, so the spoofed prompt
      // reads as ordinary text on the same row instead of replacing it.
      expect(text).toMatch(/CLRMARK.*rm -rf/);
    });

    test("survives an output flood without freezing the tab", async ({
      page,
    }) => {
      // Reachable by ordinary sandboxed Python with no escape at all. The
      // sanitizer previously used lazy-quantifier regexes with no guaranteed
      // terminator, so a single permitted 512KB message of escape introducers
      // was quadratic on the main thread.
      // Completion is a sentinel the run prints, not the shell prompt. The
      // guest prompt symbol IS "%", and screen() reads the whole viewport
      // including the prompt that prefixed this very command, so /\$|%/
      // matched on the first poll and run() returned before Pyodide had even
      // booted. Everything typed afterwards hit a legitimately busy terminal
      // and was discarded, which read as a freeze. Same trap the SENTINEL
      // above is written to avoid.
      //
      // The sentinel survives sanitisation only because the 400k-char print
      // exceeds outputChunkChars and forces a flush, so it starts a fresh
      // sanitize pass. Shrink the multiplier below ~8KB of output and it gets
      // swallowed by the unterminated sequence instead.
      const flood =
        "python -c \"print('" +
        "\\\\x1b]" +
        "' * 200000); print('FLOOD'+'DONE')\"";
      await run(page, flood, /FLOODDONE/, BOOT_TIMEOUT);

      // The real assertion: the page still responds afterwards.
      const text = await run(
        page,
        "echo still-responsive",
        /still-responsive/,
        20_000,
      );
      expect(text).toContain("still-responsive");
    });

    test("refuses destructive filesystem calls", async ({ page }) => {
      // open() is deliberately left alone (the emscripten FS is per-worker and
      // dies with it), but the calls that can brick the interpreter for the
      // rest of the session are denied.
      //
      // The old probe counted any exception as a refusal and called each
      // function on a file that did not exist, with one argument even for
      // rename and kill: FileNotFoundError and TypeError passed it with no
      // guard at all. Now the files exist, file calls get valid arguments,
      // and only the sandbox's own RuntimeError counts. The calls that would
      // end the interpreter (abort, _exit, fork, execv, kill) get the wrong
      // number of arguments instead: a TypeError if open, the refusal if not.
      // shutil's calls mostly reach the blocked os ones, so without shutil's
      // own block they still raise the refusal; copytree is caught by the
      // folder it creates before it fails.
      const probe = [
        "import os, shutil",
        "open('/tmp/v', 'w').write('keep')",
        "os.makedirs('/tmp/d', exist_ok=True)",
        "calls = [",
        "  (os, 'remove', ('/tmp/v',)), (os, 'unlink', ('/tmp/v',)),",
        "  (os, 'rmdir', ('/tmp/d',)), (os, 'removedirs', ('/tmp/d',)),",
        "  (os, 'rename', ('/tmp/v', '/tmp/w')), (os, 'replace', ('/tmp/v', '/tmp/w')),",
        "  (os, 'truncate', ('/tmp/v', 0)), (os, 'chmod', ('/tmp/v', 0)),",
        "  (os, 'symlink', ('/tmp/v', '/tmp/s')), (os, 'link', ('/tmp/v', '/tmp/l')),",
        "  (os, 'system', ('true',)), (os, 'popen', ('true',)),",
        "  (os, 'execv', ()), (os, 'fork', (1,)), (os, 'kill', ()),",
        "  (os, 'abort', (1,)), (os, '_exit', ()),",
        "  (shutil, 'rmtree', ('/tmp/d',)), (shutil, 'move', ('/tmp/v', '/tmp/m')),",
        "  (shutil, 'copytree', ('/tmp/d', '/tmp/c')),",
        "]",
        "open_ = []",
        "for module, name, args in calls:",
        "  if not hasattr(module, name): continue",
        "  try:",
        "    getattr(module, name)(*args)",
        "    open_.append(name)",
        "  except RuntimeError as e:",
        "    if 'disabled in the sandbox' not in str(e): open_.append(name)",
        "  except Exception:",
        "    open_.append(name)",
        "intact = (open('/tmp/v').read() == 'keep' and os.path.isdir('/tmp/d')",
        "  and not os.path.exists('/tmp/c'))",
        "print('OP'+'EN', open_, intact)",
      ].join("\\n");
      const command = `python -c "${probe}"`;

      const text = await run(page, command, /OPEN \[.*\] (True|False)/);
      expect(below(text, command)).toContain("OPEN [] True");
    });

    test("has no stdin, and says so instead of hanging", async ({ page }) => {
      // A Python-level input() stub is not enough: sys.stdin.readline() goes
      // straight past it. stdin is closed at the JS level, so both error.
      // Hanging here would block the worker until the hard timeout.
      const text = await run(
        page,
        'python -c "import sys' +
          "\\ntry:" +
          "\\n    sys.stdin.readline()" +
          "\\n    print('READ'+'ABLE')" +
          "\\nexcept Exception as e:" +
          "\\n    print('NO'+'STDIN', type(e).__name__)\"",
        /NOSTDIN|READABLE/,
        30_000,
      );

      expect(text).toContain("NOSTDIN");
    });

    test("stops an infinite loop and stays usable", async ({ page }) => {
      // No SharedArrayBuffer means no cooperative interrupt, so this exercises
      // the only mechanism available: terminate the worker and respawn.
      await focusTerminal(page);
      await page.keyboard.type('python -c "while True: pass"');
      await page.keyboard.press("Enter");

      await expect
        .poll(
          async () =>
            /too long|Timeout|interrupted/i.test(await screen(page))
              ? "stopped"
              : "...",
          { timeout: BOOT_TIMEOUT, intervals: [1000, 2000, 5000] },
        )
        .toBe("stopped");

      // The terminal must still take commands after the interpreter was killed.
      const text = await run(page, "echo still-alive", /still-alive/, 15_000);
      expect(text).toContain("still-alive");
    });
  });

  test("Ctrl+C stops a runaway one-shot run", async ({ page }) => {
    // The abort controller was never read, so the prompt came back while the
    // worker kept running for the full timeout, painting output over the shell.
    await focusTerminal(page);
    await page.keyboard.type(
      'python -c "' + "\\nwhile True:\\n    print('spam')" + '"',
    );
    await page.keyboard.press("Enter");

    // Wait until it is actually producing output, then interrupt: a line of
    // its own, as the command line holds "spam" too, and the Ctrl+C then
    // came while Python was still starting.
    await expect
      .poll(
        async () =>
          (await screen(page))
            .split("\n")
            .some((line) => line.trim() === "spam")
            ? "running"
            : "...",
        {
          timeout: BOOT_TIMEOUT,
          intervals: [500, 1000, 2000],
        },
      )
      .toBe("running");

    await focusTerminal(page);
    await page.keyboard.press("Control+c");

    // The screen going still proved nothing: the terminal drops a cancelled
    // command's output itself (Terminal.tsx's writer), whether Python stopped
    // or not. What Ctrl+C has to do is free the interpreter. With the abort
    // unread, the next run waited behind the busy worker until the first
    // run's 30 s limit killed it.
    const command = "python -c \"print('AFTER'+'CTRLC')\"";
    const text = await run(
      page,
      command,
      /AFTERCTRLC|too long|Timeout|crashed/,
      60_000,
    );
    expect(below(text, command)).toContain("AFTERCTRLC");
  });

  /**
   * After a Ctrl+C, the screen holds the terminal's "Command canceled by
   * user" and its prompt, nothing after them, and the shell still answers.
   */
  async function expectCancelled(page: Page) {
    const cancelled = (text: string) =>
      text.slice(text.lastIndexOf("Command canceled by user"));
    await expect
      .poll(async () =>
        (await screen(page)).includes("Command canceled by user"),
      )
      .toBe(true);
    // Nothing may follow the prompt: no boot line, no output, no banner.
    const settled = cancelled(await screen(page)).trimEnd();
    expect(settled).toMatch(/Claret\.Tech\s*%$/);
    await page.waitForTimeout(5000);
    expect(cancelled(await screen(page)).trimEnd()).toBe(settled);

    const text = await run(page, "echo still-here", /still-here/, 20_000);
    expect(below(text, "echo still-here")).toContain("still-here");
  }

  test("Ctrl+C while the interpreter's code loads stops the run", async ({
    page,
  }) => {
    // The command listened for Ctrl+C only once that code had loaded, so a
    // Ctrl+C before it went unheard: the boot and the program ran anyway,
    // after the terminal's new prompt.
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await routeChunk(
      page.context(),
      "could not start the Python worker",
      async (route, response) => {
        await held;
        await route.fulfill({ response });
      },
    );
    await focusTerminal(page);
    await page.keyboard.type("python -c \"print('LATE'+'RUN')\"");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);
    await page.keyboard.press("Control+c");
    release();

    await expectCancelled(page);
    expect(await screen(page)).not.toContain("LATERUN");
  });

  test("Ctrl+C while CPython downloads keeps the shell", async ({ page }) => {
    // The REPL did not look at the abort: its boot finished, cleared the
    // boot line by restoring a cursor saved above the "^C" lines (erasing
    // them), printed its banner and took the terminal over.
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    // The runtime the boot downloads, not pyodide.mjs: the worker imports
    // that before it can say "Downloading". On the context: the worker asks
    // for these, not the page.
    await page.context().route(/\/pyodide\/(?!pyodide\.mjs)/, async (route) => {
      await held;
      await route.continue();
    });
    await focusTerminal(page);
    await page.keyboard.type("python");
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (await screen(page)).includes("Downloading CPython"), {
        timeout: 30_000,
      })
      .toBe(true);
    await page.keyboard.press("Control+c");
    release();

    await expectCancelled(page);
    expect(await screen(page)).not.toContain(">>>");
  });

  test.describe("interactive interpreter", () => {
    test("enters, evaluates a block, and exits", async ({ page }) => {
      await focusTerminal(page);
      await page.keyboard.type("python");
      await page.keyboard.press("Enter");

      await expect
        .poll(async () => (/>>>/.test(await screen(page)) ? "ready" : "..."), {
          timeout: BOOT_TIMEOUT,
          intervals: [1000, 2000, 5000],
        })
        .toBe("ready");

      // A single expression echoes its repr, like CPython.
      await run(page, "21 * 2", /\b42\b/, 20_000);

      // A block stays open on the continuation prompt until a blank line.
      await focusTerminal(page);
      await page.keyboard.type("for i in range(3):");
      await page.keyboard.press("Enter");
      await expect
        .poll(
          async () => (/\.\.\./.test(await screen(page)) ? "cont" : "..."),
          {
            timeout: 20_000,
          },
        )
        .toBe("cont");

      // Tab indents: it is the only way to indent a body in raw mode, and it
      // must not run shell completion and eat the line.
      await focusTerminal(page);
      await page.keyboard.press("Tab");
      await page.keyboard.type("print('row', i)");
      await page.keyboard.press("Enter");

      // Wait for the body line to be accepted before closing the block. Each
      // submitted line is a round trip to the worker, and keystrokes are
      // deliberately discarded while one is in flight, so a second Enter fired
      // immediately would be swallowed and the block would stay open.
      await expect
        .poll(
          async () =>
            /print\('row', i\)/.test(await screen(page)) ? "accepted" : "...",
          { timeout: 20_000, intervals: [250, 500, 1000] },
        )
        .toBe("accepted");
      await page.waitForTimeout(500);

      // A blank line closes the block and runs it.
      await page.keyboard.press("Enter");

      await expect
        .poll(
          async () =>
            /row 0[\s\S]*row 1[\s\S]*row 2/.test(await screen(page))
              ? "ran"
              : "...",
          { timeout: 20_000, intervals: [500, 1000] },
        )
        .toBe("ran");

      // exit() returns control to the shell prompt.
      await run(page, "exit()", /Claret\.Tech/, 15_000);
      const text = await run(
        page,
        "echo back-in-shell",
        /back-in-shell/,
        15_000,
      );
      expect(text).toContain("back-in-shell");
    });

    test("accepts a pasted multi-line snippet", async ({ page }) => {
      // A paste arrives as one chunk, and onData branches on its first
      // character, so a multi-line block used to be spliced into the buffer
      // with its newlines intact and rejected by codeop as "multiple
      // statements". insertText is how Playwright models a real paste.
      await focusTerminal(page);
      await page.keyboard.type("python");
      await page.keyboard.press("Enter");
      await expect
        .poll(async () => (/>>>/.test(await screen(page)) ? "ready" : "..."), {
          timeout: BOOT_TIMEOUT,
          intervals: [1000, 2000, 5000],
        })
        .toBe("ready");

      // A real paste event, not keyboard.insertText: xterm listens for `paste`
      // on its helper textarea and hands the whole payload to onData, whereas
      // insertText goes through the input path and the newlines never arrive.
      // Using the wrong one made this look broken when it was not.
      await focusTerminal(page);
      await page.evaluate((text) => {
        const textarea = document.querySelector(".xterm-helper-textarea");
        if (!textarea) throw new Error("xterm helper textarea not found");
        const data = new DataTransfer();
        data.setData("text/plain", text);
        textarea.dispatchEvent(
          new ClipboardEvent("paste", {
            clipboardData: data,
            bubbles: true,
            cancelable: true,
          }),
        );
      }, "total = 0\nfor n in range(5):\n    total += n\n\nprint('pasted', total)\n");

      await expect
        .poll(
          async () => (/pasted 10/.test(await screen(page)) ? "ran" : "..."),
          { timeout: 30_000, intervals: [500, 1000, 2000] },
        )
        .toBe("ran");

      const text = await screen(page);
      expect(text).not.toContain("SyntaxError");
    });

    test("Ctrl+C mid-statement leaves exactly one prompt", async ({ page }) => {
      // Ctrl+C redraws the prompt, and the interrupted run's .finally() used to
      // redraw a second one on the same row: 8 columns drawn where
      // getPromptLength() reports 4, desyncing every later cursor calculation.
      await focusTerminal(page);
      await page.keyboard.type("python");
      await page.keyboard.press("Enter");
      await expect
        .poll(async () => (/>>>/.test(await screen(page)) ? "ready" : "..."), {
          timeout: BOOT_TIMEOUT,
          intervals: [1000, 2000, 5000],
        })
        .toBe("ready");

      await focusTerminal(page);
      await page.keyboard.type("while True: pass");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
      await page.keyboard.press("Control+c");
      await page.waitForTimeout(3000);

      const rows = (await screen(page)).split("\n");
      const doubled = rows.filter((row) => /^>>>\s*>>>/.test(row.trim()));
      expect(doubled).toEqual([]);

      // And the interpreter is usable again.
      const text = await run(page, "7 * 6", /\b42\b/, 60_000);
      expect(text).toContain("42");
    });

    test("keeps variables across statements", async ({ page }) => {
      await focusTerminal(page);
      await page.keyboard.type("python");
      await page.keyboard.press("Enter");
      await expect
        .poll(async () => (/>>>/.test(await screen(page)) ? "ready" : "..."), {
          timeout: BOOT_TIMEOUT,
          intervals: [1000, 2000, 5000],
        })
        .toBe("ready");

      await run(page, "colony = 7", />>>/, 20_000);
      const text = await run(page, "colony * 6", /\b42\b/, 20_000);
      expect(text).toContain("42");
    });
  });

  test("has numpy available", async ({ page }) => {
    // The wait accepts either outcome so a missing wheel surfaces as a failed
    // assertion below rather than a poll timeout, which says far less about
    // what went wrong. The assertion itself does not accept both: it used to
    // repeat this same alternation, so the test passed whether numpy loaded or
    // not while its name promised otherwise.
    const text = await run(
      page,
      "python -c \"import numpy as np; print('NUM'+'PY', np.arange(5).sum())\"",
      /NUMPY 10|not available/,
    );
    expect(
      text,
      "numpy did not load: the wheel under /pyodide is missing or failed to import",
    ).toContain("NUMPY 10");
  });
});

// A tab opened before a deploy keeps its old bundle, which starts the worker
// at the URL it knew: without a version, or with an older one. The worker it
// gets is always the new one (never cached), which names its own runtime.
// When the version came from the URL instead, such tabs could not start
// Python. Not Chromium only: no terminal is involved.
test.describe("The Python worker, as an older bundle starts it", () => {
  for (const url of [
    "/python-worker.js",
    "/python-worker.js?pyodide=314.0.3",
  ]) {
    test(`boots from ${url}`, async ({ page, isMobile }, testInfo) => {
      test.skip(isMobile, "the terminal, and Python with it, is desktop-only");
      testInfo.setTimeout(BOOT_TIMEOUT + 30_000);
      await page.goto("/?playwright=true");

      const outcome = await page.evaluate(
        ({ url, timeout }) =>
          new Promise<string>((resolve) => {
            const worker = new Worker(url, { type: "module" });
            const timer = setTimeout(() => resolve("no answer"), timeout);
            worker.onerror = (event) => {
              clearTimeout(timer);
              resolve(`error: ${event.message}`);
            };
            worker.onmessage = (event) => {
              const { t, error } = event.data as { t: string; error?: string };
              if (t !== "ready" && t !== "fatal") return;
              clearTimeout(timer);
              worker.terminate();
              resolve(t === "ready" ? "ready" : `fatal: ${error}`);
            };
            worker.postMessage({ t: "init", packages: [] });
          }),
        { url, timeout: BOOT_TIMEOUT },
      );

      expect(outcome).toBe("ready");
    });
  }
});
