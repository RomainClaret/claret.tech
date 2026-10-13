import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import React from "react";
import { withLoadFallback } from "@/lib/utils/load-fallback";
import { SplashUnavailable } from "./splash-unavailable";

/**
 * When the splash's code cannot be fetched, this stands in for it. The
 * failed load reached the error boundary around the whole site, whose error
 * screen replaced the page until a reload. The stand-in shows nothing and,
 * once its own try has failed too, completes as the splash would have, which
 * takes the backdrop away (app-wrapper.tsx).
 */

type Props = { onComplete?: () => void; onShow?: () => void; skip?: boolean };

const Splash = ({ skip }: Props) => (
  <p>Splash {skip ? "skipped" : "playing"}</p>
);

/** A load that fails `failures` times, then works. */
function flaky(failures: number) {
  let calls = 0;
  return vi.fn(() =>
    ++calls <= failures
      ? Promise.reject(new Error("Loading chunk 7653 failed."))
      : Promise.resolve(Splash),
  );
}

/** Resolve the loader once and render what it gave, as next/dynamic does. */
async function mount(
  load: () => Promise<React.ComponentType<Props>>,
  props: Props,
) {
  const SplashScreen = await withLoadFallback(load, SplashUnavailable)();
  let view: ReturnType<typeof render> | undefined;
  await act(async () => {
    view = render(<SplashScreen {...props} />);
  });
  return view!;
}

describe("SplashUnavailable", () => {
  it("shows nothing and completes once the second try has failed too", async () => {
    const onComplete = vi.fn();
    const load = flaky(2); // the first load and the try on mount

    const { container } = await mount(load, { onComplete });

    expect(container).toBeEmptyDOMElement();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not complete while its try is in flight", async () => {
    // Completing then would cut a splash that is about to load: the page
    // would show, and the splash would never play.
    let settle: (ok: boolean) => void = () => {};
    let calls = 0;
    const load = () =>
      ++calls === 1
        ? Promise.reject(new Error("Loading chunk 7653 failed."))
        : new Promise<React.ComponentType<Props>>((resolve, reject) => {
            settle = (ok) =>
              ok ? resolve(Splash) : reject(new Error("still offline"));
          });
    const onComplete = vi.fn();

    await mount(load, { onComplete });
    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => settle(false));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("plays the splash, with its props, when the second try loads it", async () => {
    const onComplete = vi.fn();

    await mount(flaky(1), { onComplete, skip: true });

    // The splash, told to skip as AppWrapper told the stand-in, completes
    // on its own: the stand-in does not complete it first.
    expect(screen.getByText("Splash skipped")).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("completes again only if told of a new failure", async () => {
    // A re-render (AppWrapper's timer telling the splash to skip) must not
    // complete it a second time.
    const onComplete = vi.fn();
    const SplashScreen = await withLoadFallback(flaky(2), SplashUnavailable)();
    let view: ReturnType<typeof render> | undefined;
    await act(async () => {
      view = render(<SplashScreen onComplete={onComplete} />);
    });

    await act(async () => {
      view!.rerender(<SplashScreen onComplete={onComplete} skip />);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("completes once, even when handed a new callback", async () => {
    // AppWrapper's callback is stable today; a new one on a re-render used
    // to run the completion again.
    const first = vi.fn();
    const second = vi.fn();
    const SplashScreen = await withLoadFallback(flaky(2), SplashUnavailable)();
    let view: ReturnType<typeof render> | undefined;
    await act(async () => {
      view = render(<SplashScreen onComplete={first} />);
    });

    await act(async () => {
      view!.rerender(<SplashScreen onComplete={second} />);
    });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});
