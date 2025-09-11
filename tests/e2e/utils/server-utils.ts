import { Page } from "@playwright/test";

/**
 * Wait for the server to be ready and healthy
 * @param page - Playwright page object
 * @param maxRetries - Maximum number of connection attempts
 * @param retryDelay - Delay between retries in milliseconds
 */
export async function waitForServerReady(
  page: Page,
  maxRetries: number = 10,
  retryDelay: number = 3000,
): Promise<boolean> {
  console.log("Waiting for server to be ready...");

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Try to load the page with a reasonable timeout
      await page.goto("/", {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });

      // Check if the main content is loaded
      await page.waitForSelector("h1", { timeout: 5000 });

      console.log(`Server is ready (attempt ${attempt}/${maxRetries})`);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("ERR_CONNECTION_REFUSED")) {
        console.log(
          `Server not ready yet (attempt ${attempt}/${maxRetries}), waiting...`,
        );
        if (attempt < maxRetries) {
          await page.waitForTimeout(retryDelay);
        }
      } else {
        // Different error, log but continue trying
        console.warn(`Unexpected error during server check: ${errorMessage}`);
        if (attempt < maxRetries) {
          await page.waitForTimeout(retryDelay / 2);
        }
      }
    }
  }

  console.error("Server failed to become ready after maximum retries");
  return false;
}

/**
 * Ensure test environment is properly initialized
 * @param page - Playwright page object
 */
export async function initializeTestEnvironment(page: Page): Promise<void> {
  // Wait for server to be ready
  const serverReady = await waitForServerReady(page);

  if (!serverReady) {
    throw new Error(
      "Server is not responding. Please ensure the server is running.",
    );
  }

  // Add any additional initialization steps here
  // For example, clearing local storage, setting cookies, etc.
  await page.evaluate(() => {
    // Clear any existing local storage
    localStorage.clear();
    // Clear session storage
    sessionStorage.clear();
  });
}
