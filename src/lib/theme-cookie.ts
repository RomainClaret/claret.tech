/**
 * The theme was kept in a cookie as well as in localStorage, until round
 * 25: a year's cookie, sent with every request, which no server has read
 * since the homepage became static (lib/boot/head-boot.ts). It is set no
 * more, and the copy a returning visitor still carries is expired, so the
 * site sets no cookie at all.
 */
export function expireThemeCookie(): void {
  if (typeof document === "undefined") return;
  if (!/(?:^|;\s*)theme=/.test(document.cookie)) return;
  // A Secure cookie can only be overwritten as one.
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `theme=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
}
