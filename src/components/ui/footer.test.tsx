import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";

/**
 * The homepage is generated once, at build time, and must hydrate with the
 * same text: the year the footer shows comes from the build, and only once
 * the page runs does it switch to the visitor's year.
 */

vi.mock("@/data/portfolio", () => ({
  footerNote: { update: "2026-01-01" },
  socialMediaLinks: { display: false },
}));
vi.mock("@/components/ui/animated", () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/lib/hooks/useSafari", () => ({
  useShouldReduceAnimations: () => false,
}));
vi.mock("@/components/ui/legal-modals-provider", () => ({
  useLegalModals: () => ({
    openPrivacyModal: () => {},
    openTermsModal: () => {},
    openLicenseModal: () => {},
  }),
}));
vi.mock("@/components/legal/load-legal-texts", () => ({
  legalTextsIntent: {},
}));

import { Footer } from "./footer";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-01-02T10:00:00Z")); // the visitor's day
  vi.stubEnv("BUILD_YEAR", "2026"); // the build's year
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})), // the last commit never arrives
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Footer year", () => {
  it("renders the build's year, and the visitor's once it runs", async () => {
    const html = renderToString(<Footer />);
    expect(html).toContain("© <!-- -->2026");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await act(async () => {
        hydrateRoot(container, <Footer />);
      });

      expect(errors).not.toHaveBeenCalled(); // no hydration mismatch
      expect(container.textContent).toContain("© 2027");
    } finally {
      container.remove();
    }
  });
});
