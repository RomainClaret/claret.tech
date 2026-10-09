import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

/**
 * When the PDF reader's chunk cannot be fetched, a dialog stands in for it.
 * It is aria-modal, so it has to behave like the reader's own modal: the
 * page behind pauses and does not scroll, and focus moves into the dialog
 * and comes back when it closes.
 */

// The reader's chunk keeps failing (offline).
vi.mock("@/lib/pdf-reader-preload", () => ({
  loadPdfReader: () => Promise.reject(new Error("offline")),
  loadedPdfReader: () => undefined, // nothing has loaded it
}));

vi.mock("@/lib/utils/reload-page", () => ({ reloadPage: vi.fn() }));

import { loadPdfModal } from "./pdf-modal-loader";
import { reloadPage } from "@/lib/utils/reload-page";
import {
  getSnapshot as getMotionGate,
  resetMotionGateForTests,
} from "@/lib/utils/motion-gate";

afterEach(() => {
  resetMotionGateForTests();
  document.body.style.overflow = "";
});

describe("the reader-unavailable dialog", () => {
  it("holds the page like the reader does, and lets go on close", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {}); // jsdom lacks it
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    // next/dynamic resolves the loader once: to the stand-in, after a failure.
    const Modal = await loadPdfModal();

    let view: ReturnType<typeof render> | undefined;
    await act(async () => {
      view = render(
        <Modal isOpen onClose={() => {}} pdfUrl="/pdfs/x.pdf" title="Thesis" />,
      );
    });

    expect(getMotionGate().suspended).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement).toBe(screen.getByRole("dialog"));

    act(() => view!.unmount()); // closed
    expect(getMotionGate().suspended).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
  it("keeps Tab and Shift+Tab inside, from the moment it opens", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {}); // jsdom lacks it
    const Modal = await loadPdfModal();
    await act(async () => {
      render(
        <Modal isOpen onClose={() => {}} pdfUrl="/pdfs/x.pdf" title="Thesis" />,
      );
    });
    expect(document.activeElement).toBe(screen.getByRole("dialog"));

    // From the dialog itself, where focus starts.
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close" }),
    );

    // From the page behind, where focus goes if a button is disabled under it.
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Try again" }),
    );
  });

  it("offers a reload once its own retry has failed too", async () => {
    // A deploy can replace the reader's chunk under an open page; trying
    // again then never works, only a reload does.
    vi.spyOn(window, "scrollTo").mockImplementation(() => {}); // jsdom lacks it
    const Modal = await loadPdfModal();
    await act(async () => {
      render(
        <Modal isOpen onClose={() => {}} pdfUrl="/pdfs/x.pdf" title="Thesis" />,
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Reload page" }));

    expect(reloadPage).toHaveBeenCalledTimes(1);
  });
});
