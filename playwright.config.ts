import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only - reduced to prevent excessive reruns */
  retries: process.env.CI ? 1 : 0,
  /* Optimize workers for stability in CI */
  workers: process.env.CI ? 4 : 6, // 4 workers in CI for balance, 6 locally
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? [["html"], ["github"]] : "html",
  /* Global timeout for each test - increased for stability */
  timeout: process.env.CI ? 300 * 1000 : 60 * 1000, // 5 min in CI for stability, 1 min locally
  /* Global timeout for expect assertions */
  expect: {
    timeout: process.env.CI ? 15 * 1000 : 8 * 1000, // 15s in CI, 8s locally
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: `${process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000"}?playwright=true`,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Screenshot on failure */
    screenshot: "only-on-failure",

    /* Video on failure */
    video: "on-first-retry",

    /* Navigation timeout - significantly increased for Firefox stability */
    navigationTimeout: process.env.CI ? 60 * 1000 : 15 * 1000, // 60s in CI (Firefox needs much more time), 15s locally

    /* Action timeout - increased for CI stability, especially Firefox */
    actionTimeout: process.env.CI ? 35 * 1000 : 10 * 1000, // 35s in CI for Firefox, 10s locally

    /* Resource blocking for performance optimization in CI */
    ...(process.env.CI && {
      // Block non-essential resources for faster test execution
      extraHTTPHeaders: {
        "X-Test-Mode": "true",
      },
    }),

    /* Additional CI optimizations - browser launch options moved to browser-specific projects */
  },

  /* Configure projects for major browsers with optimized settings */
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Chromium-specific optimizations for CI
        ...(process.env.CI && {
          launchOptions: {
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
              "--disable-web-security",
              "--disable-features=TranslateUI",
              "--disable-blink-features=AutomationControlled",
            ],
          },
        }),
      },
    },

    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
        // Firefox needs significantly more time in CI due to performance issues
        ...(process.env.CI && {
          navigationTimeout: 120 * 1000, // 120s for Firefox (increased from 90s)
          actionTimeout: 60 * 1000, // 60s for Firefox actions (increased from 45s)
          launchOptions: {
            firefoxUserPrefs: {
              "dom.webdriver.enabled": false,
              useAutomationExtension: false,
              // Performance optimizations for Firefox in CI
              "dom.max_script_run_time": 60,
              "dom.max_chrome_script_run_time": 60,
              "browser.cache.disk.enable": false,
              "browser.cache.memory.enable": false,
              // Additional Firefox stability settings
              "dom.ipc.processCount": 1,
              "browser.tabs.remote.autostart": false,
            },
          },
        }),
      },
    },

    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        // Safari-specific optimizations
        ...(process.env.CI && {
          navigationTimeout: 60 * 1000, // 60s for Safari (increased for stability)
          actionTimeout: 30 * 1000, // 30s for Safari actions (increased)
          // WebKit doesn't support the same launch args as Chromium
        }),
      },
    },

    /* Test against mobile viewports with optimizations */
    {
      name: "Mobile Chrome",
      use: {
        ...devices["Pixel 5"],
        ...(process.env.CI && {
          launchOptions: {
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
            ],
          },
        }),
      },
    },
    {
      name: "Mobile Safari",
      use: {
        ...devices["iPhone 12"],
        ...(process.env.CI && {
          navigationTimeout: 40 * 1000, // Mobile Safari needs more time
        }),
      },
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run dev server before starting the tests */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true, // ALWAYS reuse to avoid port conflicts in CI
    timeout: 120 * 1000, // 2 minutes to start
    stdout: "pipe",
    stderr: "pipe",
  },
});
