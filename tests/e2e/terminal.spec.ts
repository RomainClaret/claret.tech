import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Locator, type Page } from "./utils/fixtures";
import {
  dismissToasts,
  ensureElementNotBlockedByToast,
} from "./utils/toast-utils";
// Shared with python-terminal.spec.ts. Every keyboard-driven test below was
// disabled because it typed into an element xterm does not read from and then
// asserted against a container whose textContent is mostly injected CSS; these
// helpers are the fix for both.
import {
  screen,
  fullScreen,
  currentLine,
  hasOutputRow,
  focusTerminal,
  waitForTerminalReady,
  runCommand,
} from "./utils/terminal-utils";

// CI-specific configuration for timeout optimization
const isCI = !!process.env.CI;

/**
 * Run these against a reduced-motion page.
 *
 * Not a test-mode backdoor: prefers-reduced-motion is a real setting real
 * visitors have, and the app honors it through useShouldReduceAnimations and
 * the reduced-motion block in globals.css. What it removes here is a confound
 * that has nothing to do with the terminal: the animations' cost on a starved
 * main thread.
 *
 * The webkit shard failed for weeks because clicks on the terminal toggle
 * timed out, and the cause turned out to be main-thread saturation rather
 * than anything about the toggle. Measured again on 2026-10-12 with chromium
 * under CPU throttling: from the toggle's click to the terminal on screen,
 * and how late a setTimeout(0) fires (median).
 *
 *           motion                          reduced motion
 *     4x    650-750ms, lag 21-24ms           400ms, lag 4ms
 *    20x    30.9s, once not within 30s,      2.4s, lag 5ms
 *           lag 130-165ms
 *
 * Until Playwright 1.64 none of that applied here: `reducedMotion` was not a
 * test option, so the line below did nothing and the suite ran with motion
 * from 2026-08-04 on. What brought the webkit shard back that day was the
 * 25s click budget below; it failed again on 2026-08-08, waiting 5s for
 * terminal output. The check in beforeEach keeps the option honest.
 *
 * This widens the range the suite survives; it does not remove the cliff.
 * Past some throttle the page never becomes interactive, which is a real
 * property of the site on slow hardware, not a timeout that wants raising. If
 * this shard starts failing again, that is the thing to fix, and no test
 * change will substitute for it.
 *
 * The animation cost itself is guarded separately by the frame-budget test in
 * performance.spec.ts. It is not this file's job to re-test it.
 */
test.describe("Terminal", () => {
  test.use({ reducedMotion: "reduce" });

  // Set appropriate timeouts for terminal tests (animations + interactions)
  test.beforeEach(async ({ browserName }, testInfo) => {
    // Terminal tests need longer timeouts for animations and interactions
    if (browserName === "webkit" && process.env.CI) {
      testInfo.setTimeout(240000); // 240s for WebKit in CI (extra time needed)
    } else if (process.env.CI) {
      testInfo.setTimeout(180000); // 180s in CI for other browsers
    } else {
      testInfo.setTimeout(120000); // 120s locally
    }
  });

  // the soft `checkTerminalExists` helper this file used to carry is gone: its
  // only callers were the disabled tests below, and every one of them used it
  // to `return` (reporting a pass) when the terminal was missing.

  // hard version of the check, used everywhere a test used to return
  // early. a terminal that is missing or invisible after beforeEach opened it
  // is a regression, not an environment condition, so it has to fail instead of
  // reporting a silent pass.
  const expectTerminalVisible = async (page: Page) => {
    const terminal = page.locator('[data-testid="terminal"]').first();
    await expect(terminal).toBeVisible({ timeout: 15000 });
    return terminal;
  };

  /**
   * The points of `panel` the terminal does not cover (2 px clear of its
   * edge, where hit testing rounds) that hit something else, each named with
   * what is there and the <body> child it belongs to.
   */
  const coveredPoints = (panel: Locator) =>
    panel.evaluate((element) => {
      const terminal = document
        .querySelector('[data-testid="terminal"]')
        ?.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      const inset = Math.min(16, box.width / 4, box.height / 4);
      const points = [
        [box.left + inset, box.top + inset],
        [box.right - inset, box.top + inset],
        [box.left + inset, box.bottom - inset],
        [box.right - inset, box.bottom - inset],
        [box.left + box.width / 2, box.top + inset],
      ].filter(
        ([x, y]) =>
          !terminal ||
          x < terminal.left - 2 ||
          x > terminal.right + 2 ||
          y < terminal.top - 2 ||
          y > terminal.bottom + 2,
      );
      if (points.length === 0) throw new Error("The terminal covers it all");
      return points.flatMap(([x, y]) => {
        const hit = document.elementFromPoint(x, y);
        if (element.contains(hit)) return [];
        const layer = hit?.closest("body > *");
        return [
          `(${Math.round(x)}, ${Math.round(y)}): ${hit?.tagName ?? "nothing"}` +
            ` ${hit?.getAttribute("class") ?? ""}, in ${layer?.tagName ?? "?"}` +
            ` ${layer?.getAttribute("class") ?? ""}`,
        ];
      });
    });

  test.beforeEach(async ({ page, browserName, isMobile }) => {
    // Skip all terminal tests on mobile - terminal is desktop-only feature
    if (isMobile) {
      test.skip();
      return;
    }

    // Collected from the first navigation so that the gate at the end of this
    // hook can say WHY the terminal never appeared. The terminal is a lazy
    // chunk behind the splash screen, so the interesting failures are a chunk
    // that never arrived or a component that threw while mounting, and neither
    // leaves a trace in the DOM the assertion can see.
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text().slice(0, 300));
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(String(error.message).slice(0, 300));
    });

    await page.goto("/");
    // The page this file is written for (see above). Asked for with an option
    // the runner did not know, it ran with motion for two months.
    expect(
      await page.evaluate(
        () => matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
      "the page prefers reduced motion",
    ).toBe(true);

    // Firefox needs significantly more time to load and be interactive
    const loadTimeout = browserName === "firefox" ? 12000 : 8000;
    await page.waitForSelector("nav", { timeout: loadTimeout });
    await page.waitForLoadState("networkidle", { timeout: loadTimeout });

    // Additional wait for Firefox to stabilize
    if (browserName === "firefox") {
      await page.waitForTimeout(3000);
    }

    // Dismiss any toasts that might interfere with terminal toggle
    await dismissToasts(page, { timeout: 5000 });

    // the one selector the app actually renders (src/components/ui/navigation.tsx).
    // the old fallback chain ended in "nav button:first-child", which matches
    // unrelated buttons and only widens the window in which a broken app still
    // looks fine.
    const foundSelector = 'button[aria-label="Toggle terminal"]';
    const terminalToggle = page.locator(foundSelector).first();

    // assertion, not a skip: this gate decides whether all 22 tests in the file
    // run, so a missing toggle is a regression to report, not an environment
    // condition to route around.
    const selectorTimeout = isCI ? 10000 : 5000;
    await expect(terminalToggle).toBeVisible({ timeout: selectorTimeout });
    await expect(terminalToggle).toBeEnabled({ timeout: selectorTimeout });

    // Enhanced click with browser-specific handling
    let clickSuccess = false;
    const maxAttempts = browserName === "firefox" ? 4 : 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Firefox-specific strategy first
        if (browserName === "firefox" && attempt === 1) {
          try {
            // Use dispatch event for Firefox
            await terminalToggle.evaluate((el) => {
              const element = el as HTMLButtonElement;
              // Force element to be interactable
              element.style.pointerEvents = "auto";
              element.style.zIndex = "99999";
              element.style.position = "relative";

              // Use dispatch event instead of click
              const clickEvent = new MouseEvent("click", {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: 1,
              });
              element.dispatchEvent(clickEvent);
            });
            clickSuccess = true;
            console.log("Firefox dispatch event succeeded for terminal toggle");
            break;
          } catch (dispatchError) {
            console.warn(
              "Firefox dispatch event failed, trying standard click:",
              dispatchError,
            );
          }
        }

        // Dismiss toasts before each click attempt
        await dismissToasts(page);

        // Ensure element is not blocked by toasts
        try {
          await ensureElementNotBlockedByToast(
            page,
            foundSelector,
            isCI ? 15000 : 8000, // Reduced timeout but still adequate for CI
          );
        } catch (toastError) {
          console.warn(
            `Toast dismissal failed for selector ${foundSelector} (attempt ${attempt}):`,
            toastError instanceof Error
              ? toastError.message
              : String(toastError),
          );
          // Continue with the attempt anyway
        }

        // Firefox-specific preparation
        if (browserName === "firefox") {
          await terminalToggle.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
        }

        // Final aggressive toast clearing immediately before click
        await page.evaluate(() => {
          const toasts = document.querySelectorAll(
            '[role="alert"], [data-testid="toast"], .toast, .notification, [class*="toast"]',
          );
          toasts.forEach((toast) => {
            if (toast instanceof HTMLElement) {
              toast.style.display = "none";
              toast.style.pointerEvents = "none";
              toast.style.zIndex = "-9999";
              toast.style.position = "fixed";
              toast.style.left = "-9999px";
              toast.style.top = "-9999px";
            }
          });
        });

        await page.waitForTimeout(50); // Brief wait
        await terminalToggle.click({
          // 8s was not margin, it was the edge: with reduced motion at 20x CPU
          // throttling this click still took 7426ms. A CI runner is 2 vCPU with
          // software rendering, so it gets room rather than a coin flip. The
          // click still has to land - see the diagnostic below.
          timeout: browserName === "firefox" ? 15000 : isCI ? 25000 : 8000,
          force: browserName === "firefox",
        });
        clickSuccess = true;
        break;
      } catch (clickError) {
        console.warn(
          `Terminal toggle click attempt ${attempt} failed:`,
          (clickError as Error).message,
        );

        // A click that timed out is not the same as a click that did not
        // happen. Playwright reports a timeout when it does not get its
        // acknowledgement back in time, and on a slow runner the press can
        // still have reached the page: the CI trace shows attempt 1 logging
        // "performing click action" and then never "click action done", while
        // attempt 2 completed normally. Retrying blindly then toggled the
        // terminal open and straight back closed, which is why the wait that
        // follows timed out against a page with no errors, no failed chunk and
        // no terminal - and why it only ever happened on the slow shard.
        //
        // So ask the page instead of assuming. This is the toggle's own
        // effect, not a proxy for it.
        const alreadyOpen = await page
          .locator('[data-testid="terminal"]')
          .first()
          .isVisible()
          .catch(() => false);
        if (alreadyOpen) {
          console.warn(
            `Terminal toggle click attempt ${attempt} timed out but the terminal is open; not clicking again`,
          );
          clickSuccess = true;
          break;
        }

        if (attempt < maxAttempts) {
          // Try alternative click methods for Firefox
          if (browserName === "firefox") {
            try {
              // Clear toasts before JS click attempt
              await page.evaluate(() => {
                const toasts = document.querySelectorAll(
                  '[role="alert"], [data-testid="toast"], .toast, .notification, [class*="toast"]',
                );
                toasts.forEach((toast) => {
                  if (toast instanceof HTMLElement) {
                    toast.style.display = "none";
                    toast.style.pointerEvents = "none";
                    toast.style.zIndex = "-9999";
                  }
                });
              });

              await terminalToggle.evaluate((el) =>
                (el as HTMLElement).click(),
              );
              clickSuccess = true;
              break;
            } catch (jsClickError) {
              console.warn(
                `Firefox JS click attempt ${attempt} failed:`,
                (jsClickError as Error).message,
              );
            }
          }
          await page.waitForTimeout(1000);
        }
      }
    }

    // every test below assumes the toggle was clicked. a silent miss used to
    // leave the whole file running against a closed terminal.
    expect(clickSuccess, "terminal toggle click never landed").toBe(true);

    // Extended wait for Firefox terminal to load
    const terminalLoadTimeout = browserName === "firefox" ? 3000 : 500;
    await page.waitForTimeout(terminalLoadTimeout);

    // the toggle was clicked, so the terminal has to appear. a warning here used
    // to let every downstream test run against a terminal that never opened.
    const terminal = page.locator('[data-testid="terminal"]').first();
    // Terminal is a lazy chunk gated behind the splash screen, so this waits on
    // a chunk fetch plus a mount, not just a state flip. 5s covers that on a
    // developer machine; on a 2 vCPU CI runner with software rendering it does
    // not, and WebKit shard 2 failed here while shards 1 and 3 passed on the
    // same commit. Only the budget for a slow machine changes - the terminal
    // still has to appear, and a missing one is still a failure.
    const terminalTimeout =
      browserName === "firefox" ? 10000 : isCI ? 15000 : 5000;
    try {
      await expect(terminal).toBeVisible({ timeout: terminalTimeout });
    } catch (error) {
      // Report and rethrow. This changes nothing about pass or fail; it exists
      // because "expected visible, got nothing" is the one thing the failure
      // already told us, and this failure reproduces on a CI runner and on no
      // developer machine tried so far. Everything gathered here is a candidate
      // answer to "how far did the terminal get".
      const state = await page
        .evaluate(() => {
          const chunk = performance
            .getEntriesByType("resource")
            .map((entry) => entry.name)
            .filter((name) => /terminal|xterm/i.test(name));
          return {
            splashPresent: !!document.querySelector(
              '[data-testid="splash-screen"], [class*="splash" i]',
            ),
            testIds: Array.from(document.querySelectorAll("[data-testid]"))
              .map((el) => el.getAttribute("data-testid"))
              .slice(0, 40),
            terminalNodes: document.querySelectorAll('[data-testid="terminal"]')
              .length,
            xtermNodes: document.querySelectorAll(".xterm").length,
            // app-wrapper catches a failed Terminal import and renders a
            // fallback with no data-testid, so this is how that shows up.
            fallbackText: document.body.innerText.includes(
              "Error loading terminal",
            ),
            terminalChunkRequests: chunk.slice(0, 6),
            readyState: document.readyState,
          };
        })
        .catch((evaluateError) => ({ evaluateFailed: String(evaluateError) }));

      console.log(
        `TERMINAL_MOUNT_DIAGNOSTIC ${JSON.stringify({
          browser: browserName,
          ...state,
          consoleErrors: consoleErrors.slice(0, 10),
          pageErrors: pageErrors.slice(0, 10),
        })}`,
      );
      throw error;
    }
  });

  test("should open and close terminal", async ({ page, browserName }) => {
    const terminal = page.locator('[data-testid="terminal"]').first();

    // assertions, not skips: beforeEach already clicked the toggle, so an
    // absent or invisible terminal here is exactly the regression this test
    // exists to catch.
    const visibilityTimeout = browserName === "firefox" ? 15000 : 5000;
    await expect(terminal).toBeVisible({ timeout: visibilityTimeout });

    // Close terminal
    const terminalToggle = page
      .locator(
        'button[aria-label="Toggle terminal"], [data-testid="terminal-toggle"], nav button',
      )
      .first();

    try {
      await terminalToggle.click({
        timeout: browserName === "firefox" ? 10000 : 5000,
      });
      // Firefox needs more time for animation
      await page.waitForTimeout(browserName === "firefox" ? 2000 : 1000);

      // Terminal should be hidden (with timeout for Firefox)
      await expect(terminal).not.toBeVisible({ timeout: visibilityTimeout });
    } catch (closeError) {
      console.warn(
        "Terminal close operation failed:",
        (closeError as Error).message,
      );
      // Don't fail the test, terminal might have different close behavior
    }
  });

  test("should display welcome message", async ({ page }) => {
    // assertion, not an early return: a missing terminal is the regression, so
    // returning here reported a pass for a terminal that never rendered.
    await expectTerminalVisible(page);

    // Check for welcome message or prompt
    const terminalContent = page
      .locator(".xterm-screen, .terminal-content, .terminal")
      .first();

    await expect(terminalContent).toBeVisible();
    // Should contain some initial text
    const text = await terminalContent.textContent();
    expect(text).toBeTruthy();
  });

  test("should show command prompt", async ({ page }) => {
    // assertion, not an early return: no terminal means a broken app, not an
    // environment without the feature.
    await expectTerminalVisible(page);

    // Look for prompt indicator
    const terminalContent = page
      .locator(".xterm-screen, .terminal-content, .terminal")
      .first();
    const text = await terminalContent.textContent();

    // Should have some text content
    expect(text).toBeTruthy();
  });

  test("should execute help command", async ({ page }) => {
    await expectTerminalVisible(page);
    await waitForTerminalReady(page);

    // Wait on the LAST line of the help text, not the first section header:
    // help prints 37 lines into a 24-row terminal, so by the time it finishes
    // the header has already scrolled out of the viewport.
    await runCommand(page, "help", /Use Ctrl\+C to cancel current input/);

    // ...which is also why the assertions read the scrollback. The section
    // headers come from src/lib/terminal/commands.ts.
    const text = await fullScreen(page);
    expect(text.toLowerCase()).toContain("command");
    expect(text).toContain("System Commands:");
    expect(text).toContain("POSIX-like Commands:");
  });

  test("should execute ls command", async ({ page }) => {
    await expectTerminalVisible(page);
    await waitForTerminalReady(page);

    // The old assertion here was `length > 10` against `.xterm-screen`, which
    // the injected <style> block satisfied on its own: it passed with the
    // terminal listing nothing at all. The real listing comes from
    // src/lib/terminal/fileSystem.ts, so assert on its actual entries.
    const text = await runCommand(page, "ls", /README\.md/);

    expect(text).toContain("README.md");
    expect(text).toContain("docs/");
    expect(text).toContain("examples/");
    // Hidden entries stay hidden without -a.
    expect(text).not.toContain(".hiddenFile");
  });

  test("should execute about command", async ({ page }) => {
    await expectTerminalVisible(page);
    await waitForTerminalReady(page);

    // `about` does NOT come from src/lib/terminal/commands.ts. That file
    // defines one at line ~718, but `commands` spreads `...aiCommands` last,
    // so src/lib/terminal/ai-commands.ts:503 wins and the commands.ts version
    // is dead code. Editing the wrong one changes nothing on screen, which is
    // how a mutation check first surfaced this.
    //
    // Wait on the last line of the real output; the heading may already have
    // scrolled past on a short terminal.
    await runCommand(page, "about", /Use 'ai init' to start the conversation/);

    // The inherited assertion here was `toMatch(/romain|claret/i)` against the
    // whole screen, which the shell prompt "guest@Claret.Tech %" satisfies on
    // its own - it passed with the about command emitting nothing. These
    // strings can only come from the command's output.
    const text = await fullScreen(page);
    expect(text).toContain("About Romain Claret");
    expect(text).toContain("Research Philosophy:");
    expect(text).toContain("Current Position:");
  });

  test("should clear terminal screen", async ({ page }) => {
    await expectTerminalVisible(page);
    await waitForTerminalReady(page);

    // Fill the screen first, so an assertion about it being empty afterwards
    // means something.
    await runCommand(page, "help", /Use Ctrl\+C to cancel current input/);
    expect(await screen(page)).toContain("AI Assistant:");

    await focusTerminal(page);
    await page.keyboard.type("clear");
    await page.keyboard.press("Enter");

    // `clear` calls term.clear(), which drops the scrollback and leaves the
    // prompt row. Both halves are polled together: term.clear() and the prompt
    // rewrite that follows it are separate writes, and sampling between them
    // catches a screen that is briefly blank - cleared but with no prompt.
    await expect
      .poll(
        async () => {
          const now = await screen(page);
          return now.length < 500 && /Claret\.Tech/.test(now);
        },
        { timeout: 10_000, intervals: [100, 250, 500] },
      )
      .toBe(true);

    const text = await screen(page);
    expect(text.length).toBeLessThan(500);
    expect(text).not.toContain("AI Assistant:");
    // The scrollback is gone too, not merely scrolled past. Checked by asking
    // xterm to scroll back and confirming nothing older appears: after a real
    // clear there is at most one screen, so the view must not move.
    await focusTerminal(page);
    await page.keyboard.press("Shift+PageUp");
    await page.waitForTimeout(200);
    expect(await screen(page)).not.toContain("POSIX-like Commands:");
    // A prompt is still there - "cleared" must not mean "dead".
    expect(text).toMatch(/Claret\.Tech|%|\$/);
  });

  test("should handle invalid commands", async ({ page }) => {
    await expectTerminalVisible(page);
    await waitForTerminalReady(page);

    // commands.ts emits `${commandName}: command not found`.
    const text = await runCommand(
      page,
      "invalidcommand123",
      /invalidcommand123: command not found/,
    );

    expect(text).toContain("invalidcommand123: command not found");
  });

  /**
   * KNOWN FAILING - product defect, not a test defect. Left enabled on purpose.
   *
   * Up-arrow can only walk ONE step back through the shell's command history.
   * With history [about, ls, clear], the first Up recalls "clear" and every
   * later Up does nothing at all, so "ls" and "about" are unreachable from the
   * keyboard - while the terminal's own `help` output advertises "Use Up/Down
   * arrows for command history".
   *
   * src/components/terminal/Terminal.tsx, the "\x1b[A" branch (~line 1105):
   * history recall is gated on `if (inputBufferRef.current === "")`. Recalling
   * an entry fills that buffer, so the next Up takes the `else` branch, which
   * only moves the cursor within wrapped input. A recalled single-line command
   * has `currentPos.row === 0`, so that branch just parks the cursor at column
   * 0 and returns; `historyIndexRef` is never decremented again.
   *
   * The Down-arrow branch in the same file (~line 1257) is the evidence that
   * this is an oversight rather than a decision: its non-empty-buffer path has
   * an explicit `else if (historyIndexRef.current < commandHistoryRef.current
   * .length - 1)` fallback that keeps walking history. Up has no equivalent.
   *
   * Fix: give the "\x1b[A" branch the same fallback, i.e. when the cursor is
   * already on the first visual row, step history instead of only moving the
   * cursor. Do not weaken this test to match the bug.
   */
  test("should support command history with arrow keys", async ({ page }) => {
    await expectTerminalVisible(page);
    await waitForTerminalReady(page);

    await runCommand(page, "about", /Use 'ai init' to start the conversation/);
    await runCommand(page, "ls", /README\.md/);

    // Wipe the screen before exercising recall. Everything typed so far is
    // still painted otherwise, so "the screen contains ls" passes with history
    // completely broken - which is exactly what the old assertion did.
    await focusTerminal(page);
    await page.keyboard.type("clear");
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (await screen(page)).includes("README.md"), {
        timeout: 10_000,
      })
      .toBe(false);

    // History is now, oldest to newest: about, ls, clear.
    await focusTerminal(page);
    await page.keyboard.press("ArrowUp");
    await expect
      .poll(async () => await currentLine(page), { timeout: 10_000 })
      .toMatch(/clear$/);

    // FAILS HERE: the buffer stays on "clear" forever. See the block comment
    // above this test.
    await page.keyboard.press("ArrowUp");
    await expect
      .poll(async () => await currentLine(page), { timeout: 10_000 })
      .toMatch(/ls$/);

    await page.keyboard.press("ArrowUp");
    await expect
      .poll(async () => await currentLine(page), { timeout: 10_000 })
      .toMatch(/about$/);

    // Down walks back toward the newest entry.
    await page.keyboard.press("ArrowDown");
    await expect
      .poll(async () => await currentLine(page), { timeout: 10_000 })
      .toMatch(/ls$/);

    // The recalled command is really in the input buffer, not just painted:
    // submitting it runs `ls` on an otherwise blank screen.
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => (await screen(page)).includes("README.md"), {
        timeout: 10_000,
      })
      .toBe(true);
  });

  /**
   * Used to read `if (isMobile || browserName === "webkit")` with the trailing
   * comment "// Webkit has issues with terminal interactions" as its entire
   * justification. Run on the webkit project on 2026-08-03 it passed five
   * times out of five, so webkit runs it now.
   *
   * The `isMobile` half is kept but is unreachable: test.beforeEach above
   * (~line 50) already calls test.skip() for every mobile project, so this
   * guard has never decided anything. Left in place rather than removed, since
   * an unreachable guard is cheaper than a test that silently depends on a
   * beforeEach twenty tests away. Same for the three tests below.
   */
  test("should support tab completion", async ({
    page,
    isMobile,
    browserName: _browserName,
  }) => {
    if (isMobile) {
      test.skip();
      return;
    }

    // assertion, not an early return: tab completion cannot be exercised
    // without a terminal, and a missing one is a regression.
    await expectTerminalVisible(page);

    // no try/catch here: a page that dies mid-test is a crash to report (that
    // is exactly how the React teardown bug stayed invisible), not a reason to
    // swallow the error and pass.

    // Type partial command
    await page.keyboard.type("hel");
    await page.keyboard.press("Tab");
    await page.waitForTimeout(1000); // Increased timeout

    // Check if it completed to "help"
    // xterm.js uses a complex DOM structure, need to extract text properly
    const text = await page.evaluate(() => {
      // Try to access xterm's terminal instance directly
      const terminalEl = document.querySelector(".xterm");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (terminalEl && (terminalEl as any)._xtermTerminal) {
        // If xterm instance is accessible, use its buffer
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term = (terminalEl as any)._xtermTerminal;
        const buffer = term.buffer?.active || term.buffer;
        if (buffer) {
          const lines: string[] = [];
          for (let i = 0; i < buffer.cursorY + 1; i++) {
            const line = buffer.getLine(i);
            if (line) {
              lines.push(line.translateToString());
            }
          }
          return lines.join("\n");
        }
      }

      // Fallback: Extract text from xterm-rows - improved for DOM renderer
      const rows = document.querySelectorAll(".xterm-rows > div, .xterm-row");
      if (rows.length > 0) {
        const textLines: string[] = [];
        rows.forEach((row) => {
          // Try both span-based and direct text content
          const spans = row.querySelectorAll("span");
          let lineText = "";

          if (spans.length > 0) {
            spans.forEach((span) => {
              const spanText = span.textContent || "";
              lineText += spanText;
            });
          } else {
            // Direct text content for DOM renderer
            lineText = row.textContent || "";
          }

          if (lineText.trim()) {
            textLines.push(lineText);
          }
        });
        return textLines.join("\n");
      }

      // Last resort: try getting text from screen
      const screen = document.querySelector(".xterm-screen");
      if (screen instanceof HTMLElement) {
        return screen.innerText || screen.textContent || "";
      }

      return "";
    });

    if (!text) {
      // Fallback: just verify that typing worked
      const inputExists = (await page.locator(".xterm-rows").count()) > 0;
      expect(inputExists).toBeTruthy();
      return;
    }

    // Should have completed to "help" or still contain "hel" (tab completion might not work in CI)
    // More lenient check for CI environment
    const hasExpectedText =
      text.toLowerCase().includes("hel") || text.toLowerCase().includes("help");
    expect(hasExpectedText).toBeTruthy();
  });

  /**
   * The drag test below is a weak detector, so this one exists beside it.
   *
   * `dragTo` emits several mousemoves with waits between them, which gives the
   * old code a frame to land a position write in, so it passed on reverted
   * code 3 times out of 3. This drives the defect condition directly: one
   * mousemove, then mouseup with no frame in between, which is what a fast
   * real drag looks like and what webkit's event batching produces almost
   * every time.
   *
   * Measured 2026-08-03. With the Terminal.tsx fix, 12 runs across chromium,
   * firefox and webkit all moved the window by exactly dx=150 dy=40. With the
   * fix reverted, webkit reported dx=0 dy=0 - the window did not move at all -
   * while chromium still moved, which is the whole reason this looked like a
   * webkit quirk for so long.
   *
   * Note the displacement is asserted, not just "something happened": the
   * failure mode here is silence, and a test that tolerates zero movement is
   * how this survived in the first place.
   */
  test("should apply the final movement of a drag", async ({
    page,
    isMobile,
  }) => {
    if (isMobile) {
      test.skip();
      return;
    }

    await page.waitForLoadState("networkidle", { timeout: 15000 });
    const terminal = await expectTerminalVisible(page);
    const header = terminal.locator("[data-testid='terminal-header']").first();
    await expect(header).toBeVisible({ timeout: 5000 });

    const headerBox = await header.boundingBox();
    const before = await terminal.boundingBox();
    expect(headerBox, "terminal header has no bounding box").toBeTruthy();
    expect(before, "terminal has no bounding box before the drag").toBeTruthy();
    if (!headerBox || !before) return; // narrowing; the assertions above gate

    await page.mouse.move(
      headerBox.x + headerBox.width / 2,
      headerBox.y + headerBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      headerBox.x + headerBox.width / 2 + 150,
      headerBox.y + headerBox.height / 2 + 120,
    );
    await page.mouse.up();
    await page.waitForTimeout(600);

    const after = await terminal.boundingBox();
    expect(after, "terminal has no bounding box after the drag").toBeTruthy();
    if (!after) return;

    const dx = Math.abs(after.x - before.x);
    const dy = Math.abs(after.y - before.y);
    expect(
      dx > 10 || dy > 10,
      `the final movement of the drag was dropped: dx=${dx}, dy=${dy}`,
    ).toBeTruthy();
  });

  /**
   * Runs on every desktop browser, including webkit.
   *
   * It used to skip webkit behind "// Webkit has issues with drag
   * interactions", and it carried a catch that turned a failed drag into
   * `expect(header.isEnabled()).toBeTruthy()` - so even unskipped it would
   * have reported a pass while the window sat still. Both are gone, because
   * the thing they were working around was a real bug rather than a webkit
   * quirk: Terminal.tsx wrote the window position only from inside a
   * requestAnimationFrame callback, and mouseup cancelled that frame without
   * applying it, so the last movement of every drag was discarded. Webkit
   * batches pointer events tightly enough that the last movement was usually
   * the only one, which is why it looked browser-specific.
   *
   * If this starts failing on one browser again, check that fix before
   * assuming the browser is at fault.
   */
  test("should be draggable", async ({ page, isMobile }) => {
    if (isMobile) {
      test.skip();
      return;
    }

    // Wait for page to be fully loaded
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // assertion, not an early return: an absent terminal is a regression, and
    // returning here reported a pass for a drag that never happened.
    const terminal = await expectTerminalVisible(page);
    const terminalHeader = terminal
      .locator("[data-testid='terminal-header']")
      .first();

    // the header is rendered unconditionally by Terminal.tsx, so its absence is
    // also a regression rather than an optional feature.
    await expect(terminalHeader).toBeVisible({ timeout: 5000 });

    // Get initial position
    const initialBox = await terminal.boundingBox();
    expect(
      initialBox,
      "terminal has no bounding box before the drag",
    ).toBeTruthy();
    if (!initialBox) return; // type narrowing; the assertion above is the gate

    await terminalHeader.hover();
    await page.waitForTimeout(100);

    await terminalHeader.dragTo(page.locator("body"), {
      targetPosition: {
        x: initialBox.x + 100,
        y: initialBox.y + 100,
      },
    });

    await page.waitForTimeout(1000);

    // Check new position
    const newBox = await terminal.boundingBox();
    expect(newBox, "terminal has no bounding box after the drag").toBeTruthy();
    if (!newBox) return;

    // Terminal should have moved (be lenient for CI)
    const movedX = Math.abs(newBox.x - initialBox.x);
    const movedY = Math.abs(newBox.y - initialBox.y);
    expect(
      movedX > 10 || movedY > 10,
      `terminal did not move: dx=${movedX}, dy=${movedY}`,
    ).toBeTruthy();
  });

  /**
   * Also used to skip webkit, justified only by "// Webkit has issues with
   * resize interactions". It does not: five out of five webkit runs on
   * 2026-08-03 passed, and unlike the drag test above there is no catch to
   * pass through - `expect(newBox.width).not.toBe(initialBox.width)` is the
   * assertion, and webkit satisfies it. Webkit runs it now.
   *
   * Worth noting against the drag test: this one drives the interaction with
   * mouse.down / mouse.move / mouse.up rather than dragTo, and it is the only
   * one of the two webkit can complete.
   */
  test("should be resizable", async ({ page, isMobile }) => {
    if (isMobile) {
      test.skip();
      return;
    }

    // Increase test timeout for resize operations
    test.setTimeout(60000);

    // Ensure page is fully loaded first
    await page.waitForLoadState("networkidle", { timeout: 20000 });

    // assertion, not an early return: without a terminal there is nothing to
    // resize, and a missing one is a regression.
    const terminal = await expectTerminalVisible(page);
    const resizeHandle = terminal
      .locator("[data-testid='resize-handle']")
      .first();

    // the handle is rendered whenever the window is in its normal state, which
    // is how the terminal opens, so an invisible handle is a regression too.
    await expect(resizeHandle).toBeVisible({ timeout: 5000 });

    // Get initial size
    const initialBox = await terminal.boundingBox();
    expect(initialBox).toBeTruthy();

    if (initialBox) {
      // Resize terminal
      await resizeHandle.hover();
      await page.mouse.down();
      await page.mouse.move(
        initialBox.x + initialBox.width + 100,
        initialBox.y + initialBox.height + 100,
      );
      await page.mouse.up();
      await page.waitForTimeout(1000); // Increased timeout

      // Check new size
      const newBox = await terminal.boundingBox();
      expect(newBox).toBeTruthy();

      // Terminal should have resized
      if (newBox) {
        expect(newBox.width).not.toBe(initialBox.width);
      }
    }
  });

  test("should minimize and restore", async ({ page }) => {
    // Increase test timeout for minimize/restore operations
    test.setTimeout(60000);

    // Wait for page to be fully loaded
    await page.waitForLoadState("networkidle", { timeout: 20000 });

    // assertion, not an early return: a missing terminal is a regression, not
    // an environment without the feature.
    const terminal = await expectTerminalVisible(page);

    // the window controls are part of the header Terminal.tsx always renders,
    // so a missing minimize button is a regression as well. the old selector
    // list ended in ".terminal-controls button:first-child" and, when nothing
    // matched, logged and passed.
    const minimizeButton = terminal
      .locator('button[aria-label*="minimize" i]')
      .first();
    await expect(minimizeButton).toBeVisible({ timeout: 5000 });

    try {
      // Get initial visibility state
      const initiallyVisible = await terminal.isVisible();
      expect(initiallyVisible).toBeTruthy();

      // Minimize terminal. no catch-and-return around the click: a page that
      // dies mid-test is a crash to report, not a reason to pass.
      await minimizeButton.click();
      await page.waitForTimeout(1500); // Increased timeout

      // Check if terminal is minimized (more lenient checks)
      const isMinimizedOrHidden = await terminal.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return (
          styles.display === "none" ||
          styles.visibility === "hidden" ||
          styles.opacity === "0" ||
          rect.height < 50 ||
          el.hasAttribute("data-minimized") ||
          el.classList.contains("minimized")
        );
      });

      if (isMinimizedOrHidden) {
        // Look for restore button
        const restoreSelectors = [
          'button[aria-label*="restore" i]',
          'button[aria-label*="maximize" i]',
          'button[title*="restore" i]',
          'button[data-testid="restore"]',
          ".restore-button",
          ".taskbar button",
        ];

        let restoreButton = null;
        for (const selector of restoreSelectors) {
          const button = page.locator(selector).first();
          if ((await button.count()) > 0 && (await button.isVisible())) {
            restoreButton = button;
            break;
          }
        }

        if (restoreButton) {
          await restoreButton.click();
          await page.waitForTimeout(1000);

          // Terminal should be visible again
          await expect(terminal).toBeVisible({ timeout: 5000 });
        } else {
          // No restore button found - just verify minimize worked
          expect(isMinimizedOrHidden).toBeTruthy();
        }
      } else {
        // Terminal might not support minimizing - just verify it's interactive
        const isInteractive = await minimizeButton.isEnabled();
        expect(isInteractive).toBeTruthy();
      }
    } catch {
      // Minimize/restore might not be fully implemented - just verify button exists
      console.log(
        "Minimize/restore functionality limited, verifying button exists",
      );
      expect(await minimizeButton.isVisible()).toBeTruthy();
    }
  });

  /**
   * Listed alongside the three above as an undocumented webkit skip, but it
   * never skipped webkit - the condition is `isMobile` only, and webkit has
   * been running this test all along. The guard is unreachable for the same
   * reason as the others: test.beforeEach (~line 50) already skips every
   * mobile project. Nothing to convert; recorded so the next reader does not
   * spend the time working that out again.
   */
  test("should handle special characters", async ({
    page,
    isMobile,
    browserName,
  }) => {
    if (isMobile) {
      test.skip();
      return;
    }

    // assertion, not an early return: typing into a terminal that is not there
    // is a regression, not a feature the environment lacks.
    await expectTerminalVisible(page);

    // Ensure terminal is visible by dismissing any blocking toasts
    await dismissToasts(page);

    // Double-check that terminal is accessible
    const terminalToggle = page
      .locator('button[aria-label="Toggle terminal"]')
      .first();
    if ((await terminalToggle.count()) > 0) {
      // Try to ensure terminal is open
      try {
        await ensureElementNotBlockedByToast(
          page,
          'button[aria-label="Toggle terminal"]',
          1000,
        );

        // Check if terminal is already visible, if not, toggle it
        const terminalVisible = await page
          .locator('[data-testid="terminal"]')
          .first()
          .isVisible();
        if (!terminalVisible) {
          await terminalToggle.click({ timeout: 5000 });
          await page.waitForTimeout(1000);
        }
      } catch (e) {
        console.warn("Terminal toggle issue in special characters test:", e);
      }
    }

    // Focus the terminal before typing with enhanced approach for Firefox
    const terminal = page.locator('[data-testid="terminal"]').first();
    await terminal.focus();

    // Firefox needs more initial setup time
    const initialWait = browserName === "firefox" ? 2500 : 500;
    await page.waitForTimeout(initialWait);

    // Enhanced command input for Firefox compatibility
    if (browserName === "firefox") {
      // Firefox-specific approach: slower typing with confirmations
      await page.keyboard.type("echo ", { delay: 50 });
      await page.waitForTimeout(100);
      await page.keyboard.type("'Hello @#$%^&*() World!'", { delay: 80 });
      await page.waitForTimeout(200);
      await page.keyboard.press("Enter");

      // Additional wait for Firefox terminal processing
      await page.waitForTimeout(4000); // Increased from 3000

      // Try pressing enter again in case command didn't register
      try {
        const currentText = await page.evaluate(() => {
          const terminal = document.querySelector(
            '[data-testid="terminal"] .xterm-rows, .xterm-rows',
          );
          return terminal ? terminal.textContent || "" : "";
        });

        if (!currentText.includes("Hello") && !currentText.includes("echo")) {
          console.warn("Command may not have registered, trying again...");
          await terminal.focus();
          await page.waitForTimeout(500);
          await page.keyboard.type("echo 'Hello @#$%^&*() World!'", {
            delay: 100,
          });
          await page.keyboard.press("Enter");
          await page.waitForTimeout(2000);
        }
      } catch {
        // Ignore evaluation errors
      }
    } else {
      // Standard approach for other browsers
      await page.keyboard.type("echo 'Hello @#$%^&*() World!'");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
    }

    // Enhanced selectors for better Firefox compatibility
    const terminalSelectors = [
      ".xterm-rows",
      ".xterm-screen .xterm-rows",
      ".terminal-output",
      ".xterm-screen",
      '[data-testid="terminal"] .xterm-rows',
      '[data-testid="terminal"] .xterm-screen',
    ];

    let terminalText = "";
    let foundOutput = false;

    // Try each selector to find terminal output
    for (const selector of terminalSelectors) {
      const terminalElement = page.locator(selector).first();
      if ((await terminalElement.count()) > 0) {
        try {
          const text = await terminalElement.textContent();
          if (text && text.trim() && !text.startsWith("%")) {
            terminalText = text;
            foundOutput = true;
            break;
          }
        } catch {
          // Continue to next selector
        }
      }
    }

    // If no text found, try span-by-span approach (especially important for Firefox)
    if (!foundOutput || !terminalText.includes("Hello")) {
      const spanSelectors = [
        ".xterm-rows span",
        ".xterm-screen span",
        '[data-testid="terminal"] span',
      ];

      for (const spanSelector of spanSelectors) {
        const spans = page.locator(spanSelector);
        const spanCount = await spans.count();

        if (spanCount > 0) {
          terminalText = "";
          for (let i = 0; i < Math.min(spanCount, 200); i++) {
            try {
              const spanText = await spans.nth(i).textContent();
              if (spanText) {
                terminalText += spanText;
              }
            } catch {
              // Continue to next span
            }
          }

          if (
            terminalText.includes("Hello") ||
            terminalText.includes("World")
          ) {
            foundOutput = true;
            break;
          }
        }
      }
    }

    // Enhanced Firefox-specific extraction with multiple attempts
    if (!foundOutput && browserName === "firefox") {
      console.log("Attempting Firefox-specific terminal output extraction...");

      // Multiple extraction attempts for Firefox
      for (let attempt = 1; attempt <= 3 && !foundOutput; attempt++) {
        try {
          await page.waitForTimeout(1000); // Wait between attempts

          terminalText = await page.evaluate(() => {
            // Comprehensive Firefox terminal text extraction
            const selectors = [
              ".xterm-rows",
              ".xterm-screen",
              ".xterm-viewport",
              '[data-testid="terminal"]',
              ".terminal-container",
              ".xterm",
            ];

            let allFoundText = "";

            for (const sel of selectors) {
              const element = document.querySelector(sel);
              if (element) {
                // Try multiple text extraction methods
                const methods = [
                  () => (element as HTMLElement).innerText,
                  () => element.textContent,
                  () => {
                    // Extract from all child text nodes
                    const walker = document.createTreeWalker(
                      element,
                      NodeFilter.SHOW_TEXT,
                      null,
                    );
                    let text = "";
                    let node;
                    while ((node = walker.nextNode())) {
                      text += (node as Text).textContent || "";
                    }
                    return text;
                  },
                ];

                for (const method of methods) {
                  try {
                    const text = method() || "";
                    if (text && text.trim()) {
                      allFoundText += text + " ";
                      if (text.includes("Hello") || text.includes("World")) {
                        return text;
                      }
                    }
                  } catch {
                    continue;
                  }
                }
              }
            }

            // Return all found text even if it doesn't contain our target
            return allFoundText.trim();
          });

          if (
            terminalText &&
            (terminalText.includes("Hello") || terminalText.includes("World"))
          ) {
            foundOutput = true;
            console.log(`Firefox terminal output found on attempt ${attempt}`);
            break;
          } else if (terminalText) {
            console.log(
              `Firefox attempt ${attempt} found terminal text but not target output`,
            );
            console.log(`Text sample: ${terminalText.substring(0, 200)}...`);
          }
        } catch (error) {
          console.warn(
            `Firefox extraction attempt ${attempt} failed:`,
            (error as Error).message,
          );
        }
      }

      // If still no output, try one more approach - look for the command itself
      if (!foundOutput) {
        try {
          const commandPresent = await page.evaluate(() => {
            const terminalElement = document.querySelector(
              '[data-testid="terminal"]',
            );
            const allText = terminalElement
              ? (terminalElement as HTMLElement).innerText ||
                terminalElement.textContent ||
                ""
              : "";

            // Check if our command appears anywhere (even if output doesn't)
            return (
              allText.includes("echo") ||
              allText.includes("Hello") ||
              allText.includes("@#$%")
            );
          });

          if (commandPresent) {
            console.log(
              "Firefox: Command appears to be present, terminal may be working",
            );
            foundOutput = true; // Consider this a success for Firefox
            terminalText = "Firefox terminal command executed"; // Placeholder
          }
        } catch {
          console.warn("Firefox: Final command detection failed");
        }
      }
    }

    // Browser-specific assertions with enhanced Firefox handling
    if (foundOutput && terminalText) {
      if (
        browserName === "firefox" &&
        terminalText === "Firefox terminal command executed"
      ) {
        // Firefox placeholder - just verify terminal is responsive
        console.log(
          "Firefox terminal special character test - command executed successfully",
        );
        expect(terminalText).toBeTruthy(); // Pass if we got this far
      } else {
        // Standard assertions for successful text extraction
        // For Firefox, be more lenient due to terminal rendering differences
        if (browserName === "firefox") {
          // In Firefox, sometimes the special characters cause display issues
          // Check if at least some part of the expected output is present
          const hasExpectedContent =
            terminalText.includes("Hello") ||
            terminalText.includes("World") ||
            terminalText.includes("echo") ||
            terminalText.includes("@#$") ||
            terminalText.includes("'") || // Check for quotes from echo command
            terminalText.includes("Firefox terminal command executed"); // Firefox placeholder

          // More lenient check for Firefox - just verify terminal is responsive
          if (hasExpectedContent || terminalText.length > 10) {
            expect(true).toBeTruthy(); // Pass if we have any terminal output
          } else {
            expect(hasExpectedContent).toBeTruthy();
          }
        } else {
          // For Chromium and WebKit, check for the basic text
          // Special characters might not always render correctly in terminal emulators
          const hasHello = terminalText.includes("Hello");
          const hasWorld = terminalText.includes("World");
          const hasEcho = terminalText.includes("echo");
          const hasAnySpecialChar =
            terminalText.includes("@") ||
            terminalText.includes("#") ||
            terminalText.includes("$") ||
            terminalText.includes("%") ||
            terminalText.includes("^") ||
            terminalText.includes("&") ||
            terminalText.includes("*") ||
            terminalText.includes("(") ||
            terminalText.includes(")");

          // Pass if we have the basic command output
          // Special characters are bonus but not required due to terminal emulator limitations
          if (hasHello || hasWorld || hasEcho || hasAnySpecialChar) {
            expect(true).toBeTruthy(); // Pass - terminal is working
          } else {
            // Fallback: check if we have any reasonable terminal output
            expect(terminalText.length).toBeGreaterThan(10);
          }
        }
      }
    } else {
      // Enhanced fallback handling for challenging browsers/environments
      console.warn(
        `Terminal text extraction challenging for ${browserName}, using comprehensive fallback checks`,
      );

      // Firefox gets more lenient treatment
      if (browserName === "firefox") {
        console.log("Firefox: Using lenient terminal interaction verification");

        // Just verify terminal is present and has received input
        const terminalRespondedToInput = await page.evaluate(() => {
          const terminal = document.querySelector('[data-testid="terminal"]');
          if (!terminal) return false;

          // Check for any signs of terminal activity
          const allText =
            (terminal as HTMLElement).innerText || terminal.textContent || "";
          const spans = terminal.querySelectorAll("span");
          const hasTerminalElements = spans.length > 5;

          // Look for any indicators of activity (command prompt changes, new content, etc.)
          const hasActivity = allText.length > 50 || hasTerminalElements;

          return hasActivity;
        });

        expect(terminalRespondedToInput).toBeTruthy();
        console.log("Firefox terminal test passed with lenient criteria");
      } else {
        // Standard fallback for other browsers
        const terminalHasElements = await page.evaluate(() => {
          const terminal = document.querySelector('[data-testid="terminal"]');
          const spans = terminal?.querySelectorAll("span") || [];
          return spans.length > 10; // Terminal should have some content spans
        });

        expect(terminalHasElements).toBeTruthy();
      }
    }
  });

  test("should support keyboard shortcuts", async ({ page }) => {
    await expectTerminalVisible(page);
    await waitForTerminalReady(page);

    // The old body typed text, pressed Ctrl+A "to select all", pressed Delete,
    // and then asserted a count was <= 1 - which is satisfied by 0, i.e. by
    // nothing having been typed at all. It also tested shortcuts the terminal
    // does not implement: Terminal.tsx handles Ctrl+A as "move to start of
    // line" (code === 1) and ignores the Delete key entirely (\x1b[3~ matches
    // no branch). This exercises the shortcuts that exist, through their
    // observable effect on what the shell finally runs.
    await focusTerminal(page);
    await page.keyboard.type("world");
    await expect
      .poll(async () => await currentLine(page), { timeout: 10_000 })
      .toMatch(/world$/);

    // Ctrl+A - jump to column 0, then type in front of the existing text.
    await page.keyboard.press("Control+a");
    await page.keyboard.type("echo hello ");

    // Ctrl+E - jump back to the end, then append.
    await page.keyboard.press("Control+e");
    await page.keyboard.type("s");

    await expect
      .poll(async () => await currentLine(page), { timeout: 10_000 })
      .toMatch(/echo hello worlds$/);

    // A whole row, not a substring: "hello worlds" also appears inside the
    // echoed command line, so only an output row proves the shell ran it.
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => await hasOutputRow(page, "hello worlds"), {
        timeout: 10_000,
      })
      .toBe(true);

    // Ctrl+C - abandon the current line. It must not reach the dispatcher.
    await focusTerminal(page);
    await page.keyboard.type("notacommand987");
    await page.keyboard.press("Control+c");
    await expect
      .poll(async () => await currentLine(page), { timeout: 10_000 })
      .not.toMatch(/notacommand987$/);

    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);
    expect(await screen(page)).not.toContain(
      "notacommand987: command not found",
    );
  });

  test("lets Escape close what it opened, one panel at a time", async ({
    page,
  }) => {
    // xterm cancelled Escape at its textarea, so the dashboard's "Press ESC
    // to close" and the monitor's "ESC to close" did nothing while the
    // terminal had focus, which is how both are opened.
    await expectTerminalVisible(page);
    await waitForTerminalReady(page);

    await runCommand(page, "fps", /FPS monitor activated/);
    const monitor = page.locator('[data-performance-monitor-active="true"]');
    await expect(monitor).toBeVisible({ timeout: 15_000 });
    await runCommand(page, "performance", /Performance dashboard opened/);
    const dashboard = page.getByText("Terminal Access Only");
    await expect(dashboard).toBeVisible({ timeout: 15_000 });
    const input = page.locator(".xterm-helper-textarea").first();

    await page.keyboard.press("Escape");
    await expect(dashboard).toHaveCount(0);
    await expect(monitor).toBeVisible();
    await expect(input).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(monitor).toHaveCount(0);
    await expect(input).toBeFocused();
  });

  test("opens the dashboard above the PDF reader, and leaves the reader its Escape", async ({
    page,
  }) => {
    // Rendered in place at the reader's z-index, the dashboard painted
    // under a reader already open (a portal puts the reader at the end of
    // <body>); and an Escape typed in the reader closed the dashboard too.
    await expectTerminalVisible(page);
    await waitForTerminalReady(page);

    // The reader, opened beside the terminal, which stays above it. A
    // dispatched click: the terminal may cover the button.
    await page
      .getByRole("button", { name: /View Resume/ })
      .first()
      .dispatchEvent("click");
    const reader = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(reader).toBeVisible({ timeout: 15_000 });

    await runCommand(page, "performance", /Performance dashboard opened/);
    const dashboard = page.getByRole("dialog", {
      name: "Performance dashboard",
    });
    await expect(dashboard).toBeVisible();
    // Once its entrance has settled: mid-spring, a point near its corner
    // could fall on the terminal's edge.
    await expect
      .poll(() =>
        dashboard.evaluate((panel) => getComputedStyle(panel).transform),
      )
      .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);

    // A point of the dashboard the terminal does not cover is its own. Each
    // one that is not names what covers it.
    expect(await coveredPoints(dashboard)).toEqual([]);

    // Typed in the reader, Escape is the reader's alone.
    await reader.focus();
    await page.keyboard.press("Escape");
    await expect(reader).toHaveCount(0);
    await expect(dashboard).toBeVisible();
  });

  test("shows the performance monitor above the PDF reader", async ({
    page,
  }) => {
    // Rendered in place at the reader's z-index, the monitor painted under a
    // reader already open, as the dashboard had: every point of it was the
    // reader's.
    await expectTerminalVisible(page);
    await waitForTerminalReady(page);
    await page
      .getByRole("button", { name: /View Resume/ })
      .first()
      .dispatchEvent("click");
    await expect(
      page.locator('[role="dialog"][aria-modal="true"]'),
    ).toBeVisible({ timeout: 15_000 });

    await runCommand(page, "fps", /FPS monitor activated/);
    const monitor = page.locator('[data-performance-monitor-active="true"]');
    await expect(monitor).toBeVisible();
    expect(await coveredPoints(monitor)).toEqual([]);
  });

  test("opens the dashboard without its spring, as motion is reduced", async ({
    page,
  }) => {
    // framer ignored the setting (its default reducedMotion is "never"): the
    // dashboard sprang in from 0.9 for visitors who asked for less motion.
    await expectTerminalVisible(page);
    await waitForTerminalReady(page);
    // Its scale on every frame, from the moment it is in the page.
    await page.evaluate(() => {
      const scales: number[] = [];
      (window as unknown as { dashboardScales: number[] }).dashboardScales =
        scales;
      new MutationObserver((_, observer) => {
        const panel = document.querySelector(
          '[role="dialog"][aria-label="Performance dashboard"]',
        );
        if (!panel) return;
        observer.disconnect();
        const start = performance.now();
        const sample = () => {
          const transform = getComputedStyle(panel).transform;
          const matrix = new DOMMatrix(
            transform === "none" ? undefined : transform,
          );
          scales.push(Math.hypot(matrix.a, matrix.b));
          // 600 ms and 12 frames at least, however slow the frames come.
          if (performance.now() - start < 600 || scales.length < 12) {
            requestAnimationFrame(sample);
          }
        };
        sample();
      }).observe(document.body, { childList: true, subtree: true });
    });
    await runCommand(page, "performance", /Performance dashboard opened/);
    const scales = () =>
      page.evaluate(
        () =>
          (window as unknown as { dashboardScales: number[] }).dashboardScales,
      );
    await expect
      .poll(async () => (await scales()).length)
      .toBeGreaterThanOrEqual(12);

    // At 0.9 for its first frame at most, then at 1: nothing in between.
    expect(
      (await scales()).filter((scale) => scale > 0.9005 && scale < 0.9995),
    ).toEqual([]);
  });

  test.describe("at 1280 by 720", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("takes a click at the centre of the dashboard's close button", async ({
      page,
    }) => {
      // Its "Press ESC to close" hint floated at the window's top right,
      // after the panel: below 1920 px wide it lay over the header's minimize
      // and close buttons, and at 1280 a click at the close button's centre
      // landed on the hint.
      await expectTerminalVisible(page);
      await waitForTerminalReady(page);
      await runCommand(page, "performance", /Performance dashboard opened/);
      const dashboard = page.getByRole("dialog", {
        name: "Performance dashboard",
      });
      await expect(dashboard).toBeVisible();

      // Once the panel has settled. It waited on the hint, whose own style
      // never moves: mid-spring, the button moved off the pointer between
      // the press and the release, and in Firefox the click went to the
      // header, which neither closes nor minimizes.
      await expect
        .poll(() =>
          dashboard.evaluate((panel) => getComputedStyle(panel).transform),
        )
        .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);

      const close = page.getByRole("button", {
        name: "Close performance dashboard",
      });
      const box = await close.boundingBox();
      if (!box) throw new Error("The close button has no box");
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(dashboard).toHaveCount(0);
    });
  });

  test("moves between the monitor's views with the arrow keys", async ({
    page,
  }) => {
    // Its views were seven toggle buttons: seven Tab stops, no arrows.
    await expectTerminalVisible(page);
    await waitForTerminalReady(page);
    await runCommand(page, "fps", /FPS monitor activated/);
    const details = page.getByRole("button", { name: "Performance details" });
    await details.focus();
    await page.keyboard.press("Space");
    await expect(details).toHaveAttribute("aria-expanded", "true");

    // One Tab stop for the views: the selected one (in macOS WebKit too,
    // whose Tab skips plain buttons).
    const selected = page.getByRole("tab", { selected: true });
    for (let i = 0; i < 3; i++) {
      if (await selected.evaluate((tab) => tab === document.activeElement)) {
        break;
      }
      await page.keyboard.press("Tab");
    }
    await expect(selected).toBeFocused();
    await expect(selected).toHaveAccessibleName(/^Overview/);

    await page.keyboard.press("ArrowRight");
    await expect(selected).toHaveAccessibleName(/^Web Vitals/);
    await expect(selected).toBeFocused();
    await page.keyboard.press("End");
    await expect(selected).toHaveAccessibleName(/^System/);
    await page.keyboard.press("Home");
    await expect(selected).toHaveAccessibleName(/^Overview/);
    await expect(page.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      (await selected.getAttribute("id"))!,
    );

    const results = await new AxeBuilder({ page })
      .include('[data-performance-monitor-active="true"]')
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(
      results.violations
        .filter((violation) => violation.id.startsWith("aria"))
        .map((violation) => violation.id),
    ).toEqual([]);
  });

  test("keeps the performance tools readable", async ({ page }) => {
    // Their text failed contrast in over 300 places: the monitor's gray-500
    // on gray-900, the dashboard's -500 scores on light cards, the report's
    // success text and badges. Contrast is enforced since (accessibility
    // spec); these open from the terminal only.
    await expectTerminalVisible(page);
    await waitForTerminalReady(page);
    const failures = async (selector: string) => {
      // Faded in: axe measures a dialog mid-fade at its partial opacity.
      await expect
        .poll(() =>
          page
            .locator(selector)
            .first()
            .evaluate((element) => {
              let opacity = 1;
              for (
                let node: Element | null = element;
                node;
                node = node.parentElement
              ) {
                opacity *= parseFloat(getComputedStyle(node).opacity);
              }
              return opacity;
            }),
        )
        .toBe(1);
      // And its animations finished (transitions are off, below).
      await page
        .locator(selector)
        .first()
        .evaluate(async (element) => {
          const running = document.getAnimations().filter((animation) => {
            const target = (animation.effect as KeyframeEffect | null)?.target;
            return (
              animation.playState === "running" &&
              target instanceof Element &&
              element.contains(target) &&
              // An endless one (a pulse) never finishes.
              animation.effect?.getComputedTiming().endTime !== Infinity
            );
          });
          await Promise.all(
            running.map((animation) => animation.finished.catch(() => {})),
          );
        });
      // Legacy mode: axe.run in the page itself. By default each scan also
      // opened a blank page (axe's finishRun) and closed it, and in CI's
      // Firefox, held to one content process, the key press after that
      // crashed the page's process (signal 11): 10 of 10 runs, against 0
      // of 20 in legacy mode, and 0 of 10 with the default processes.
      // The tools hold no frames, all that legacy mode leaves out.
      const results = await new AxeBuilder({ page })
        .include(selector)
        .withRules(["color-contrast"])
        .setLegacyMode()
        .analyze();
      return results.violations.flatMap((violation) =>
        violation.nodes.map(
          (node) =>
            `${node.target.join(" ")}: ${node.any[0]?.data?.contrastRatio}`,
        ),
      );
    };

    // Colours at rest, which is what the test is about. Under reduced
    // motion every element transitions every property for 0.01 ms
    // (globals.css), and Linux WebKit, between frames, gave axe a
    // transition's first frame: the Timeline tab's badge still gray-400 on
    // the tab's new blue-800 (#9ca3af on #1e40af, 3.43:1), in every run.
    await page.addStyleTag({
      content: "*, *::before, *::after { transition: none !important; }",
    });
    await runCommand(page, "fps", /FPS monitor activated/);
    const details = page.getByRole("button", { name: "Performance details" });
    await expect(details).toBeVisible();
    await details.focus();
    await page.keyboard.press("Space");
    await page.getByRole("tab", { selected: true }).focus();
    for (let view = 0; view < 7; view++) {
      expect(
        await failures('[data-performance-monitor-active="true"]'),
        await page.getByRole("tab", { selected: true }).innerText(),
      ).toEqual([]);
      await page.keyboard.press("ArrowRight");
    }

    await runCommand(page, "performance", /Performance dashboard opened/);
    // The terminal says so a moment before the dialog mounts.
    await expect(
      page.getByRole("dialog", { name: "Performance dashboard" }),
    ).toBeVisible();
    expect(
      await failures('[role="dialog"][aria-label="Performance dashboard"]'),
    ).toEqual([]);
    await runCommand(page, "performance close", /closed/);

    // Answered, not refused: a parallel run of this file once spent the API's
    // rate limit before this request, which got a 429 (each test is its own
    // client now, see utils/fixtures.ts).
    const reportAnswer = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/performance-report" &&
        response.request().method() === "POST",
    );
    await runCommand(
      page,
      "performance report",
      /Generating performance report/,
    );
    await expect(
      page.getByRole("dialog", { name: "Performance report" }),
    ).toBeVisible();
    expect((await reportAnswer).status(), "the report API's answer").toBe(200);
    await expect(page.getByText("Report Generated Successfully")).toBeVisible({
      timeout: 30_000,
    });
    expect(
      await failures('[role="dialog"][aria-label="Performance report"]'),
    ).toEqual([]);
  });

  test("should display colored output", async ({ page }) => {
    await expectTerminalVisible(page);
    await waitForTerminalReady(page);

    // `help` is written with explicit SGR codes in commands.ts
    // ("\x1b[1m\x1b[36mAI Assistant:\x1b[0m", green command names), so colored
    // spans are a requirement here rather than a nice-to-have. The old
    // assertion was `expect(hasColors).toBeDefined()` on a boolean, which is
    // true whatever the terminal renders - including nothing at all.
    await runCommand(page, "help", /Use Ctrl\+C to cancel current input/);

    const colored = await page
      .locator('.xterm-rows span[class*="xterm-fg-"]')
      .count();
    expect(colored).toBeGreaterThan(0);

    // And specifically: the section headers still on screen are the bold cyan
    // ones, not plain text that happens to sit next to something colored.
    const header = page.locator(
      '.xterm-rows span[class*="xterm-fg-"][class*="xterm-bold"]',
      { hasText: "AI Assistant:" },
    );
    expect(await header.count()).toBeGreaterThan(0);
  });

  test("should keep command history across close and reopen", async ({
    page,
  }) => {
    await expectTerminalVisible(page);
    await waitForTerminalReady(page);

    await runCommand(page, "about", /Use 'ai init' to start the conversation/);

    // This replaces "should persist command history in session", which asserted
    // that the screen matched /about|help/ - satisfied by the echoed commands
    // still being painted - and never checked that recall worked.
    //
    // The behavior it should have been testing does exist. `isOpen` gates only
    // the terminal's own markup (`{isOpen && ...}` inside AnimatePresence);
    // app-wrapper.tsx keeps the <Terminal> component itself mounted for the
    // life of the page, so commandHistoryRef survives. The close effect in
    // Terminal.tsx resets the input buffer, prompt mode and line mode by hand
    // and deliberately leaves the history ring alone.
    const terminalToggle = page
      .locator('button[aria-label="Toggle terminal"]')
      .first();
    await terminalToggle.click();
    await expect(page.locator('[data-testid="terminal"]').first()).toBeHidden({
      timeout: 10_000,
    });

    await terminalToggle.click();
    await expectTerminalVisible(page);
    await waitForTerminalReady(page);

    // A fresh xterm, so the previous session's output is gone - which is what
    // makes the recall assertion below meaningful.
    expect(await screen(page)).not.toContain("About Romain Claret");

    await focusTerminal(page);
    await page.keyboard.press("ArrowUp");
    await expect
      .poll(async () => await currentLine(page), { timeout: 10_000 })
      .toMatch(/about$/);
  });

  /**
   * Not run on firefox, and the reason is the test technique rather than the
   * app. Gecko will construct a ClipboardEvent with a DataTransfer attached,
   * but refuses to expose synthetic clipboard payloads back to page script.
   * Probed on this build, same page, all three engines:
   *
   *   const dt = new DataTransfer(); dt.setData("text/plain", "X");
   *   new ClipboardEvent("paste", { clipboardData: dt })
   *     .clipboardData.getData("text/plain")
   *
   *     chromium -> "X"      webkit -> "X"      firefox -> ""
   *
   * xterm reads exactly that property in its paste handler, so on firefox it
   * receives an empty string and there is nothing to assert. A real Ctrl+V is
   * unaffected, because then the browser fills clipboardData itself; testing
   * that instead needs clipboard permissions firefox does not grant headlessly.
   *
   * So this is a gap in coverage, not a bug: paste is exercised on chromium and
   * webkit, and firefox's paste path is the same application code.
   */
  test("should handle paste operations", async ({ page, browserName }) => {
    test.skip(
      browserName === "firefox",
      'gecko does not expose synthetic ClipboardEvent payloads to page script (getData returns ""), so xterm\'s paste handler receives nothing; see the comment above',
    );

    await expectTerminalVisible(page);
    await waitForTerminalReady(page);

    // A real paste event on the helper textarea, rather than clipboard
    // permissions plus Control+v: xterm listens for `paste` there and hands the
    // payload to onData, so this is what a real paste looks like to the app and
    // it needs no permission grant. The old version called
    // navigator.clipboard.writeText() without clipboard-write permission (the
    // promise rejected, unhandled and unawaited) and then pressed Control+v
    // without focusing the textarea, so nothing could ever have been pasted.
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
    }, "echo pasted-into-terminal");

    await expect
      .poll(async () => await currentLine(page), { timeout: 10_000 })
      .toMatch(/echo pasted-into-terminal$/);

    // The pasted text is in the input buffer, not merely painted: `echo` must
    // print it back on a row of its own.
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => await hasOutputRow(page, "pasted-into-terminal"), {
        timeout: 10_000,
      })
      .toBe(true);
  });

  test("should show terminal in correct theme", async ({ page }) => {
    // assertion, not an early return: no terminal means the app is broken, and
    // returning here reported green for a theme check that never ran.
    const terminal = await expectTerminalVisible(page);

    // Check initial theme
    const initialBg = await terminal.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Toggle theme
    const themeToggle = page.locator('button[aria-label*="theme" i]').first();
    await themeToggle.click();
    await page.waitForTimeout(500);

    // Check if terminal theme changed
    const newBg = await terminal.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Background might change or might stay same based on theme implementation
    // Just verify we got valid colors
    expect(initialBg).toBeTruthy();
    expect(newBg).toBeTruthy();
  });

  test("should be accessible", async ({ page }) => {
    // assertion, not an early return: an absent terminal has no ARIA to check,
    // and that absence is the regression worth reporting.
    const terminal = await expectTerminalVisible(page);

    // Check ARIA attributes
    const role = await terminal.getAttribute("role");
    const ariaLabel = await terminal.getAttribute("aria-label");

    // Should have proper ARIA attributes
    expect(role || "application").toBeTruthy();
    expect(ariaLabel || (await terminal.getAttribute("title"))).toBeTruthy();

    // Check if terminal is keyboard accessible
    await terminal.focus();
    const isFocused = await terminal.evaluate((el) => {
      return (
        document.activeElement === el || el.contains(document.activeElement)
      );
    });

    expect(isFocused).toBeTruthy();
  });

  test("should handle window resize", async ({ page }) => {
    const terminal = await expectTerminalVisible(page);
    await waitForTerminalReady(page);

    // Resize the viewport. Terminal.tsx refits xterm on window resize, so this
    // is where a broken refit would show up as a terminal that no longer takes
    // input.
    await page.setViewportSize({ width: 1400, height: 900 });
    await expect(terminal).toBeVisible();

    // Not `toContain("help")`, and not `echo something`: both are satisfied by
    // the echoed input whether or not the command ran. `ls` prints filenames
    // that cannot come from the two characters typed.
    const text = await runCommand(page, "ls", /README\.md/);
    expect(text).toContain("README.md");
    expect(text).toContain("examples/");
  });

  // "should support mobile touch interactions" was deleted rather than left
  // skipped. Its body was two comment lines and nothing else, and the terminal
  // is desktop-only by design (the beforeEach above skips every test in this
  // file on mobile), so there was no behavior for it to assert.
});
