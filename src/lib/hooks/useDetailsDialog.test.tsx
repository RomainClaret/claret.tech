import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { DETAILS_TRIGGER, useDetailsDialog } from "./useDetailsDialog";

/**
 * A section's details dialog: which card's details are open, and what
 * closing does, after a click and after a link (#<card>-full).
 */

let hook: ReturnType<typeof useDetailsDialog<string>>;

function Section() {
  hook = useDetailsDialog<string>();
  return (
    <div id="card-a" onClick={hook.onCardClick("a")}>
      <p>Card text</p>
      <a href="https://example.com">A link of its own</a>
      <button type="button" {...{ [DETAILS_TRIGGER]: "" }}>
        Read more
      </button>
    </div>
  );
}

/** A card whose text is too short for a Read more. */
function ShortSection() {
  hook = useDetailsDialog<string>();
  return (
    <div id="card-b">
      <p>A short text</p>
      <button type="button" disabled>
        Not now
      </button>
      <a href="https://example.com/b">Its link</a>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("useDetailsDialog", () => {
  it("opens from anywhere on the card, the button being the way back", () => {
    render(<Section />);

    fireEvent.click(screen.getByText("Card text"));

    expect(hook.open?.item).toBe("a");
    expect(hook.dialog?.returnFocus).toBe(
      screen.getByRole("button", { name: "Read more" }),
    );
    expect(hook.dialog?.restoreScroll).toBe(true);
  });

  it("leaves the card's other controls to themselves", () => {
    render(<Section />);

    fireEvent.click(screen.getByRole("link", { name: "A link of its own" }));

    expect(hook.open).toBeNull();
  });

  it("does not open at the end of a drag that selected text", () => {
    render(<Section />);
    const text = screen.getByText("Card text");
    vi.spyOn(window, "getSelection").mockReturnValue({
      isCollapsed: false,
      anchorNode: text.firstChild,
    } as unknown as Selection);

    fireEvent.click(text);
    expect(hook.open).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    expect(hook.open?.item).toBe("a");
  });

  it("closes a dialog a link opened at the card, with the link as copy-link writes it", () => {
    // The link's scroll was under way when the dialog took its place:
    // putting that place back would leave the card. A reload of #card-a
    // points at the card instead of opening it again.
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    render(<Section />);
    const card = document.getElementById("card-a") as HTMLElement;
    card.getBoundingClientRect = () => ({ top: 900 }) as DOMRect;
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 20000,
    });
    window.history.replaceState(null, "", "#card-a-full");

    act(() => hook.showFromLink("a", "card-a"));
    const opened = hook.open;
    act(() => hook.showFromLink("a", "card-a"));

    expect(hook.open).toBe(opened);
    expect(hook.dialog?.restoreScroll).toBe(false);
    const returnFocus = hook.dialog?.returnFocus as () => HTMLElement;
    expect(returnFocus()).toBe(
      screen.getByRole("button", { name: "Read more" }),
    );

    act(() => hook.close());

    expect(hook.open).toBeNull();
    expect(window.location.hash).toBe("#card-a");
    expect(scrollTo).toHaveBeenCalledWith({
      top: 900 - 64,
      behavior: "instant",
    });
  });

  it("gives the focus to the card's first control when it has no Read more", () => {
    // The focus went back to what had it when the link opened the dialog,
    // the page itself, so Tab started from the top. Not to a disabled
    // button, which cannot take it.
    render(<ShortSection />);

    act(() => hook.showFromLink("b", "card-b"));

    const returnFocus = hook.dialog?.returnFocus as () => HTMLElement;
    expect(returnFocus()).toBe(screen.getByRole("link", { name: "Its link" }));
  });

  it("leaves the address alone when a click opened the dialog", () => {
    window.history.replaceState(null, "", "#card-a-full");
    render(<Section />);

    fireEvent.click(screen.getByText("Card text"));
    act(() => hook.close());

    expect(window.location.hash).toBe("#card-a-full");
  });
});
