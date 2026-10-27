# End-to-End Tests with Playwright

End-to-end tests for claret.tech: the built site in Chromium, Firefox and
WebKit, on desktop and on phones (`playwright.config.ts`).

## Prerequisites

```bash
npx playwright install
```

## Running Tests

Without `PLAYWRIGHT_BASE_URL`, the config starts `npm run dev` on port 3000
(or reuses a server there). CI tests a production build instead, which is
also what to measure against locally:

```bash
SERVE_HTTP=true npm run build
SERVE_HTTP=true npx next start -p 3001 -H 127.0.0.1
PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test
```

`SERVE_HTTP=true` is needed on plain http, at build and at start: the
HTTPS-only headers otherwise blank the page in WebKit.

```bash
npm run test:e2e                 # every project
npm run test:e2e:quick           # Chromium only
npm run test:e2e:ui              # UI mode
npm run test:e2e:headed          # with a visible browser
npm run test:e2e:debug           # step through

npx playwright test tests/e2e/navigation.spec.ts --project=webkit
```

## The specs

| Spec                           | What it covers                                                              |
| ------------------------------ | --------------------------------------------------------------------------- |
| `navigation.spec.ts`           | The navigation bar, section links, the terminal toggle, the phone menu      |
| `accessibility.spec.ts`        | axe scans in both themes and high contrast, headings, labels, keyboard      |
| `keyboard-paths.spec.ts`       | What opened on a click or showed on hover, reached from the keyboard        |
| `project-details.spec.ts`      | A repository's details dialog, with the GitHub APIs answered by fixtures    |
| `card-details.spec.ts`         | The research, skills, paper and blog dialogs, their links, the skills' size |
| `static-shell.spec.ts`         | The prerendered page before and without the bundle; group-variant styles    |
| `performance.spec.ts`          | Core Web Vitals, bundle and image budgets, caching                          |
| `motion-fallback.spec.ts`      | Content behind entrance animations, when their chunk or the bundle fails    |
| `pdf-reader.spec.ts`           | The in-app PDF reader                                                       |
| `terminal.spec.ts`             | The terminal and its commands                                               |
| `python-terminal.spec.ts`      | Python in the terminal (Chromium only); its worker as old bundles start it  |
| `research-map.spec.ts`         | The research map (`research` in the terminal)                               |
| `mobile-navigation.spec.ts`    | Navigation on phones                                                        |
| `mobile-accessibility.spec.ts` | Phones: targets, labels, 320 px reflow                                      |
| `error-reports.spec.ts`        | An error that reaches a boundary: reported; the page says so once on record |
| `privacy.spec.ts`              | What the privacy policy promises: no cookies, no host but the site's own    |
| `lighthouse.spec.ts`           | Lighthouse scores                                                           |

CI's Playwright jobs name their specs (`.github/workflows/playwright.yml`). A
new spec runs in CI only once a job names it; `src/app/ci-workflows.test.ts`
fails until one does.

## Writing Tests

Import `test` from `./utils/fixtures`, not `@playwright/test`: the fixture
makes each test its own client for the API's rate limit. Then, for a test
that is not about them, start past the cookie notice and the splash:

```typescript
import { test, expect } from "./utils/fixtures";
import { acknowledgeCookieNotice } from "./utils/cookie-notice";
import { waitForSplashToEnd } from "./utils/splash";

test("opens a thesis with Enter", async ({ page }) => {
  await acknowledgeCookieNotice(page);
  await page.goto("/");
  await waitForSplashToEnd(page);

  const summary = page.locator("#education summary").first();
  await summary.focus();
  await page.keyboard.press("Enter");

  await expect(summary.locator("xpath=..")).toHaveAttribute("open", "");
});
```

The helpers in `utils/` cover the terminal (`terminal-utils.ts`), toasts,
chunk failures, pages without scripts and scrolling.

### Things that bite

- **Find by what does not change.** A locator by name re-resolves on every
  assertion: a "Click to expand" button that turns into "Click to collapse"
  is then the next card's. Hold the element by something stable
  (`aria-controls`, an id).
- **Tab on macOS WebKit** skips links and buttons, as Safari does by default:
  press Alt+Tab there (Linux WebKit, as in CI, takes Tab).
- **Firefox does not launch under the Claude Code sandbox** (it does in CI).
- **Playwright's Firefox drops colour scheme and contrast emulation** on a
  page sent with `Cross-Origin-Opener-Policy`, as every page here is
  (1.64; fixed for 1.65, microsoft/playwright#43287). Two static-shell
  tests skip Firefox until that bump.

## Debugging

```bash
npx playwright show-report               # the HTML report
npx playwright show-trace <trace.zip>    # a trace from test-results/
```

Screenshots of failures are saved to `test-results/`.

## CI

In CI the config retries a failed test once, runs 4 workers, and writes the
HTML and GitHub reporters (`playwright.config.ts`).
