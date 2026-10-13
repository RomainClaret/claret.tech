"use client";

import { useRef, type RefObject } from "react";
import { useIsomorphicLayoutEffect } from "@/lib/hooks/useIsomorphicLayoutEffect";
import { lockPageScroll } from "@/lib/utils/scroll-lock";

/** What Tab moves between inside a dialog. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

interface ModalDialogOptions {
  /** Keep the page under the dialog from scrolling, and restore its place. */
  lockScroll?: boolean;
  /**
   * Where focus goes back on close. Defaults to what had focus when the
   * dialog opened, which is not always the control that opened it: Safari
   * does not focus a button it clicks.
   */
  returnFocus?: HTMLElement | null;
}

/**
 * A modal dialog's focus and keyboard contract, shared by the site's dialogs.
 *
 * While `open`: the element given the returned ref (a `role="dialog"` with
 * `tabIndex={-1}`) takes focus, Escape from within it or from the page
 * calls the latest `onClose` (and is marked with preventDefault, so the
 * layers under it ignore it), and Tab
 * and Shift+Tab cycle through the dialog's own controls, in document order.
 * The cycle is moved by hand on every press, not only at its ends: WebKit's
 * default Tab skips links (and on macOS buttons too), so a trap that only
 * wrapped at its first and last control let Safari's Tab walk out of the
 * dialog from any control in between. On close, focus goes back without
 * scrolling to it, and with `lockScroll` the page returns to where it was,
 * instantly ("auto" would follow globals.css's `scroll-behavior: smooth`
 * and glide there).
 */
export function useModalDialog<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
  { lockScroll = false, returnFocus }: ModalDialogOptions = {},
): RefObject<T> {
  const dialogRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const returnFocusRef = useRef(returnFocus);
  returnFocusRef.current = returnFocus;

  // Before the browser paints the dialog, not after: mounted from a lazily
  // loaded chunk, a passive effect ran a frame or more later, and a key
  // pressed in between went elsewhere (an Escape closed the performance
  // monitor instead, a Tab left the dialog).
  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    const previous =
      returnFocusRef.current ?? (document.activeElement as HTMLElement | null);
    const scrollY = window.scrollY;
    // Counted: a dialog closing over another leaves the page locked.
    const release = lockScroll ? lockPageScroll() : null;
    dialogRef.current?.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Not its own when it comes from an element outside the dialog: the
        // terminal, above the dialogs, lets Escape through for the panels it
        // opened, and typed there it closed the reader beneath and took the
        // focus out of the terminal. From the page itself (body, document)
        // it is the dialog's.
        const from = event.target;
        if (
          from instanceof Element &&
          from !== document.body &&
          !dialogRef.current?.contains(from)
        ) {
          return;
        }
        // Marked as used: listeners further along, such as the performance
        // monitor's on window, leave it alone, so one Escape closes one
        // layer. Never checked here, as stacked dialogs register bottom
        // first.
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      const dialog = dialogRef.current;
      if (event.key !== "Tab" || !dialog) return;
      event.preventDefault();
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
      ].filter(
        // No positive tabindex. The only ones were pdf.js's, on the section
        // it wraps around each link of a PDF, which the reader now resets
        // (pdf-links.ts); counted, every link would be two stops, the first
        // on an empty box. Kept as a guard: the site sets none of its own.
        (element) => element.tabIndex <= 0,
      );
      if (focusable.length === 0) {
        dialog.focus({ preventScroll: true });
        return;
      }
      // From the dialog itself (where focus starts) or from anywhere outside
      // it, Tab goes to the first control and Shift+Tab to the last.
      const at = focusable.indexOf(document.activeElement as HTMLElement);
      const step = event.shiftKey ? -1 : 1;
      const next =
        at === -1
          ? event.shiftKey
            ? focusable.length - 1
            : 0
          : (at + step + focusable.length) % focusable.length;
      focusable[next].focus();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      if (release) {
        release();
        window.scrollTo({ top: scrollY, behavior: "instant" });
      }
      previous?.focus({ preventScroll: true });
    };
  }, [open, lockScroll]);

  return dialogRef;
}
