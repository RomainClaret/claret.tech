import { expect, type Locator, type Page } from "@playwright/test";

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
 * viewport: `help` is 37 lines against a terminal that opens about 25 rows
 * tall, so its first two section headers have already scrolled out of view by
 * the time the command finishes. Reading the tail only is how an assertion on
 * "System Commands:" fails against a perfectly working terminal.
 *
 * xterm's Viewport listens for `scroll` on `.xterm-viewport` and re-renders
 * the rows, so walking scrollTop down the element and collecting each frame
 * recovers the whole buffer. Rows overlap between frames; harmless for the
 * substring assertions this exists to serve.
 */
export async function fullScreen(page: Page): Promise<string> {
  const viewport = page.locator(".xterm-viewport").first();
  const { scrollHeight, clientHeight } = await viewport.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));

  const chunks: string[] = [];
  const step = Math.max(1, clientHeight);
  for (let top = 0; top < scrollHeight; top += step) {
    chunks.push(await captureAt(page, viewport, top));
  }

  // Leave the terminal where it was: scrolled to the bottom, ready for input.
  chunks.push(await captureAt(page, viewport, scrollHeight));

  return chunks.join("\n");
}

/**
 * Scroll the viewport to `top` and return the rows once xterm has actually
 * repainted them.
 *
 * This used to be `scrollTop = top` followed by `waitForTimeout(80)`. xterm
 * re-renders from its own `scroll` listener, so 80ms is a guess about how
 * quickly the machine gets round to it, and on a CI runner it does not. The
 * read then returned the frame from before the scroll, every chunk came back
 * identical, and the whole walk reported nothing but the bottom of the buffer -
 * which is how an assertion on "System Commands:" failed against a terminal
 * that had printed it correctly. Reproduced locally by setting that timeout to
 * 0: same failure, same output starting nine lines too low.
 *
 * Waiting for the rows to change is the real signal. If they never do, this
 * fails loudly rather than handing back a stale frame and letting the
 * assertion misreport what the terminal contains.
 */
async function captureAt(
  page: Page,
  viewport: Locator,
  top: number,
): Promise<string> {
  const before = await screen(page);

  // Scrolling to where we already are repaints nothing, so there would be no
  // change to wait for. The final bottom capture usually lands here.
  const moved = await viewport.evaluate((el, value) => {
    const from = el.scrollTop;
    el.scrollTop = value;
    return el.scrollTop !== from;
  }, top);
  if (!moved) return before;

  // xterm swallows exactly one scroll event whenever it has just moved the
  // viewport itself, which it does immediately after writing output:
  //
  //   if (this._ignoreNextScrollEvent) { this._ignoreNextScrollEvent = false; return; }
  //
  // (@xterm/xterm 5.5.0, Viewport._onScroll). So the first scroll of a walk
  // that follows a command can be dropped: scrollTop moves, _onScroll returns
  // early, the buffer is never synced and the rows never repaint. CI showed
  // exactly that - scrollTop 0 as requested, rows still showing the bottom.
  //
  // The suppression is one-shot, so a second scroll gets through. It has to be
  // a real movement to fire a fresh event, hence stepping away and back rather
  // than setting the same value twice.
  for (let attempt = 0; attempt < 3; attempt++) {
    if ((await screen(page)) !== before) return screen(page);
    if (attempt > 0) {
      await viewport.evaluate((el, value) => {
        el.scrollTop = value === 0 ? el.scrollHeight : 0;
        el.scrollTop = value;
      }, top);
    }
    await page.waitForTimeout(150);
  }

  try {
    await expect
      .poll(
        async () => ((await screen(page)) !== before ? "repainted" : "..."),
        {
          timeout: 5_000,
          intervals: [50, 100, 200],
        },
      )
      .toBe("repainted");
  } catch (error) {
    // Report and rethrow; pass and fail are unaffected. This wait times out on
    // a CI runner and on no developer machine tried so far, including the same
    // shard command, so the question is which half of the premise is wrong:
    // that the element scrolled, or that a scroll makes xterm repaint.
    const state = await page
      .evaluate(() => {
        const el = document.querySelector(".xterm-viewport");
        const rows = document.querySelectorAll(".xterm-rows > div");
        return {
          scrollTop: el ? (el as HTMLElement).scrollTop : null,
          scrollHeight: el ? el.scrollHeight : null,
          clientHeight: el ? el.clientHeight : null,
          rowCount: rows.length,
          firstRow: (rows[0]?.textContent ?? "").slice(0, 60),
          lastRow: (rows[rows.length - 1]?.textContent ?? "").slice(0, 60),
          // If xterm is on the canvas or webgl renderer the row divs are not
          // the source of truth and this whole approach is wrong, not slow.
          rendererCanvases: document.querySelectorAll(".xterm canvas").length,
        };
      })
      .catch((evaluateError) => ({ evaluateFailed: String(evaluateError) }));

    console.log(
      `SCROLLBACK_REPAINT_DIAGNOSTIC ${JSON.stringify({
        requestedTop: top,
        ...state,
        beforeFirstLine: before.split("\n")[0]?.slice(0, 60),
        beforeLength: before.length,
      })}`,
    );
    throw error;
  }

  return screen(page);
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
 * `expected` to show up on screen.
 *
 * The echo check is against the prompt line rather than the whole screen: a
 * focus failure otherwise surfaces much later as "the command produced no
 * output", which is a slow and misleading way to learn that nothing was typed.
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

  await page.keyboard.press("Enter");
  await expect
    .poll(async () => (expected.test(await screen(page)) ? "found" : "..."), {
      timeout,
      intervals: [250, 500, 1000],
    })
    .toBe("found");

  return screen(page);
}
