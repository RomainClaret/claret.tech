import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MotionConfigContext,
  useReducedMotion,
  useReducedMotionConfig,
} from "framer-motion";
import { useContext } from "react";
import {
  MotionProvider,
  retryOnce,
  trackMotionFeatures,
} from "./motion-provider";

/**
 * globals.css shows the content framer starts at opacity 0 unless <html>
 * says the features arrived: "ready" turns that off, "failed" shows it at
 * once, and no mark at all shows it 6 s after the first paint.
 */

const mark = () =>
  document.documentElement.getAttribute("data-motion-features");

describe("trackMotionFeatures", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-motion-features");
  });

  it("leaves <html> unmarked while the features load", () => {
    void trackMotionFeatures(new Promise(() => {}));

    expect(mark()).toBeNull();
  });

  it("marks <html> ready and hands the features on", async () => {
    const features = { renderer: () => null };

    await expect(trackMotionFeatures(Promise.resolve(features))).resolves.toBe(
      features,
    );

    expect(mark()).toBe("ready");
  });

  it("marks <html> failed and leaves framer waiting", async () => {
    // Rethrown, the failure reached LazyMotion's features().then(...), which
    // has no catch: an "Uncaught (in promise)" on every such visit. The
    // stylesheet shows the content instead, and framer just never runs.
    const settled = vi.fn();
    trackMotionFeatures(
      Promise.reject(new Error("Loading chunk 1405 failed.")),
    ).then(settled, settled);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mark()).toBe("failed");
    expect(settled).not.toHaveBeenCalled();
  });
});

describe("retryOnce", () => {
  // The features chunk is asked for once more, a second after a failure: a
  // transient one then still ends with the animations.
  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks once more after the delay, and hands on what the second try loads", async () => {
    vi.useFakeTimers();
    const features = { renderer: () => null };
    const load = vi
      .fn<() => Promise<typeof features>>()
      .mockRejectedValueOnce(new Error("Loading chunk 1405 failed."))
      .mockResolvedValueOnce(features);

    const loaded = retryOnce(load, 1000);
    await vi.advanceTimersByTimeAsync(999);
    expect(load).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    await expect(loaded).resolves.toBe(features);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("rejects when the second try fails too", async () => {
    vi.useFakeTimers();
    const error = new Error("Loading chunk 1405 failed.");
    const load = vi.fn(() => Promise.reject(error));

    const loaded = retryOnce(load, 1000);
    const settled = expect(loaded).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(1000);

    await settled;
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not ask again after a first try that worked", async () => {
    const load = vi.fn(() => Promise.resolve("features"));

    await expect(retryOnce(load, 1000)).resolves.toBe("features");
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("MotionProvider", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-motion-features");
  });

  it("lets framer follow a visitor's reduced-motion setting", () => {
    // Without a MotionConfig, framer's reducedMotion is "never": it slid and
    // scaled things for visitors who asked for less motion. framer reads the
    // system's setting itself, once per process (an earlier test file may
    // have read it), so this checks the config the provider hands framer,
    // and that framer's answer then is the system's.
    function Probe() {
      const { reducedMotion } = useContext(MotionConfigContext);
      const system = useReducedMotion();
      const applied = useReducedMotionConfig();
      return <p>{`${reducedMotion} ${String(applied === system)}`}</p>;
    }

    render(
      <MotionProvider>
        <Probe />
      </MotionProvider>,
    );

    expect(screen.getByText("user true")).toBeInTheDocument();
  });
});
