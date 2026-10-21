import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { lazyDetails, type DetailsStandInProps } from "./lazy-details";

/**
 * The sections' details dialogs load as chunks of their own (round 27): on
 * intent, and with the card's own short text in their place while the chunk
 * cannot load.
 */

const { logError } = vi.hoisted(() => ({ logError: vi.fn() }));
vi.mock("@/lib/utils/dev-logger", () => ({ logError }));

const Details = ({ title }: DetailsStandInProps) => (
  <div role="dialog" aria-label={title}>
    The whole text
  </div>
);

const dialog = {
  onClose: vi.fn(),
  returnFocus: null,
  restoreScroll: true,
};

describe("lazyDetails", () => {
  beforeEach(() => {
    logError.mockReset();
  });

  it("fetches the dialog's code once, when a card is pointed at or focused", async () => {
    const importer = vi.fn(() => Promise.resolve(Details));
    const { intent } = lazyDetails(importer, "Test details chunk");
    render(<button {...intent}>Read more</button>);
    const button = screen.getByRole("button");

    expect(importer).not.toHaveBeenCalled();
    fireEvent.focus(button);
    expect(importer).toHaveBeenCalledTimes(1);
    fireEvent.pointerEnter(button);
    await waitFor(() => expect(importer).toHaveBeenCalledTimes(1));
  });

  it("fetches it on pointing alone", () => {
    const importer = vi.fn(() => Promise.resolve(Details));
    const { intent } = lazyDetails(importer, "Test details chunk");
    render(<button {...intent}>Read more</button>);

    fireEvent.pointerEnter(screen.getByRole("button"));

    expect(importer).toHaveBeenCalledTimes(1);
  });

  it("shows the dialog once its code is in", async () => {
    const { Dialog } = lazyDetails(
      () => Promise.resolve(Details),
      "Test details chunk",
    );

    render(<Dialog title="A card" summary="Its short text" dialog={dialog} />);

    expect(
      await screen.findByRole("dialog", { name: "A card" }),
    ).toHaveTextContent("The whole text");
  });

  it("shows the dialog at once when a later preload brought the code", async () => {
    // The first load failed, so the dialog's loader is the stand-in for the
    // rest of the session; a hover since then fetched the code.
    let online = false;
    const importer = vi.fn(() =>
      online ? Promise.resolve(Details) : Promise.reject(new Error("offline")),
    );
    const { Dialog, intent } = lazyDetails(importer, "Test details chunk");
    const first = render(
      <Dialog title="A card" summary="Its short text" dialog={dialog} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "A card" })).toHaveTextContent(
        "Could not load the details.",
      );
    });
    first.unmount();
    online = true;
    render(<button {...intent}>Read more</button>);
    fireEvent.pointerEnter(screen.getByRole("button"));
    await waitFor(() => expect(importer).toHaveBeenCalledTimes(3));
    await act(async () => {});

    render(<Dialog title="A card" summary="Its short text" dialog={dialog} />);

    // Not the stand-in's "Trying again" first, for a frame.
    expect(screen.getByText("The whole text")).toBeInTheDocument();
  });

  it("shows the card's own text while the code cannot load, and logs it under its name", async () => {
    const { Dialog } = lazyDetails(
      () => Promise.reject(new Error("chunk failed")),
      "Test details chunk",
    );

    render(<Dialog title="A card" summary="Its short text" dialog={dialog} />);

    const standIn = await screen.findByRole("dialog", { name: "A card" });
    expect(standIn).toHaveTextContent("Its short text");
    expect(standIn).toHaveTextContent("Could not load the details.");
    expect(logError).toHaveBeenCalledWith(
      expect.any(Error),
      "Test details chunk",
    );
  });
});
