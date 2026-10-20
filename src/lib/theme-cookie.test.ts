import { describe, it, expect, afterEach } from "vitest";
import { expireThemeCookie } from "./theme-cookie";

/**
 * The site set a year's `theme` cookie until round 25, sent with every
 * request. It sets none now, and expires the copy a returning visitor
 * still carries. jsdom keeps real cookies for its http://localhost origin.
 */

afterEach(() => {
  for (const name of ["theme", "other"]) {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
});

describe("expireThemeCookie", () => {
  it("expires a theme cookie a returning visitor carries", () => {
    document.cookie = "theme=dark; Path=/";
    document.cookie = "other=1; Path=/";

    expireThemeCookie();

    expect(document.cookie).not.toMatch(/theme=/);
    expect(document.cookie).toMatch(/other=1/);
  });

  it("writes nothing when there is none", () => {
    document.cookie = "other=1; Path=/";

    expireThemeCookie();

    expect(document.cookie).toBe("other=1");
  });
});
