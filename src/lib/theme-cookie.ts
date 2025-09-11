import Cookies from "js-cookie";

export type Theme = "light" | "dark";

const THEME_COOKIE_NAME = "theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return (Cookies.get(THEME_COOKIE_NAME) as Theme) || "light";
}

export function setTheme(theme: Theme): void {
  Cookies.set(THEME_COOKIE_NAME, theme, {
    expires: 365, // 1 year
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function getResolvedTheme(theme: Theme): "light" | "dark" {
  return theme;
}
