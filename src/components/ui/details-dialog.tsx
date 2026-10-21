"use client";

import {
  useId,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
// Deep per-icon import, as in the PDF reader: the sections' tests mock the
// lucide barrel with the icons their cards use, and the dialogs load as
// chunks of their own.
import X from "lucide-react/dist/esm/icons/x";
import { useModalDialog, type ReturnFocus } from "@/lib/hooks/useModalDialog";
import { useOverlayLock } from "@/lib/hooks/useMotionGate";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { cn } from "@/lib/utils";
import { accentStyle } from "@/components/ui/accent-text";

interface DetailsDialogProps {
  /** The dialog's name, as its h2. */
  title: ReactNode;
  /** A line of facts under the title: stars, a venue, a date. */
  meta?: ReactNode;
  /** Drawn in `accent`, in a tinted circle before the title. */
  icon?: ComponentType<{ className?: string; style?: CSSProperties }>;
  /** The card's colour, as "r, g, b". */
  accent?: string;
  /** A short first paragraph, which also describes the dialog. */
  lead?: ReactNode;
  children?: ReactNode;
  /** Sticky at the bottom: two or three actions at most, for phones. */
  footer?: ReactNode;
  onClose: () => void;
  returnFocus?: ReturnFocus;
  /** False for a dialog a link opened: closing leaves the page at the card. */
  restoreScroll?: boolean;
  /** The backdrop's test id is this with "-backdrop". */
  testId?: string;
}

/**
 * A card's details, above the page: the frame of the GitHub project dialog,
 * which the research, skills, paper and blog cards share since round 27
 * instead of growing in place.
 *
 * Mounted only while open. It renders at the end of <body> through a portal,
 * above the cookie notice (z-50) and below the terminal, once per section
 * rather than inside a card: React events bubble through a portal along the
 * component tree, so inside a clickable card every click in the dialog would
 * reach the card too. It is a bottom sheet on phones and centred from `sm`
 * up, and the dialog itself is the one scroller, with the header and footer
 * sticky: it holds focus as it opens, so the arrow keys scroll it. No framer:
 * it must open when framer's chunk failed.
 */
export function DetailsDialog({
  title,
  meta,
  icon: Icon,
  accent,
  lead,
  children,
  footer,
  onClose,
  returnFocus,
  restoreScroll = true,
  testId,
}: DetailsDialogProps) {
  useOverlayLock(true); // mounted only while open
  const dialogRef = useModalDialog<HTMLDivElement>(true, onClose, {
    lockScroll: true,
    restoreScroll,
    returnFocus,
  });
  const reduce = useShouldReduceAnimations();
  const titleId = useId();
  const leadId = useId();

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-end justify-center sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        data-testid={testId ? `${testId}-backdrop` : undefined}
        // Not on the second click of a double click: the first one, on a
        // card, opened the dialog under the pointer.
        onClick={(event) => {
          if (event.detail <= 1) onClose();
        }}
        className={cn(
          "absolute inset-0",
          reduce ? "bg-background/90" : "bg-background/80 backdrop-blur-xs",
        )}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={lead ? leadId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex w-full flex-col overflow-y-auto overscroll-contain outline-hidden",
          "max-h-[85vh] supports-[height:100dvh]:max-h-[85dvh] sm:max-w-2xl",
          "rounded-t-2xl border border-border bg-background shadow-2xl sm:rounded-xl",
          !reduce && "motion-safe:animate-[slideUp_200ms_ease-out]",
        )}
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-border bg-background p-4 sm:p-6">
          {Icon && (
            <div
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={
                accent ? { backgroundColor: `rgba(${accent}, 0.1)` } : undefined
              }
            >
              <Icon
                className="h-5 w-5"
                style={accent ? { color: `rgb(${accent})` } : undefined}
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="wrap-break-word text-lg font-bold sm:text-xl"
            >
              {title}
            </h2>
            {meta && (
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {meta}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          {lead && (
            <p
              id={leadId}
              className="whitespace-pre-line wrap-break-word text-sm leading-relaxed text-muted-foreground"
            >
              {lead}
            </p>
          )}
          {children}
        </div>

        {footer && (
          <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-t border-border bg-background p-4 sm:flex-row sm:p-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** A titled part of a details dialog. */
export function DetailsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

/** A long text in a details dialog, its paragraphs kept. */
export function DetailsProse({ children }: { children: ReactNode }) {
  return (
    <p className="whitespace-pre-line wrap-break-word text-sm leading-relaxed text-muted-foreground sm:text-base">
      {children}
    </p>
  );
}

/**
 * Chips in the card's colour, as a list. `accent-text` keeps the site's
 * own colours readable on both themes; colours from elsewhere (GitHub's
 * languages) need `accent-text-any` (globals.css).
 */
export function AccentChips({
  items,
  accent,
  outsideColor = false,
}: {
  items: string[];
  /** "r, g, b" */
  accent: string;
  outsideColor?: boolean;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className={cn(
            outsideColor ? "accent-text-any" : "accent-text",
            "max-w-full wrap-break-word rounded-lg px-2.5 py-1 text-xs font-medium",
          )}
          style={{
            ...accentStyle(`rgb(${accent})`),
            backgroundColor: `rgba(${accent}, 0.1)`,
            border: `1px solid rgba(${accent}, 0.3)`,
          }}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

/** The footer's main action, and the others. */
export const primaryActionClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
export const secondaryActionClass =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
