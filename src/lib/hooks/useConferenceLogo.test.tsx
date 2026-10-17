import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";

const theme = vi.hoisted(() => ({ current: "light" as "light" | "dark" }));
vi.mock("@/components/ui/theme-provider", () => ({
  useTheme: () => ({ theme: theme.current }),
}));

import { useConferenceLogo } from "./useConferenceLogo";

const PPSN = "Parallel Problem Solving from Nature (PPSN) • 2026";

describe("useConferenceLogo", () => {
  it("leaves the logo out of the server's HTML: it is picked per theme", () => {
    function Probe() {
      const { logoUrl, isLoading } = useConferenceLogo(PPSN);
      return <p>{`${logoUrl ?? "none"} ${isLoading}`}</p>;
    }

    expect(renderToString(<Probe />)).toContain("none true");
  });

  it("picks the venue's logo for the theme in the browser", () => {
    theme.current = "light";
    const light = renderHook(() => useConferenceLogo(PPSN));
    expect(light.result.current).toEqual({
      logoUrl: "/images/ppsn_2026_logo.webp?v=2",
      isLoading: false,
    });

    theme.current = "dark";
    light.rerender();
    expect(light.result.current.logoUrl).toBe(
      "/images/ppsn_2026_logo_white.webp?v=2",
    );
  });

  it("has nothing to load for a paper without a venue", () => {
    const { result } = renderHook(() => useConferenceLogo(undefined));
    expect(result.current).toEqual({ logoUrl: null, isLoading: false });
  });
});
