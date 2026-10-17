import { Page } from "@playwright/test";

// Extend Window interface for toast observer
declare global {
  interface Window {
    __toastObserver?: MutationObserver;
  }
}

export interface ToastOptions {
  /**
   * Maximum time to wait for toast dismissal in milliseconds
   * @default 5000
   */
  timeout?: number;

  /**
   * Whether to dismiss toast by clicking close button
   * @default true
   */
  dismissByClick?: boolean;

  /**
   * Whether to wait for toast to disappear naturally
   * @default false
   */
  waitForNaturalDismissal?: boolean;
}

/**
 * Wait for and dismiss any toast notifications that might interfere with tests
 */
export async function dismissToasts(
  page: Page,
  options: ToastOptions = {},
): Promise<void> {
  const {
    timeout = 5000,
    dismissByClick = true,
    waitForNaturalDismissal = false,
  } = options;

  // CI environment requires more aggressive toast handling
  const isCI = !!process.env.CI;

  // Common toast selectors. Not the toast live region: it is visually
  // hidden, blocks nothing, and hiding it silenced the site's polite
  // announcements for the rest of the test.
  const toastSelectors = [
    '[role="alert"]',
    '[data-testid="toast"]',
    ".toast",
    ".notification",
    ".alert",
  ];

  const combinedSelector = toastSelectors.join(", ");

  // In CI, immediately force-hide all toasts to prevent blocking
  if (isCI) {
    // Multiple aggressive attempts to clear toasts
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await page.evaluate((selector) => {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => {
            const element = el as HTMLElement;
            element.style.display = "none";
            element.style.pointerEvents = "none";
            element.style.zIndex = "-9999";
            element.style.opacity = "0";
            element.style.visibility = "hidden";
            element.style.position = "fixed";
            element.style.left = "-9999px";
            element.style.top = "-9999px";
            // Deliberately NOT element.remove(): React owns these nodes.
            // Detaching one (the toast live region, then matched here) left
            // React holding a stale insertBefore reference, so the next host
            // insertion -- the terminal div, on click -- threw NotFoundError
            // and tore the whole app down, under CI only. The styles above
            // already make a toast non-blocking.
          });

          // Catch toasts that mount while this call is still running. The
          // observer used to be installed once and never disconnected, so it
          // outlived the call and kept firing on every React commit for the
          // rest of the page's life -- writing inline styles from inside a
          // childList/subtree callback on document.body, in the same file
          // whose element.remove() already cost a React teardown. It is now
          // scoped to this dismissToasts() call and disconnected below.
          if (!window.__toastObserver) {
            window.__toastObserver = new MutationObserver(() => {
              const newElements = document.querySelectorAll(selector);
              newElements.forEach((el) => {
                const element = el as HTMLElement;
                element.style.display = "none";
                element.style.pointerEvents = "none";
                element.style.zIndex = "-9999";
              });
            });
            window.__toastObserver.observe(document.body, {
              childList: true,
              subtree: true,
            });
          }
        }, combinedSelector);

        // Wait for DOM changes to settle
        await page.waitForTimeout(500);
      } catch {
        // Ignore errors during force-hide
      }
    }

    // Disconnect before returning, in a separate evaluate so it still runs if
    // one of the attempts above threw (e.g. a navigation mid-call).
    try {
      await page.evaluate(() => {
        window.__toastObserver?.disconnect();
        delete window.__toastObserver;
      });
    } catch {
      // Page navigated or closed; the observer went with it.
    }
  }

  try {
    // Check if any toasts are present with a short timeout to avoid waiting
    const toasts = page.locator(combinedSelector);

    // Quick check with shorter timeout to avoid long waits
    let toastCount = 0;
    try {
      // Use a very short timeout for counting - if toasts exist they should be immediate
      toastCount = await toasts.count();

      // Double-check with waitFor to ensure we're not catching stale elements
      if (toastCount > 0) {
        const firstToast = toasts.first();
        try {
          await firstToast.waitFor({ state: "attached", timeout: 1000 });
        } catch {
          // If waitFor fails, assume no real toasts exist
          toastCount = 0;
        }
      }
    } catch {
      // If counting fails, assume no toasts
      toastCount = 0;
    }

    if (toastCount === 0) {
      return; // No toasts to dismiss
    }

    if (waitForNaturalDismissal) {
      // Wait for toasts to disappear naturally
      await page.waitForFunction(
        (selector) => {
          const elements = document.querySelectorAll(selector);
          return (
            elements.length === 0 ||
            Array.from(elements).every(
              (el) =>
                (el as HTMLElement).style.display === "none" ||
                (el as HTMLElement).style.opacity === "0" ||
                !(el as HTMLElement).offsetParent,
            )
          );
        },
        combinedSelector,
        { timeout },
      );
    } else if (dismissByClick) {
      // First, force all toasts to be non-blocking immediately
      await page.evaluate((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const element = el as HTMLElement;
          element.style.pointerEvents = "none";
          element.style.zIndex = "-1";
        });
      }, combinedSelector);

      // Then try to dismiss toasts by clicking close buttons or the toast itself
      for (let i = 0; i < toastCount; i++) {
        const toast = toasts.nth(i);

        // Check if toast is still visible with timeout handling
        let isVisible = false;
        try {
          isVisible = await toast.isVisible({ timeout: 2000 });
        } catch {
          // If visibility check fails, skip this toast
          continue;
        }

        if (isVisible) {
          // Try to find close button first
          const closeButton = toast.locator(
            'button[aria-label*="close" i], button[aria-label*="dismiss" i], .close, [data-testid="toast-close"]',
          );

          let closeButtonCount = 0;
          try {
            closeButtonCount = await closeButton.count();
          } catch {
            // If counting fails, assume no close buttons
            closeButtonCount = 0;
          }

          if (closeButtonCount > 0) {
            let closeButtonVisible = false;
            try {
              closeButtonVisible = await closeButton
                .first()
                .isVisible({ timeout: 1000 });
            } catch {
              closeButtonVisible = false;
            }

            if (closeButtonVisible) {
              try {
                // Temporarily restore pointer events for close button
                await toast.evaluate(
                  (el) => {
                    const element = el as HTMLElement;
                    element.style.pointerEvents = "auto";
                    element.style.zIndex = "9999";
                  },
                  { timeout: 2000 },
                );
                await closeButton.first().click({ timeout: 2000 });
                // Set back to non-blocking
                await toast.evaluate(
                  (el) => {
                    const element = el as HTMLElement;
                    element.style.pointerEvents = "none";
                    element.style.zIndex = "-1";
                  },
                  { timeout: 2000 },
                );
              } catch {
                // If click fails, force hide the toast
                try {
                  await toast.evaluate(
                    (el) => {
                      const element = el as HTMLElement;
                      element.style.display = "none";
                    },
                    { timeout: 2000 },
                  );
                } catch {
                  // If even force hide fails, skip this toast
                  continue;
                }
              }
            } else {
              // No close button visible, force hide the toast
              try {
                await toast.evaluate(
                  (el) => {
                    const element = el as HTMLElement;
                    element.style.display = "none";
                  },
                  { timeout: 2000 },
                );
              } catch {
                continue;
              }
            }
          } else {
            // Try clicking the toast itself if it's dismissible
            let isDismissible = false;
            try {
              isDismissible = await toast.evaluate(
                (el) => {
                  return (
                    el.hasAttribute("data-dismiss") ||
                    el.classList.contains("dismissible") ||
                    el.style.cursor === "pointer"
                  );
                },
                { timeout: 2000 },
              );
            } catch {
              // If evaluation fails, assume not dismissible
              isDismissible = false;
            }

            if (isDismissible) {
              try {
                // Temporarily restore pointer events for dismiss
                await toast.evaluate(
                  (el) => {
                    const element = el as HTMLElement;
                    element.style.pointerEvents = "auto";
                    element.style.zIndex = "9999";
                  },
                  { timeout: 2000 },
                );
                await toast.click({ timeout: 2000 });
                // Set back to non-blocking
                await toast.evaluate(
                  (el) => {
                    const element = el as HTMLElement;
                    element.style.pointerEvents = "none";
                    element.style.zIndex = "-1";
                  },
                  { timeout: 2000 },
                );
              } catch {
                // If click fails, force hide the toast
                try {
                  await toast.evaluate(
                    (el) => {
                      const element = el as HTMLElement;
                      element.style.display = "none";
                    },
                    { timeout: 2000 },
                  );
                } catch {
                  // If force hide fails, skip this toast
                  continue;
                }
              }
            } else {
              // Force hide non-dismissible toasts
              try {
                await toast.evaluate(
                  (el) => {
                    const element = el as HTMLElement;
                    element.style.display = "none";
                  },
                  { timeout: 2000 },
                );
              } catch {
                // If force hide fails, skip this toast
                continue;
              }
            }
          }

          // Wait for this specific toast to disappear
          await page
            .waitForFunction(
              (element) => {
                return (
                  !element ||
                  element.style.display === "none" ||
                  element.style.opacity === "0" ||
                  !(element as HTMLElement).offsetParent
                );
              },
              await toast.elementHandle(),
              { timeout: 1000 },
            )
            .catch(() => {
              // If toast doesn't disappear, continue with other toasts
            });
        }
      }
    }

    // Final verification that toasts are gone or not interfering
    await page
      .waitForFunction(
        (selector) => {
          const elements = document.querySelectorAll(selector);
          // Check if toasts are gone or at least not blocking interactions
          return Array.from(elements).every((el) => {
            const element = el as HTMLElement;
            return (
              !(element as HTMLElement).offsetParent || // Not visible
              element.style.pointerEvents === "none" || // Not blocking
              element.style.opacity === "0" || // Transparent
              element.style.display === "none"
            ); // Hidden
          });
        },
        combinedSelector,
        { timeout: Math.min(timeout, 3000) },
      )
      .catch(() => {
        // If toasts still present, try to make them non-blocking
        page.evaluate((selector) => {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el) => {
            const element = el as HTMLElement;
            element.style.pointerEvents = "none";
            element.style.zIndex = "-1";
          });
        }, combinedSelector);
      });
  } catch (error) {
    // Don't fail tests if toast dismissal fails
    console.warn("Failed to dismiss toasts:", error);
  }
}

/**
 * Waits until nothing covers an element where it is: the element at its
 * centre is it, or inside it, within the window. It does not scroll.
 *
 * It used to force its way through after three tries (scrolling the
 * element into view, writing pointer-events, z-index, opacity and
 * position on it, removing `disabled`) and let the test go on, so a
 * covered or scrolled-away control passed: the logo test scrolled the page
 * back to the top through it. A covered element now fails the test.
 */
export async function ensureElementNotBlockedByToast(
  page: Page,
  elementSelector: string,
  timeout: number = 10000,
): Promise<void> {
  await dismissToasts(page, { timeout: 3000 });
  await page.waitForFunction(
    (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
        return false;
      }
      const hit = document.elementFromPoint(x, y);
      return !!hit && (hit === element || element.contains(hit));
    },
    elementSelector,
    { timeout },
  );
}

/**
 * Ensure playwright parameter is preserved in URL during navigation
 * Note: This function should be called BEFORE page load states, not after
 */
export async function ensurePlaywrightParam(page: Page): Promise<void> {
  const currentUrl = page.url();
  // Only add parameter if we haven't loaded the page yet or are on a different page
  if (!currentUrl.includes("playwright=true") && currentUrl !== "about:blank") {
    console.warn(
      "PlayWright param missing after page load - this indicates a test setup issue",
    );
  }
  // Don't modify URL after page has loaded to avoid navigation timing issues
}

/**
 * Enhanced mobile element interaction with multiple strategies
 */
export async function clickMobileElement(
  page: Page,
  elementSelector: string,
  options: {
    timeout?: number;
    retries?: number;
    ensureVisible?: boolean;
  } = {},
): Promise<boolean> {
  const {
    timeout = process.env.CI ? 25000 : 15000,
    retries = 3,
    ensureVisible = true,
  } = options;
  const isMobile = await page.evaluate(() => window.innerWidth <= 768);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const element = page.locator(elementSelector).first();

      // For mobile, ensure element is in viewport and not blocked
      if (isMobile) {
        if (ensureVisible) {
          // Scroll to element first
          await element
            .scrollIntoViewIfNeeded({ timeout: 5000 })
            .catch(() => {});

          // Wait for element to be visible
          await element.waitFor({ state: "visible", timeout: 5000 });
        }

        // Force remove any overlays or blocking elements
        await page.evaluate((selector) => {
          const el = document.querySelector(selector);
          if (el) {
            // Remove any potential overlays
            const overlays = document.querySelectorAll(
              '[style*="position: fixed"], [style*="position: absolute"][style*="z-index"]',
            );
            overlays.forEach((overlay) => {
              const zIndex = parseInt(
                getComputedStyle(overlay as HTMLElement).zIndex || "0",
              );
              if (zIndex > 1000) {
                (overlay as HTMLElement).style.display = "none";
              }
            });
          }
        }, elementSelector);

        // Dismiss any toasts that might be blocking
        await dismissToasts(page, { timeout: 2000, dismissByClick: true });
      }

      // Try multiple click strategies
      const clickStrategies = [
        // Standard click
        async () => await element.click({ timeout: timeout / 3 }),

        // Force click for mobile
        async () => await element.click({ force: true, timeout: timeout / 3 }),

        // JavaScript click as fallback
        async () =>
          await element.evaluate(
            (el: HTMLElement) => {
              el.style.pointerEvents = "auto";
              el.style.zIndex = "9999";
              el.click();
            },
            { timeout: timeout / 3 },
          ),

        // Tap for mobile devices
        async () => {
          if (isMobile) {
            await element.tap({ timeout: timeout / 3 });
          } else {
            throw new Error("Not mobile device");
          }
        },
      ];

      for (let i = 0; i < clickStrategies.length; i++) {
        try {
          // Clear toasts immediately before each click attempt
          await page.evaluate(
            () => {
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
            },
            { timeout: 2000 },
          );

          await page.waitForTimeout(50); // Brief wait
          await clickStrategies[i]();
          console.log(
            `Mobile click strategy ${i + 1} succeeded for ${elementSelector} (attempt ${attempt})`,
          );
          return true;
        } catch (strategyError) {
          console.warn(
            `Mobile click strategy ${i + 1} failed for ${elementSelector} (attempt ${attempt}):`,
            strategyError,
          );
          if (i === clickStrategies.length - 1) {
            throw strategyError; // Re-throw if all strategies failed
          }
        }
      }
    } catch (error) {
      console.warn(
        `Mobile click attempt ${attempt} failed for ${elementSelector}:`,
        error,
      );

      if (attempt === retries) {
        console.error(
          `All ${retries} mobile click attempts failed for ${elementSelector}`,
        );
        return false;
      }

      // Wait before retry with page context validation
      try {
        if (page.isClosed()) {
          console.warn(
            "Page context closed, cannot continue mobile click retries",
          );
          break;
        }
        await page.waitForTimeout(1000 * attempt);
      } catch (contextError) {
        console.warn(
          "Page context error during mobile click retry:",
          contextError,
        );
        break;
      }
    }
  }

  return false;
}

/**
 * Enhanced mobile viewport stabilization
 */
export async function stabilizeMobileViewport(page: Page): Promise<void> {
  try {
    // Force viewport to be stable while maintaining accessibility
    await page.evaluate(() => {
      // Set responsive viewport without disabling zoom (accessibility compliant)
      const meta = document.querySelector(
        'meta[name="viewport"]',
      ) as HTMLMetaElement;
      if (meta) {
        meta.content = "width=device-width, initial-scale=1.0";
      }

      // Prevent scroll bounce on iOS
      document.body.style.overscrollBehavior = "none";
      document.documentElement.style.overscrollBehavior = "none";

      // Ensure viewport is stable
      window.scrollTo(0, 0);
    });

    await page.waitForTimeout(500); // Let viewport settle
  } catch (error) {
    console.warn("Mobile viewport stabilization failed:", error);
  }
}

/**
 * Resilient theme toggle with multiple fallback strategies
 */
export async function toggleThemeReliably(
  page: Page,
  targetTheme: "dark" | "light",
  options: {
    timeout?: number;
    retries?: number;
  } = {},
): Promise<boolean> {
  const { timeout = process.env.CI ? 50000 : 30000, retries = 5 } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Check current theme
      const currentTheme = await page.evaluate(() => {
        return document.documentElement.classList.contains("dark")
          ? "dark"
          : "light";
      });

      if (currentTheme === targetTheme) {
        console.log(`Theme is already ${targetTheme}`);
        return true;
      }

      console.log(
        `Toggling theme from ${currentTheme} to ${targetTheme} (attempt ${attempt})`,
      );

      // Detect browser type for Firefox-specific handling
      const browserName =
        page.context().browser()?.browserType().name() || "unknown";
      const isFirefox = browserName === "firefox";

      // Multiple theme toggle strategies
      const toggleStrategies = [
        // Strategy 0: Firefox-specific dispatch event (prioritized for Firefox)
        async () => {
          if (!isFirefox) throw new Error("Skip for non-Firefox");

          await page.evaluate(() => {
            const button = document.querySelector(
              '[data-testid="theme-toggle"], button[aria-label*="Toggle theme"], button[class*="theme"]',
            ) as HTMLButtonElement;
            if (button) {
              // Force element to be interactable
              button.style.pointerEvents = "auto";
              button.style.zIndex = "99999";
              button.style.position = "relative";

              // Use dispatch event for Firefox
              const clickEvent = new MouseEvent("click", {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: 1,
              });
              button.dispatchEvent(clickEvent);

              // Also trigger change event in case it's needed
              const changeEvent = new Event("change", {
                bubbles: true,
                cancelable: true,
              });
              button.dispatchEvent(changeEvent);
            } else {
              throw new Error("Theme button not found");
            }
          });
        },

        // Strategy 1: Standard button click with aggressive toast clearing
        async () => {
          // First, aggressively remove all toasts that might block interactions
          await page.evaluate(() => {
            const toasts = document.querySelectorAll(
              '[role="alert"], [data-testid="toast"], .toast, .notification, [class*="toast"]',
            );
            toasts.forEach((toast) => {
              if (toast instanceof HTMLElement) {
                toast.style.display = "none";
                toast.style.pointerEvents = "none";
                toast.style.zIndex = "-9999";
                toast.style.visibility = "hidden";
                toast.style.opacity = "0";
                // Try to remove it entirely
                try {
                  toast.remove();
                } catch {}
              }
            });
          });

          const themeButton = page
            .getByRole("button", { name: /toggle theme/i })
            .first();
          await themeButton.waitFor({
            state: "visible",
            timeout: process.env.CI ? 15000 : 5000,
          }); // Increased timeout for Firefox in CI

          // Ensure button is clickable by forcing z-index
          await page.evaluate(() => {
            const buttons = document.querySelectorAll(
              '[data-testid="theme-toggle"], button[aria-label*="Toggle theme"], button[class*="theme"]',
            );
            buttons.forEach((button) => {
              if (button instanceof HTMLElement) {
                button.style.zIndex = "99999";
                button.style.pointerEvents = "auto";
              }
            });
          });

          await dismissToasts(page, { timeout: 2000 }); // Additional clearing

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

          await page.waitForTimeout(100); // Brief wait for DOM updates
          await themeButton.click({ timeout: timeout / 6 });
        },

        // Strategy 2: Force click with mobile handling and toast clearing
        async () => {
          // Clear toasts before mobile click
          await page.evaluate(() => {
            const toasts = document.querySelectorAll(
              '[role="alert"], [data-testid="toast"], .toast, .notification, [class*="toast"]',
            );
            toasts.forEach((toast) => {
              if (toast instanceof HTMLElement) {
                toast.style.display = "none";
                toast.style.pointerEvents = "none";
                toast.remove();
              }
            });
          });

          const success = await clickMobileElement(
            page,
            '[data-testid="theme-toggle"], button[aria-label*="Toggle theme"]',
            {
              timeout: timeout / 6,
              retries: 1,
            },
          );
          if (!success) throw new Error("Mobile click failed");
        },

        // Strategy 3: JavaScript direct toggle
        async () => {
          await page.evaluate(() => {
            const button = document.querySelector(
              '[data-testid="theme-toggle"], button[aria-label*="Toggle theme"], button[class*="theme"]',
            ) as HTMLButtonElement;
            if (button) {
              button.style.pointerEvents = "auto";
              button.style.zIndex = "9999";
              button.click();
            } else {
              throw new Error("Theme button not found");
            }
          });
        },

        // Strategies 4 and 5 were removed on purpose.
        //
        // Strategy 4 set `dark` on <html> itself and fired a storage event.
        // It could not fail, so this function could not return false, so the
        // only caller's "did the theme toggle work" check was unfalsifiable -
        // a deleted or broken ThemeToggle would still have produced a green
        // dark-theme run with the class painted on by the test.
        //
        // Strategy 5 pressed Alt+T. Nothing in src/ listens for Alt+T; it was
        // dead input that only cost the retry loop a round trip.
        //
        // Strategies 0-3 all go through the real button's click handler
        // (strategy 3 uses HTMLElement.click(), which fires the React handler
        // even when the breakpoint copy of the button is display:none), so a
        // false return now means the product is broken.
      ];

      for (let i = 0; i < toggleStrategies.length; i++) {
        try {
          await toggleStrategies[i]();

          // Wait for theme transition
          await page.waitForTimeout(1000);

          // Verify theme changed
          const newTheme = await page.evaluate(() => {
            return document.documentElement.classList.contains("dark")
              ? "dark"
              : "light";
          });

          if (newTheme === targetTheme) {
            console.log(
              `Theme toggle strategy ${i + 1} succeeded (attempt ${attempt})`,
            );
            return true;
          } else {
            console.warn(
              `Theme toggle strategy ${i + 1} completed but theme didn't change (attempt ${attempt})`,
            );
          }
        } catch (strategyError) {
          console.warn(
            `Theme toggle strategy ${i + 1} failed (attempt ${attempt}):`,
            strategyError,
          );
        }
      }
    } catch (error) {
      console.warn(`Theme toggle attempt ${attempt} failed:`, error);
    }

    if (attempt < retries) {
      console.log(`Waiting before theme toggle retry...`);
      try {
        // Check if page context is still valid before waiting
        if (page.isClosed()) {
          console.warn(
            "Page context closed, cannot continue theme toggle retries",
          );
          break;
        }
        await page.waitForTimeout(2000 * attempt);
      } catch (contextError) {
        console.warn("Page context error during retry wait:", contextError);
        break;
      }
    }
  }

  console.error(`All ${retries} theme toggle attempts failed`);
  return false;
}
