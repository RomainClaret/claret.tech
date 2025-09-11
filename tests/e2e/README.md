# End-to-End Tests with Playwright

This directory contains end-to-end tests for the claret.tech portfolio website using Playwright.

## Prerequisites

Before running the tests, ensure Playwright browsers are installed:

```bash
npx playwright install
```

For accessibility tests, install axe-playwright:

```bash
npm install --save-dev axe-playwright
```

## Running Tests

### Run all tests

```bash
npm run test:e2e
```

### Run tests in UI mode (recommended for development)

```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)

```bash
npm run test:e2e:headed
```

### Debug tests

```bash
npm run test:e2e:debug
```

### Run specific test file

```bash
npx playwright test tests/e2e/navigation.spec.ts
```

### Run tests in specific browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Structure

- `navigation.spec.ts` - Tests for basic navigation and UI interactions
- `terminal.spec.ts` - Tests for terminal functionality and commands
- `accessibility.spec.ts` - Accessibility tests using axe-core
- `performance.spec.ts` - Performance tests for Core Web Vitals

## Writing Tests

### Basic Test Example

```typescript
import { test, expect } from "@playwright/test";

test("should display hero section", async ({ page }) => {
  await page.goto("/");

  const hero = page.locator(".hero-section");
  await expect(hero).toBeVisible();
});
```

### Terminal Test Example

```typescript
test("should execute terminal command", async ({ page }) => {
  await page.goto("/");

  // Open terminal
  await page.click('[data-testid="terminal-button"]');

  // Type command
  await page.keyboard.type("ls");
  await page.keyboard.press("Enter");

  // Check output
  await expect(page.locator(".xterm-screen")).toContainText("projects");
});
```

## Best Practices

1. **Use data-testid attributes** for reliable element selection
2. **Wait for elements** to be visible before interacting
3. **Use Page Object Model** for complex pages
4. **Keep tests independent** - each test should work in isolation
5. **Use meaningful test descriptions**
6. **Test both happy and error paths**

## Debugging

### View test report

After running tests, view the HTML report:

```bash
npx playwright show-report
```

### Take screenshots on failure

Screenshots are automatically taken on test failure and saved to `test-results/`.

### Use trace viewer

```bash
npx playwright show-trace trace.zip
```

## CI/CD Integration

Tests are configured to run in CI with:

- Retry failed tests twice
- Run in parallel where possible
- Generate HTML reports
- Capture traces on failure

## Configuration

See `playwright.config.ts` for test configuration including:

- Browser settings
- Viewport sizes
- Base URL
- Timeout settings
- Reporter configuration
