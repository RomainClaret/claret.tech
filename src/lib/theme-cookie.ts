import Cookies from "js-cookie";

export type Theme = "light" | "dark";

const THEME_COOKIE_NAME = "theme";

export function setTheme(theme: Theme): void {
  Cookies.set(THEME_COOKIE_NAME, theme, {
    expires: 365, // 1 year
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
