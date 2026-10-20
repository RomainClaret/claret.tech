/**
 * What the page needs to know before its first paint, decided in <head>.
 *
 * The homepage's HTML is generated once, at build time, so it cannot say
 * which theme a visitor picked or which browser they use: the server used
 * to read both from cookies on every request, which made each page view a
 * function call. A blocking script in <head> settles them on the visitor's
 * side instead, before anything is drawn, so a dark-theme visitor never
 * sees a light frame; high contrast is settled the same way. React then
 * hydrates from constant defaults and the providers catch up from the same
 * sources (theme-provider.tsx, safari-context.tsx, high-contrast-toggle.tsx).
 *
 * The script is plain ES5 written by hand: it runs before any bundle, in
 * every browser that reaches the page. HEAD_BOOT_SCRIPT and the functions
 * below must agree; head-boot.test.ts runs both on the same inputs.
 */

import { logWarning } from "@/lib/utils/dev-logger";

export type Theme = "light" | "dark";

const isTheme = (value: unknown): value is Theme =>
  value === "light" || value === "dark";

/**
 * The theme the system asks for, for a visitor who never chose one. Read at
 * load, as high contrast is: a change of the system's setting applies on the
 * next load.
 */
export function systemTheme(): Theme {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * The stored theme: localStorage, else `fallback`. A cookie used to back
 * it up, until round 25 (lib/theme-cookie.ts): the site sets none now.
 */
export function readStoredTheme(fallback: Theme = systemTheme()): Theme {
  try {
    const stored = window.localStorage.getItem("theme");
    if (isTheme(stored)) return stored;
  } catch {
    // Storage blocked: the fallback decides. (Not in unit tests, as the
    // provider never did: they block storage on purpose.)
    if (process.env.NODE_ENV !== "test") {
      logWarning(
        "Failed to read theme from localStorage",
        "theme-provider-read",
      );
    }
  }
  return fallback;
}

/**
 * Safari proper, not the Chromium browsers that also say "Safari" in their
 * user agent: the test the server's middleware used.
 */
export function isSafariUserAgent(userAgent: string): boolean {
  return (
    userAgent.indexOf("Safari") !== -1 &&
    userAgent.indexOf("Version/") !== -1 &&
    userAgent.indexOf("Chrome") === -1 &&
    userAgent.indexOf("Chromium") === -1 &&
    userAgent.indexOf("Edge") === -1 &&
    userAgent.indexOf("Edg/") === -1 &&
    userAgent.indexOf("CriOS") === -1 &&
    userAgent.indexOf("FxiOS") === -1
  );
}

/**
 * Applies the theme class, for Safari the data-safari attribute and the
 * missing enable-animations class, and high contrast, to <html>.
 */
export const HEAD_BOOT_SCRIPT = `(function(){var d=document.documentElement;var t=null;try{t=window.localStorage.getItem("theme")}catch(e){}if(t!=="light"&&t!=="dark"){t=typeof window.matchMedia==="function"&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.classList.remove("light","dark");d.classList.add(t);var u=navigator.userAgent;var s=u.indexOf("Safari")!==-1&&u.indexOf("Version/")!==-1&&u.indexOf("Chrome")===-1&&u.indexOf("Chromium")===-1&&u.indexOf("Edge")===-1&&u.indexOf("Edg/")===-1&&u.indexOf("CriOS")===-1&&u.indexOf("FxiOS")===-1;d.setAttribute("data-safari",s?"true":"false");if(s){d.classList.remove("enable-animations")}else{d.classList.add("enable-animations")}var h=null;try{h=window.localStorage.getItem("highContrast")}catch(e){}if(h==="true"||(h!=="false"&&typeof window.matchMedia==="function"&&window.matchMedia("(prefers-contrast: more)").matches)){d.classList.add("high-contrast")}})();`;
