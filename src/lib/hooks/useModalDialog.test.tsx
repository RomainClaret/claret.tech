import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useLayoutEffect, useState } from "react";
import { useModalDialog, type ReturnFocus } from "./useModalDialog";

/**
 * The focus and keyboard contract every modal dialog of the site shares:
 * focus moves in, Tab stays in, Escape closes, focus goes back.
 */

function Dialog({
  onClose,
  lockScroll,
  restoreScroll,
  returnFocus,
}: {
  onClose: () => void;
  lockScroll?: boolean;
  restoreScroll?: boolean;
  returnFocus?: ReturnFocus;
}) {
  const ref = useModalDialog(true, onClose, {
    lockScroll,
    restoreScroll,
    returnFocus,
  });
  return (
    <div ref={ref} role="dialog" aria-label="Details" tabIndex={-1}>
      <button type="button">Close</button>
      <a href="https://github.com/x">View on GitHub</a>
      <button type="button" disabled>
        Trying
      </button>
      <a href="https://x.example">Live Demo</a>
    </div>
  );
}

const names = () =>
  (document.activeElement as HTMLElement | null)?.textContent ?? "";
const tab = (shiftKey = false) =>
  fireEvent.keyDown(document, { key: "Tab", shiftKey });

afterEach(() => {
  vi.restoreAllMocks();
  document.body.style.overflow = "";
});

describe("useModalDialog", () => {
  it("is ready the moment the dialog is on the page, before it paints", () => {
    // Loaded lazily, a dialog's passive effects ran after the browser had
    // painted it: an Escape pressed in between reached whatever else was
    // listening (the performance monitor, on window) and closed that, and a
    // Tab left the dialog. A later sibling's layout effect runs after the
    // dialog's and before any passive effect: when such a key lands.
    const onClose = vi.fn();
    const seen: { focused: boolean; locked: boolean; closed: boolean }[] = [];
    function Probe() {
      useLayoutEffect(() => {
        const focused =
          document.activeElement === document.querySelector('[role="dialog"]');
        const locked = document.body.style.overflow === "hidden";
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        seen.push({ focused, locked, closed: onClose.mock.calls.length > 0 });
      }, []);
      return null;
    }

    render(
      <>
        <Dialog onClose={onClose} lockScroll />
        <Probe />
      </>,
    );

    expect(seen[0]).toEqual({ focused: true, locked: true, closed: true });
  });

  it("takes the focus, and gives it back without scrolling", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const focus = vi.spyOn(opener, "focus");

    const { unmount } = render(<Dialog onClose={() => {}} />);
    expect(document.activeElement).toBe(screen.getByRole("dialog"));

    unmount();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("cycles Tab through every control, links included, both ways", () => {
    // WebKit's own Tab skips links; the hook moves focus itself, so the
    // cycle is the same in every browser.
    render(<Dialog onClose={() => {}} />);

    tab();
    expect(names()).toBe("Close");
    tab();
    expect(names()).toBe("View on GitHub");
    tab();
    expect(names()).toBe("Live Demo"); // the disabled button is skipped
    tab();
    expect(names()).toBe("Close");
    tab(true);
    expect(names()).toBe("Live Demo");
  });

  it("leaves out a wrapper with a positive tabindex around a link", () => {
    // pdf.js wraps each link of a PDF in a section with tabindex 1000:
    // counted, every link in the PDF reader would be two stops, the first
    // on an empty box.
    function Reader() {
      const ref = useModalDialog(true, () => {});
      return (
        <div ref={ref} role="dialog" aria-label="Paper" tabIndex={-1}>
          <button type="button">Zoom in</button>
          <section tabIndex={1000}>
            <a href="https://doi.org/10.1000/1">doi.org/10.1000/1</a>
          </section>
        </div>
      );
    }
    render(<Reader />);
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    const link = screen.getByRole("link");

    tab();
    expect(document.activeElement).toBe(zoomIn);
    tab();
    expect(document.activeElement).toBe(link);
    tab();
    expect(document.activeElement).toBe(zoomIn);
  });

  it("leaves out controls taken out of the Tab order", () => {
    // A roving tabindex, as on the research map, keeps one item at 0 and
    // the rest at -1. The cycle kept every button whatever its tabindex,
    // so Tab walked through every item.
    function Roving() {
      const ref = useModalDialog(true, () => {});
      return (
        <div ref={ref} role="dialog" aria-label="Map" tabIndex={-1}>
          <button type="button">Close</button>
          <button type="button" tabIndex={-1}>
            First item
          </button>
          <button type="button">Current item</button>
          <button type="button" tabIndex={-1}>
            Last item
          </button>
          <a href="#read">Read</a>
        </div>
      );
    }
    render(<Roving />);

    tab();
    expect(names()).toBe("Close");
    tab();
    expect(names()).toBe("Current item");
    tab();
    expect(names()).toBe("Read");
    tab();
    expect(names()).toBe("Close");
  });

  it("goes on from what Tab skips, in the page's order", () => {
    // Focus put on a heading to announce it (tabIndex -1): Tab went back
    // to the dialog's first control instead of the one after the heading.
    function Details() {
      const ref = useModalDialog(true, () => {});
      return (
        <div ref={ref} role="dialog" aria-label="Details" tabIndex={-1}>
          <button type="button">Close</button>
          <h3 tabIndex={-1}>Title</h3>
          <button type="button">Read Paper</button>
          <button type="button">Code</button>
        </div>
      );
    }
    render(<Details />);
    const title = screen.getByRole("heading", { name: "Title" });

    title.focus();
    tab();
    expect(names()).toBe("Read Paper");
    title.focus();
    tab(true);
    expect(names()).toBe("Close");
  });

  it("brings focus back in from outside the dialog", () => {
    render(<Dialog onClose={() => {}} />);
    (document.activeElement as HTMLElement).blur();

    tab(true);
    expect(names()).toBe("Live Demo");
    (document.activeElement as HTMLElement).blur();
    tab();
    expect(names()).toBe("Close");
  });

  it("marks the Escape it used, for the layers under it", () => {
    // The performance monitor listens on window, after every dialog's
    // document listener: one Escape closed the dialog and hid the monitor.
    render(<Dialog onClose={() => {}} />);

    expect(fireEvent.keyDown(document, { key: "Escape" })).toBe(false);
  });

  it("leaves an Escape from outside the dialog alone", () => {
    // The terminal sits above the dialogs and lets Escape through for the
    // panels it opened: typed there, it must not close a dialog beneath it.
    const onClose = vi.fn();
    const outside = document.createElement("textarea");
    document.body.appendChild(outside);
    render(<Dialog onClose={onClose} />);

    fireEvent.keyDown(outside, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    // From inside, from the page itself, or with nothing focused: its own.
    fireEvent.keyDown(screen.getByRole("button", { name: "Close" }), {
      key: "Escape",
    });
    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
    outside.remove();
  });

  it("closes on Escape with the latest callback", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Dialog onClose={first} />);
    rerender(<Dialog onClose={second} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("locks the page's scroll, and puts the page back instantly", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 640,
    });

    const { unmount } = render(<Dialog onClose={() => {}} lockScroll />);
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
    expect(scrollTo).toHaveBeenCalledWith({ top: 640, behavior: "instant" });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  it("leaves the page where it is when asked, still unlocking it", () => {
    // A dialog a link opened took its place before the page had scrolled
    // to the link's card: putting that place back left the card.
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 640,
    });

    const { unmount } = render(
      <Dialog onClose={() => {}} lockScroll restoreScroll={false} />,
    );
    unmount();

    expect(document.body.style.overflow).toBe("");
    expect(scrollTo).not.toHaveBeenCalled();
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  it("keeps the page locked while another dialog still is", () => {
    // Each dialog wrote "" as it closed: one closing over another
    // unlocked the page under the one still open.
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const first = render(<Dialog onClose={() => {}} lockScroll />);
    const second = render(<Dialog onClose={() => {}} lockScroll />);

    second.unmount();
    expect(document.body.style.overflow).toBe("hidden");

    first.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("leaves the keys to the dialog on top, then gives them back", () => {
    // Every open dialog listened on document, the one beneath first: with
    // the paper reader open over another dialog, the lower one pulled each
    // Tab into itself and the reader pulled it back to its first control,
    // so Tab never got past that control; and an Escape from the page
    // closed both.
    const below = vi.fn();
    const above = vi.fn();
    function Reader() {
      const ref = useModalDialog(true, above);
      return (
        <div ref={ref} role="dialog" aria-label="Paper" tabIndex={-1}>
          <button type="button">Zoom in</button>
          <button type="button">Zoom out</button>
        </div>
      );
    }
    render(<Dialog onClose={below} />);
    const reader = render(<Reader />);

    tab();
    expect(names()).toBe("Zoom in");
    tab();
    expect(names()).toBe("Zoom out");
    tab();
    expect(names()).toBe("Zoom in");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(above).toHaveBeenCalledTimes(1);
    expect(below).not.toHaveBeenCalled();

    reader.unmount();
    tab();
    expect(names()).toBe("Close");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(below).toHaveBeenCalledTimes(1);
  });

  it("returns focus to the opener it is given", () => {
    // Safari does not focus a clicked button: what has focus at open time
    // is not always the control that opened the dialog. (This test read the
    // opener while rendering, before it existed, so it passed a null and
    // checked the focus by the page's text, which the opener also held.)
    const opener = document.createElement("button");
    opener.textContent = "neat-tool";
    const elsewhere = document.createElement("button");
    document.body.append(opener, elsewhere);
    elsewhere.focus();
    function Opener() {
      const [open, setOpen] = useState(true);
      return open ? (
        <Dialog onClose={() => setOpen(false)} returnFocus={opener} />
      ) : null;
    }
    render(<Opener />);
    expect(document.activeElement).toBe(screen.getByRole("dialog"));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.activeElement).toBe(opener);
    opener.remove();
    elsewhere.remove();
  });

  it("asks a function for the way back when it closes", () => {
    // A dialog a link opened has no opener: its card's button, the way
    // back, is looked up as it closes.
    let opener: HTMLButtonElement | null = null;
    function Opener() {
      const [open, setOpen] = useState(true);
      return open ? (
        <Dialog onClose={() => setOpen(false)} returnFocus={() => opener} />
      ) : null;
    }
    render(<Opener />);
    opener = document.createElement("button");
    document.body.append(opener);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
