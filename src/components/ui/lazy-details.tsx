"use client";

import dynamic from "next/dynamic";
import type { ComponentType, ReactNode } from "react";
import { ToolUnavailableDialog } from "@/components/ui/performance-unavailable";
import type { DialogControl } from "@/lib/hooks/useDetailsDialog";
import { logError } from "@/lib/utils/dev-logger";
import { withLoadFallback } from "@/lib/utils/load-fallback";
import { loadOnIntent } from "@/lib/utils/load-on-intent";

/** What every card's details dialog is given, and its stand-in shows. */
export interface DetailsStandInProps {
  /** The card's name: the dialog's, and the stand-in's, title. */
  title: string;
  /** The card's own short text, which the page already has. */
  summary: ReactNode;
  dialog: DialogControl;
}

/**
 * In place of a card's details while their chunk cannot load: the card's
 * own short text, and a way to try again.
 */
function DetailsUnavailable({
  title,
  summary,
  dialog,
  retry,
  retrying,
}: DetailsStandInProps & { retry: () => void; retrying: boolean }) {
  return (
    <ToolUnavailableDialog
      name="details"
      title={title}
      isOpen
      onClose={dialog.onClose}
      retry={retry}
      retrying={retrying}
      lockScroll
      restoreScroll={dialog.restoreScroll}
      returnFocus={dialog.returnFocus}
    >
      <p className="text-sm text-muted-foreground">{summary}</p>
    </ToolUnavailableDialog>
  );
}

/**
 * A section's details dialog, as a chunk of its own: fetched when a card or
 * its Read more is pointed at or focused (spread `intent` on it), mounted
 * only while open, and the stand-in above while it cannot load. One per
 * section, at the module's top level; `label` names the chunk in the logs.
 */
export function lazyDetails<P extends DetailsStandInProps>(
  importer: () => Promise<ComponentType<P>>,
  label: string,
) {
  const chunk = loadOnIntent(importer);
  return {
    Dialog: dynamic(
      withLoadFallback(chunk.load, DetailsUnavailable, {
        onError: (error) => logError(error, label),
        peek: chunk.loaded,
      }),
      { ssr: false, loading: () => null },
    ),
    intent: { onPointerEnter: chunk.preload, onFocus: chunk.preload },
  };
}
