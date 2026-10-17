import { describe, it, expect, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePageVisibility } from "./useVisibility";

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  document.dispatchEvent(new Event("visibilitychange"));
};

afterEach(() => {
  setHidden(false);
});

describe("usePageVisibility", () => {
  it("follows the tab as it is hidden and shown again", () => {
    const { result } = renderHook(() => usePageVisibility());
    expect(result.current).toBe(true);

    act(() => setHidden(true));
    expect(result.current).toBe(false);

    act(() => setHidden(false));
    expect(result.current).toBe(true);
  });

  it("starts hidden in a tab opened in the background", () => {
    setHidden(true);
    const { result } = renderHook(() => usePageVisibility());

    expect(result.current).toBe(false);
  });
});
