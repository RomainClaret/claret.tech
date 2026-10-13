import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { withLoadFallback } from "./load-fallback";

/**
 * A lazily loaded component whose chunk fails to load must not take the page
 * down: React.lazy throws, and for the legal texts in the root layout that
 * meant global-error replacing the whole site.
 */

const Text = ({ name }: { name: string }) => <p>Loaded {name}</p>;
const Failed = ({
  retry,
  retrying,
}: {
  name: string;
  retry: () => void;
  retrying: boolean;
}) => (
  <button onClick={retry} disabled={retrying}>
    {retrying ? "Trying again" : "Could not load. Try again"}
  </button>
);

/** A load that fails `failures` times, then works. */
function flaky(failures: number) {
  let calls = 0;
  const load = vi.fn(() =>
    ++calls <= failures
      ? Promise.reject(new Error("offline"))
      : Promise.resolve(Text),
  );
  return load;
}

/** Resolve the loader and render whatever it gave, as next/dynamic does. */
async function mount(
  loader: () => Promise<React.ComponentType<{ name: string }>>,
) {
  const Component = await loader();
  let view: ReturnType<typeof render> | undefined;
  await act(async () => {
    view = render(<Component name="privacy" />);
  });
  return view!;
}

describe("withLoadFallback", () => {
  it("resolves to the component when the load works", async () => {
    await mount(withLoadFallback(flaky(0), Failed));

    expect(screen.getByText("Loaded privacy")).toBeInTheDocument();
  });

  it("shows the fallback instead of throwing, and recovers on retry", async () => {
    // Fails for the first load and the stand-in's first try; works after.
    await mount(withLoadFallback(flaky(2), Failed));
    expect(screen.getByText("Could not load. Try again")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText("Could not load. Try again"));
    });

    expect(screen.getByText("Loaded privacy")).toBeInTheDocument();
  });

  it("tries again each time it mounts", async () => {
    // next/dynamic keeps what the loader first resolved to, so reopening a
    // modal after the network is back has to load again in the stand-in.
    const load = flaky(2);
    const Component = await withLoadFallback(load, Failed)(); // resolved once
    let first: ReturnType<typeof render> | undefined;
    await act(async () => {
      first = render(<Component name="privacy" />);
    });
    expect(screen.getByText("Could not load. Try again")).toBeInTheDocument();
    first!.unmount();

    await act(async () => {
      render(<Component name="privacy" />); // the modal opens again
    });

    expect(screen.getByText("Loaded privacy")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("keeps the fallback up, marked as retrying, while a try is in flight", async () => {
    // The first load fails; every try after it waits for the test to settle
    // it. Rendering nothing meanwhile dropped the PDF reader's dialog.
    let settle: (ok: boolean) => void = () => {};
    let calls = 0;
    const load = () =>
      ++calls === 1
        ? Promise.reject(new Error("offline"))
        : new Promise<React.ComponentType<{ name: string }>>(
            (resolve, reject) => {
              settle = (ok) =>
                ok ? resolve(Text) : reject(new Error("offline"));
            },
          );
    await mount(withLoadFallback(load, Failed));

    expect(screen.getByText("Trying again")).toBeDisabled(); // try on mount
    await act(async () => settle(false));
    expect(screen.getByText("Could not load. Try again")).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByText("Could not load. Try again"));
    });
    expect(screen.getByText("Trying again")).toBeDisabled();
    await act(async () => settle(true));

    expect(screen.getByText("Loaded privacy")).toBeInTheDocument();
  });

  it("remembers a success, so a later mount shows no failure first", async () => {
    // next/dynamic keeps the stand-in after one failure. Once a retry has
    // loaded the text, opening it again must not flash the failure.
    const load = flaky(1);
    let failedRenders = 0;
    const CountingFailed = (props: Parameters<typeof Failed>[0]) => {
      failedRenders++;
      return <Failed {...props} />;
    };
    const Component = await withLoadFallback(load, CountingFailed)();
    let first: ReturnType<typeof render> | undefined;
    await act(async () => {
      first = render(<Component name="privacy" />); // its try works
    });
    expect(screen.getByText("Loaded privacy")).toBeInTheDocument();
    first!.unmount();
    failedRenders = 0;

    await act(async () => {
      render(<Component name="privacy" />); // opened again
    });

    expect(screen.getByText("Loaded privacy")).toBeInTheDocument();
    expect(failedRenders).toBe(0);
    expect(load).toHaveBeenCalledTimes(2); // no load on the second mount
  });
  it("reports every failed load, the first and each retry's", async () => {
    // A renamed chunk after a deploy, a CSP or a blocker: the loads used to
    // fail without a word, the terminal's included (its logger returned at
    // once in a browser).
    const errors: unknown[] = [];
    await mount(
      withLoadFallback(flaky(2), Failed, {
        onError: (error) => errors.push(error),
      }),
    );
    expect(errors).toHaveLength(2); // the first load and the try on mount

    await act(async () => {
      fireEvent.click(screen.getByText("Could not load. Try again"));
    });

    expect(screen.getByText("Loaded privacy")).toBeInTheDocument();
    expect(errors).toHaveLength(2);
  });
  it("shows what a preload fetched since the failure, without the failure first", async () => {
    // The first load failed, then a hover preloaded the chunk. The stand-in
    // knew only its own retries, so the next open rendered the failure for
    // a frame (and a dialog's lock, focus and scroll cycled with it).
    let preloaded: React.ComponentType<{ name: string }> | undefined;
    let failedRenders = 0;
    const CountingFailed = (props: Parameters<typeof Failed>[0]) => {
      failedRenders++;
      return <Failed {...props} />;
    };
    const load = flaky(1);
    const Component = await withLoadFallback(load, CountingFailed, {
      peek: () => preloaded,
    })(); // resolved to the stand-in
    preloaded = Text; // the hover preload landed

    await act(async () => {
      render(<Component name="privacy" />);
    });

    expect(screen.getByText("Loaded privacy")).toBeInTheDocument();
    expect(failedRenders).toBe(0);
    expect(load).toHaveBeenCalledTimes(1); // nothing to retry
  });

  it("shows a chunk that lands between the first render and the mount effect", async () => {
    // The render found nothing loaded, so it showed "Trying again". By the
    // effect a preload had landed: the effect skipped its retry for it, but
    // never showed it either, and the button stayed disabled for good.
    let peeks = 0;
    const load = flaky(1);
    const Component = await withLoadFallback(load, Failed, {
      peek: () => (++peeks > 1 ? Text : undefined),
    })();

    await act(async () => {
      render(<Component name="privacy" />);
    });

    expect(screen.getByText("Loaded privacy")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1); // nothing to retry
  });

  // A reporter that throws must not undo the fallback it reports on.
  const throwing = () => {
    throw new Error("logger broke");
  };

  it("still resolves to the stand-in when the report of the first failure throws", async () => {
    // Rejecting here is what the fallback exists to prevent: React.lazy
    // throws, and the nearest error boundary replaces the page.
    await expect(
      withLoadFallback(flaky(1), Failed, { onError: throwing })(),
    ).resolves.toBeDefined();
  });

  it("re-enables the retry when the report of a failed retry throws", async () => {
    // The stand-in's try on mount fails too, and its report throws. Told
    // only after the report, the stand-in stayed on a disabled "Trying
    // again" with nothing in flight.
    let reports = 0;
    await mount(
      withLoadFallback(flaky(Infinity), Failed, {
        onError: () => {
          if (++reports > 1) throwing();
        },
      }),
    );

    expect(reports).toBe(2); // the first load and the try on mount
    expect(screen.getByText("Could not load. Try again")).toBeEnabled();
  });
});
