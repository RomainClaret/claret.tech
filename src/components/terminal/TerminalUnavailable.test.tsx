import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import React from "react";
import { withLoadFallback } from "@/lib/utils/load-fallback";
import { reloadPage } from "@/lib/utils/reload-page";
import { TerminalUnavailable } from "./TerminalUnavailable";

vi.mock("@/lib/utils/reload-page", () => ({ reloadPage: vi.fn() }));

/**
 * When the terminal's code cannot be fetched, this stands in for it. The
 * terminal stays mounted after its first open, so the fallback's try on
 * mount happened once: closing and reopening after the network came back
 * showed the same error until Retry was clicked.
 */

type Props = { isOpen: boolean; onClose: () => void };

const Loaded = ({ isOpen }: Props) => (isOpen ? <p>Terminal ready</p> : null);

/** A load that fails `failures` times, then works. */
function flaky(failures: number) {
  let calls = 0;
  return vi.fn(() =>
    ++calls <= failures
      ? Promise.reject(new Error("offline"))
      : Promise.resolve(Loaded),
  );
}

/** Resolve the loader once and render what it gave, as next/dynamic does. */
async function mount(load: () => Promise<React.ComponentType<Props>>) {
  const Terminal = await withLoadFallback(load, TerminalUnavailable)();
  let view: ReturnType<typeof render> | undefined;
  await act(async () => {
    view = render(<Terminal isOpen onClose={() => {}} />);
  });
  const reopen = async (isOpen: boolean) =>
    act(async () => {
      view!.rerender(<Terminal isOpen={isOpen} onClose={() => {}} />);
    });
  return reopen;
}

const ERROR = /Error loading terminal/;

describe("TerminalUnavailable", () => {
  it("tries again when the terminal is reopened", async () => {
    // Fails for the first load and the stand-in's try on mount.
    const load = flaky(2);
    const setOpen = await mount(load);
    expect(screen.getByText(ERROR)).toBeInTheDocument();

    await setOpen(false);
    expect(screen.queryByText(ERROR)).not.toBeInTheDocument();
    await setOpen(true); // the network is back

    expect(screen.getByText("Terminal ready")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("shows that it is retrying while a reopen's try is in flight", async () => {
    // Fails twice, then hangs: the box must not vanish meanwhile.
    let calls = 0;
    const load = vi.fn(() =>
      ++calls <= 2
        ? Promise.reject(new Error("offline"))
        : new Promise<React.ComponentType<Props>>(() => {}),
    );
    const setOpen = await mount(load);

    await setOpen(false);
    await setOpen(true);

    expect(screen.getByText(ERROR)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retrying..." })).toBeDisabled();
  });

  it("does not try again on its own while it stays open", async () => {
    // A failed try remounts the stand-in, open: that must not count as a
    // reopen, or it would retry in a loop.
    const load = flaky(Infinity);
    await mount(load);
    await act(async () => {});

    expect(screen.getByText(ERROR)).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("offers a reload once a retry has failed too", async () => {
    // A deploy can replace the chunk under an open page; trying again then
    // never works, only a reload does.
    let calls = 0;
    let failRetry = () => {};
    const load = vi.fn(() =>
      ++calls === 1
        ? Promise.reject(new Error("chunk gone"))
        : new Promise<React.ComponentType<Props>>((_, reject) => {
            failRetry = () => reject(new Error("chunk gone"));
          }),
    );
    await mount(load);
    // The stand-in's own try is in flight: nothing to offer yet.
    expect(
      screen.queryByRole("button", { name: "Reload page" }),
    ).not.toBeInTheDocument();

    await act(async () => failRetry());
    screen.getByRole("button", { name: "Reload page" }).click();

    expect(reloadPage).toHaveBeenCalledTimes(1);
  });
});
