import { expect, type Page } from "@playwright/test";

/**
 * Shared plumbing for driving the xterm-based site terminal.
 *
 * Two defects made every keyboard-driven terminal test unreliable enough to be
 * disabled wholesale, and both are fixed here rather than per file:
 *
 *   1. Keystrokes went nowhere. xterm reads from a hidden textarea, so calling
 *      .focus() on the terminal container leaves `keyboard.type` writing into
 *      whatever else on the page holds focus, silently.
 *   2. The output selector returned CSS. The DOM renderer injects a <style>
 *      block inside `.xterm-screen`, so its textContent is kilobytes of
 *      stylesheet with the terminal output buried in it, and assertions matched
 *      the stylesheet. (`.terminal-content`, the other half of the selector
 *      those tests used, exists nowhere in src/.)
 */

/**
 * Everything currently rendered in the xterm viewport, one row per line.
 *
 * Reads the row elements, never `.xterm-screen` - see (2) above.
 */
export async function screen(page: Page): Promise<string> {
  const rows = await page.locator(".xterm-rows > div").allTextContents();
  return rows.join("\n");
}

/**
 * Everything in the buffer, scrollback included.
 *
 * `screen()` only sees the viewport, and several commands print more than a
 * viewport: `help` is 37 lines against a terminal about 34 rows tall, so its
 * first section header has already scrolled out of view by the time the
 * command finishes. Reading the tail only is how an assertion on
 * "System Commands:" fails against a perfectly working terminal.
 *
 * This drives xterm's own scrollback binding rather than touching the DOM.
 * Three previous versions set `.xterm-viewport` scrollTop and waited, in
 * increasingly elaborate ways, for the rows to repaint. They could not work:
 * measured on a fresh page with 43 rows of buffer against a 34-row viewport,
 * the element reports scrollHeight 688, clientHeight 544 and **scrollTop 0**.
 * The element's scroll position and xterm's buffer position are decoupled, so
 * `scrollTop = 0` was assigning the value it already held, firing no event and
 * repainting nothing. Waiting longer, waiting for a change, and nudging away
 * and back all waited on something that was never going to happen.
 *
 * Mouse wheel over the terminal does not move it either (measured: zero
 * distinct screens over twelve wheel events, on both chromium and webkit).
 * Shift+PageUp does, because xterm handles it internally and calls scrollLines,
 * which updates the buffer and schedules the render directly.
 *
 * Rows overlap between frames; harmless for the substring assertions this
 * exists to serve.
 */
export async function fullScreen(page: Page): Promise<string> {
  // xterm reads keys from its hidden textarea, so scrollback keys go nowhere
  // without this.
  await focusTerminal(page);

  const chunks: string[] = [await screen(page)];

  // Bounded: `scrollback` is 1000 lines, but no caller needs more than a few
  // screens, and stopping when two consecutive presses show nothing new means
  // reaching the top ends the walk on its own.
  let unchanged = 0;
  for (let press = 0; press < 12 && unchanged < 2; press++) {
    const before = await screen(page);
    await page.keyboard.press("Shift+PageUp");
    // xterm repaints on its next animation frame, which a slow renderer gives
    // late: read after a fixed 120 ms, Linux WebKit showed the old screen
    // twice and the walk stopped at the bottom (3 of 30 runs). So wait for
    // the change, and count a press as showing nothing only after 1.5 s.
    let current = before;
    const deadline = Date.now() + 1500;
    while (current === before && Date.now() < deadline) {
      await page.waitForTimeout(50);
      current = await screen(page);
    }
    if (chunks.includes(current)) unchanged++;
    else {
      unchanged = 0;
      chunks.push(current);
    }
  }

  // Leave the terminal where every caller expects it: at the bottom, ready for
  // input. A test that runs a command after this one would otherwise type into
  // a scrolled-back view.
  for (let press = 0; press < 14; press++) {
    await page.keyboard.press("Shift+PageDown");
  }
  await page.waitForTimeout(120);

  return chunks.join("\n");
}

/**
 * True when some row on screen is exactly `text` once trimmed.
 *
 * The distinction matters constantly: after running `echo hello`, the string
 * "hello" is on screen twice - once inside the echoed command line and once as
 * the output. Only the second is evidence that the command ran, so assertions
 * about output must be anchored to a whole row.
 */
export async function hasOutputRow(page: Page, text: string): Promise<boolean> {
  const all = await screen(page);
  return all.split("\n").some((row) => row.trim() === text);
}

/**
 * The bottom-most row with any content, which is the prompt line while the
 * terminal is idle.
 *
 * Needed because the whole screen also holds every earlier echo: asserting
 * "the screen contains ls" after recalling `ls` from history passes even when
 * history is broken, since the original `ls` is still on screen.
 */
export async function currentLine(page: Page): Promise<string> {
  const rows = (await screen(page)).split("\n").map((row) => row.trimEnd());
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].trim()) return rows[i];
  }
  return "";
}

/**
 * xterm reads from a hidden textarea. Focusing it explicitly is the difference
 * between keystrokes reaching the terminal and disappearing - see (1) above.
 */
export async function focusTerminal(page: Page): Promise<void> {
  await page.locator(".xterm-helper-textarea").first().focus();
}

/**
 * Wait until xterm has mounted and painted its welcome banner.
 *
 * The `[data-testid="terminal"]` element appearing is not the same as the
 * terminal being ready to take input: xterm is imported dynamically and the
 * banner is written after initialization. Anything typed before that lands
 * nowhere.
 */
export async function waitForTerminalReady(
  page: Page,
  timeout = 30_000,
): Promise<void> {
  await expect
    .poll(
      async () => ((await screen(page)).trim().length > 0 ? "ready" : "..."),
      {
        timeout,
        intervals: [250, 500, 1000],
      },
    )
    .toBe("ready");
  await focusTerminal(page);
}

/**
 * Type a line, confirm the keystrokes landed, submit it, and wait for
 * `expected` to show up below the command's own line. Returns that text.
 *
 * The echo check is against the prompt line rather than the whole screen: a
 * focus failure otherwise surfaces much later as "the command produced no
 * output", which is a slow and misleading way to learn that nothing was typed.
 *
 * `expected` is matched only below the echoed prompt line. Matched against
 * the whole screen, a pattern the command line itself satisfies (`echo x`
 * waiting for /x/) passed the moment Enter was pressed, output or not.
 */
export async function runCommand(
  page: Page,
  command: string,
  expected: RegExp,
  timeout = 15_000,
): Promise<string> {
  await focusTerminal(page);
  await page.keyboard.type(command);

  await expect
    .poll(
      async () =>
        (await currentLine(page)).endsWith(command) ? "echoed" : "...",
      { timeout: 15_000, intervals: [100, 250, 500] },
    )
    .toBe("echoed");
  // The whole prompt line, not just the command: the output can repeat the
  // command ("invalidcommand123: command not found").
  const echoed = (await currentLine(page)).trim();

  await page.keyboard.press("Enter");
  let output = "";
  await expect
    .poll(
      async () => {
        output = below(await screen(page), echoed);
        return expected.test(output) ? "found" : "...";
      },
      { timeout, intervals: [250, 500, 1000] },
    )
    .toBe("found");

  return output;
}

/**
 * The text after the last occurrence of `line`, or all of it once a long
 * output has scrolled `line` out of the viewport.
 */
function below(text: string, line: string): string {
  const at = text.lastIndexOf(line);
  return at === -1 ? text : text.slice(at + line.length);
}
