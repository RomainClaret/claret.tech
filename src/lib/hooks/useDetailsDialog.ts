"use client";

import { useState, type MouseEvent } from "react";
import { FOCUSABLE, type ReturnFocus } from "@/lib/hooks/useModalDialog";
import { DETAILS_SUFFIX } from "@/lib/hooks/useCardDeepLink";
import { alignToSection } from "@/lib/utils/scroll-to-section";

/** On a card's button that opens its details: the way back on close. */
export const DETAILS_TRIGGER = "data-details-trigger";

/** What a section's details dialog takes from it. */
export interface DialogControl {
  onClose: () => void;
  returnFocus: ReturnFocus;
  restoreScroll: boolean;
}

interface OpenDetails<T> {
  item: T;
  trigger: HTMLElement | null;
  /** The card's anchor, when a link (#<card>-full) opened the dialog. */
  cardId?: string;
}

/** Another control on a card is its own: a link, a button, a field. */
const CONTROL =
  "a[href], button, input, select, textarea, summary, [role='button']";

/**
 * Where a dialog a link opened gives the focus back: its card's Read more,
 * or on a card with none (a text too short for one) its first control in
 * the Tab order. The focus went back to what had it when the link opened
 * the dialog, the page itself, so Tab started from the top. FOCUSABLE, not
 * CONTROL: a disabled button cannot take the focus, and the dialog falls
 * back only when nothing is found.
 */
function cardFocus(cardId: string): HTMLElement | null | undefined {
  const card = document.getElementById(cardId);
  return (
    card?.querySelector<HTMLElement>(`[${DETAILS_TRIGGER}]`) ??
    [...(card?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].find(
      (element) => element.tabIndex === 0,
    )
  );
}

function readHash() {
  const raw = window.location.hash.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Which card's details are open in a section, and how they open and close.
 *
 * One dialog per section, rendered once outside the cards (DetailsDialog),
 * shows `open.item`. A card opens it from its button (`show`, with the
 * button as the way back) or, when the whole card is clickable,
 * `onCardClick`: a click anywhere on the card but its other controls, and
 * not the end of a drag that selected text. A link opens it with
 * `showFromLink`: then closing leaves the page at the card rather than where
 * it was when the dialog opened (the link's scroll was still under way),
 * gives the focus to the card's button (with none, its first control, see
 * cardFocus), and turns #<card>-full into #<card>
 * without a history entry, as copy-link writes it, so a reload points at the
 * card instead of opening it again.
 */
export function useDetailsDialog<T>() {
  const [open, setOpen] = useState<OpenDetails<T> | null>(null);

  const show = (item: T, trigger: HTMLElement | null) =>
    setOpen({ item, trigger });

  // The same link arriving twice (a hashchange queued before the section
  // mounted) opens one dialog.
  const showFromLink = (item: T, cardId: string) =>
    setOpen((current) =>
      current?.cardId === cardId ? current : { item, trigger: null, cardId },
    );

  const close = () => {
    const cardId = open?.cardId;
    if (cardId) {
      if (readHash() === cardId + DETAILS_SUFFIX) {
        window.history.replaceState(null, "", `#${cardId}`);
      }
      requestAnimationFrame(() => alignToSection(cardId));
    }
    setOpen(null);
  };

  const onCardClick =
    (item: T) =>
    (event: MouseEvent<HTMLElement>): void => {
      const card = event.currentTarget;
      const trigger = card.querySelector<HTMLElement>(`[${DETAILS_TRIGGER}]`);
      const control = (event.target as Element).closest(CONTROL);
      if (control && control !== trigger && card.contains(control)) return;
      // A drag that selected text is not asking for details.
      const selection = window.getSelection();
      const selecting =
        !!selection &&
        !selection.isCollapsed &&
        card.contains(selection.anchorNode);
      if (selecting && control !== trigger) return;
      show(item, trigger);
    };

  const dialog: DialogControl | null = open && {
    onClose: close,
    returnFocus: open.cardId
      ? () => cardFocus(open.cardId as string)
      : open.trigger,
    restoreScroll: !open.cardId,
  };

  return { open, show, showFromLink, close, onCardClick, dialog };
}
