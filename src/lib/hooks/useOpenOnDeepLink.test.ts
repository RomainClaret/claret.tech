import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useOpenOnDeepLink } from "./useOpenOnDeepLink";

describe("useOpenOnDeepLink", () => {
  it("starts closed, and toggles like a plain state", () => {
    const { result } = renderHook(() => useOpenOnDeepLink(false));
    expect(result.current[0]).toBe(false);

    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
  });

  it("opens in the render the deep link arrives in", () => {
    const renders: boolean[] = [];
    const { result, rerender } = renderHook(
      ({ linked }) => {
        const state = useOpenOnDeepLink(linked);
        renders.push(state[0]);
        return state;
      },
      { initialProps: { linked: false } },
    );

    renders.length = 0;
    rerender({ linked: true });

    expect(result.current[0]).toBe(true);
    // Never a committed render with the link and the card still closed.
    expect(renders.at(-1)).toBe(true);
  });

  it("opens a card linked from its first render", () => {
    const { result } = renderHook(() => useOpenOnDeepLink(true));
    expect(result.current[0]).toBe(true);
  });

  it("leaves the card as the reader set it once the link is released", () => {
    const { result, rerender } = renderHook(
      ({ linked }) => useOpenOnDeepLink(linked),
      { initialProps: { linked: true } },
    );
    act(() => result.current[1](false));

    rerender({ linked: false });
    expect(result.current[0]).toBe(false);

    rerender({ linked: true });
    expect(result.current[0]).toBe(true);
  });
});
