import { describe, it, expect, vi, afterEach } from "vitest";
import {
  HEAD_BOOT_SCRIPT,
  isSafariUserAgent,
  readStoredTheme,
  wantsHighContrast,
} from "./head-boot";
import { memoryStorage } from "@/test/memory-storage";
import { restoreNavigator, stubNavigator } from "@/test/navigator";

/**
 * The inline script settles the theme and the browser before the first
 * paint; the providers settle them again after hydration with the
 * functions. Both must reach the same answer.
 */

const UA = {
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
  safariIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  chrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
  chromeIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/143.0 Mobile/15E148 Safari/604.1",
  firefoxIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/140.0 Mobile/15E148 Safari/605.1.15",
  firefox:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0",
};

const root = document.documentElement;

function boot() {
  root.className = "";
  root.removeAttribute("data-safari");
  new Function(HEAD_BOOT_SCRIPT)();
  return {
    theme: root.classList.contains("dark") ? "dark" : "light",
    safari: root.getAttribute("data-safari"),
    animations: root.classList.contains("enable-animations"),
    highContrast: root.classList.contains("high-contrast"),
  };
}

/** A system that asks for more contrast, or not (prefers-contrast). */
function systemAsksForMoreContrast(more: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: more && query === "(prefers-contrast: more)",
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function setCookie(value: string) {
  Object.defineProperty(document, "cookie", {
    value,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  restoreNavigator();
  delete (document as { cookie?: string }).cookie;
  root.className = "";
  root.removeAttribute("data-safari");
});

describe("head boot: theme", () => {
  it.each([
    ["stored theme", { local: "dark", cookie: "" }, "dark"],
    [
      "cookie when storage has none",
      { local: null, cookie: "a=1; theme=dark" },
      "dark",
    ],
    [
      "cookie when storage holds junk",
      { local: "blue", cookie: "theme=dark" },
      "dark",
    ],
    ["default, light, when neither says", { local: null, cookie: "" }, "light"],
  ])("takes the %s", (_, { local, cookie }, expected) => {
    const storage = memoryStorage();
    if (local) storage.setItem("theme", local);
    vi.stubGlobal("localStorage", storage);
    setCookie(cookie);

    expect(boot().theme).toBe(expected);
    expect(readStoredTheme()).toBe(expected);
  });

  it("falls back to the cookie where storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
    });
    setCookie("theme=dark");

    expect(boot().theme).toBe("dark");
    expect(readStoredTheme()).toBe("dark");
  });

  it("lets the provider name its own last resort", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    setCookie("");

    expect(readStoredTheme("dark")).toBe("dark");
  });
});

describe("head boot: browser", () => {
  it.each([
    ["Safari on macOS", UA.safariMac, true],
    ["Safari on iOS", UA.safariIos, true],
    ["Chrome", UA.chrome, false],
    ["Edge", UA.edge, false],
    ["Chrome on iOS", UA.chromeIos, false],
    ["Firefox on iOS", UA.firefoxIos, false],
    ["Firefox", UA.firefox, false],
  ])("tells %s apart", (_, userAgent, safari) => {
    vi.stubGlobal("localStorage", memoryStorage());
    stubNavigator("userAgent", userAgent);

    const booted = boot();

    expect(booted.safari).toBe(String(safari));
    expect(booted.animations).toBe(!safari);
    expect(isSafariUserAgent(userAgent)).toBe(safari);
  });
});

describe("head boot: high contrast", () => {
  it.each([
    ["the visitor's choice to have it", "true", false, true],
    ["the system when the visitor never chose", null, true, true],
    ["the visitor's choice over the system", "false", true, false],
    ["the system over a stored value it does not know", "1", true, true],
    ["neither, when neither asks", null, false, false],
  ])("follows %s", (_, stored, more, expected) => {
    const storage = memoryStorage();
    if (stored !== null) storage.setItem("highContrast", stored);
    vi.stubGlobal("localStorage", storage);
    systemAsksForMoreContrast(more);

    expect(boot().highContrast).toBe(expected);
    expect(wantsHighContrast()).toBe(expected);
  });

  it("follows the system where storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
    });
    systemAsksForMoreContrast(true);

    expect(boot().highContrast).toBe(true);
    expect(wantsHighContrast()).toBe(true);
  });

  it("stays off where the browser has no matchMedia", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    vi.stubGlobal("matchMedia", undefined);

    expect(boot().highContrast).toBe(false);
    expect(wantsHighContrast()).toBe(false);
  });
});
