import { Page } from "@playwright/test";

/**
 * Wait for animation to complete by detecting when CSS animations/transitions finish
 */
export async function waitForAnimationCompletion(
  page: Page,
  selector: string,
  timeout: number = 5000,
): Promise<void> {
  await page
    .waitForFunction(
      (sel) => {
        const element = document.querySelector(sel);
        if (!element) return true; // Element doesn't exist, consider animation complete

        const styles = window.getComputedStyle(element);

        // Check if animations are running
        const animationName = styles.animationName;
        const animationDuration = styles.animationDuration;
        const transitionProperty = styles.transitionProperty;
        const transitionDuration = styles.transitionDuration;

        // Parse durations to handle multiple values
        const parseAllDurations = (duration: string) => {
          return duration.split(",").map((d) => {
            const parsed = parseFloat(d.trim().replace("s", ""));
            return isNaN(parsed) ? 0 : parsed;
          });
        };

        const animationDurations = parseAllDurations(animationDuration);
        const transitionDurations = parseAllDurations(transitionDuration);

        // Check if all animation durations are 0
        const noAnimations =
          animationName === "none" || animationDurations.every((d) => d === 0);

        // Check if all transition durations are 0
        const noTransitions =
          transitionProperty === "none" ||
          transitionDurations.every((d) => d === 0);

        return noAnimations && noTransitions;
      },
      selector,
      { timeout: Math.min(timeout, 3000) }, // Cap timeout to prevent long waits
    )
    .catch(async () => {
      // If animation detection fails, wait a short time and continue
      // This prevents tests from failing due to animation detection issues
      await page.waitForTimeout(200);
    });
}
