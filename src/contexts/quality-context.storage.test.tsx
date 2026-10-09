import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/**
 * QualityProvider reads its stored tier while rendering. Where the browser
 * blocks storage, touching localStorage throws a SecurityError, and a stored
 * quality-auto that is not JSON made JSON.parse throw: either way the whole
 * provider tree went down.
 */

vi.mock("@/components/providers/test-mode-provider", () => ({
  useTestMode: () => ({ isTestMode: false }),
}));
vi.mock("@/lib/quality/probe", () => ({
  probeDeviceOnce: () => ({ weak: false, reason: null, renderer: "Apple M3" }),
}));
vi.mock("@/lib/utils/when-idle", () => ({
  whenIdle: (task: () => void) => {
    task();
    return () => {};
  },
}));
vi.mock("@/lib/hooks/useFpsOnly", () => ({
  useFpsOnly: () => ({ fps: 60, isLowFps: false, refreshRate: 60, sample: 0 }),
}));

import { QualityProvider, useQuality } from "./quality-context";
import { memoryStorage } from "@/test/memory-storage";
import { blockStorage } from "@/test/blocked-storage";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36";
const originalUserAgent = navigator.userAgent;

const Quality = () => {
  const { quality, isAuto } = useQuality();
  return (
    <p data-testid="quality">
      {quality} {isAuto ? "auto" : "manual"}
    </p>
  );
};

const renderProvider = () =>
  render(
    <QualityProvider>
      <Quality />
    </QualityProvider>,
  );

let unblock = () => {};

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
  Object.defineProperty(navigator, "userAgent", {
    value: CHROME,
    configurable: true,
  });
});

afterEach(() => {
  unblock();
  unblock = () => {};
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "userAgent", {
    value: originalUserAgent,
    configurable: true,
  });
});

describe("QualityProvider storage", () => {
  it("renders with the default tier when the browser blocks storage", () => {
    unblock = blockStorage();

    renderProvider();

    expect(screen.getByTestId("quality").textContent).toBe("balanced auto");
  });

  it("reads a stored quality-auto that is not JSON as automatic", () => {
    localStorage.setItem("quality-auto", "yes");

    renderProvider();

    expect(screen.getByTestId("quality").textContent).toBe("balanced auto");
  });

  it("still restores a tier chosen by hand", () => {
    localStorage.setItem("quality-auto", "false");
    localStorage.setItem("quality-mode", "maximum");

    renderProvider();

    expect(screen.getByTestId("quality").textContent).toBe("maximum manual");
  });
});

describe("QualityProvider on a page generated at build time", () => {
  it("renders the defaults on the server, without reading storage", async () => {
    const { renderToString } = await import("react-dom/server");
    localStorage.setItem("quality-auto", "false");
    localStorage.setItem("quality-mode", "low");
    const read = vi.spyOn(localStorage, "getItem");

    const html = renderToString(
      <QualityProvider>
        <Quality />
      </QualityProvider>,
    );

    // Read while rendering, the visitor's tier went into a render that has
    // to match HTML generated without it.
    expect(html.replace(/<!-- -->/g, "")).toContain(">balanced auto<");
    expect(read).not.toHaveBeenCalled();
  });

  it("restores a tier chosen by hand, and never saves the default over it", () => {
    localStorage.setItem("quality-auto", "false");
    localStorage.setItem("quality-mode", "low");
    const written: string[] = [];
    const setItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      written.push(`${key}=${value}`);
      setItem(key, value);
    });
    const removed = vi.spyOn(localStorage, "removeItem");

    renderProvider();

    expect(screen.getByTestId("quality")).toHaveTextContent("low manual");
    expect(written).not.toContain("quality-mode=balanced");
    expect(written).not.toContain("quality-auto=true");
    expect(removed).not.toHaveBeenCalledWith("quality-mode");
    expect(localStorage.getItem("quality-mode")).toBe("low");
  });
});
