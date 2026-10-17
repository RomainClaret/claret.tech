import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useWindowSize } from "./useWindowSize";

const resizeTo = (width: number, height: number) => {
  window.innerWidth = width;
  window.innerHeight = height;
  window.dispatchEvent(new Event("resize"));
};

describe("useWindowSize", () => {
  it("is the window's size in the browser, and follows a resize", () => {
    act(() => resizeTo(1280, 800));
    const { result } = renderHook(() => useWindowSize());
    expect(result.current).toEqual({ width: 1280, height: 800 });

    act(() => resizeTo(390, 844));
    expect(result.current).toEqual({ width: 390, height: 844 });
  });

  it("keeps the same object while the size does not change", () => {
    const { result, rerender } = renderHook(() => useWindowSize());
    const first = result.current;

    rerender();
    act(() => window.dispatchEvent(new Event("resize")));

    expect(result.current).toBe(first);
  });

  it("is a fixed size in the server's HTML", () => {
    function Probe() {
      const { width, height } = useWindowSize();
      return <p>{`${width}x${height}`}</p>;
    }

    expect(renderToString(<Probe />)).toContain("1152x768");
  });
});
