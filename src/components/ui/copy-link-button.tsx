"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyLinkButtonProps {
  /** The card's deep-link anchor. Becomes the hash in the copied URL. */
  anchorId: string;
  /**
   * Accessible name, used for both `title` and `aria-label`. Phrase it for the
   * thing being linked, e.g. "Copy link to this paper". Tests query by this
   * exact string, so changing it for an existing card is a breaking change.
   */
  label: string;
  className?: string;
}

/**
 * Copies a deep link to one card.
 *
 * Extracted after this had been hand-duplicated three times (both card types
 * in Papers, plus the blog card) and was about to be a fourth for Experience.
 */
export function CopyLinkButton({
  anchorId,
  label,
  className,
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleCopy = async (event: React.MouseEvent) => {
    // Some cards toggle their expanded state from a click anywhere on the
    // card body, so copying a link would also collapse the thing you were
    // linking to. Harmless where no such handler exists.
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/#${anchorId}`,
      );
    } catch {
      // Clipboard access can be denied or unavailable over plain http. Say
      // nothing rather than flashing a success state that did not happen.
      return;
    }

    setCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0",
        className,
      )}
      title={label}
      aria-label={label}
    >
      {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
    </button>
  );
}
