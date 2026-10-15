"use client";

import {
  ToolUnavailableDialog,
  type Fallback,
} from "@/components/ui/performance-unavailable";
import type { CloseReason } from "./research-map-dialog";

/**
 * In place of the research map while its code cannot be fetched
 * (withLoadFallback in research-map-renderer.tsx): it says so and offers a
 * retry, instead of the error boundary's screen over the whole site.
 */
export function ResearchMapUnavailable({
  onClose,
  retry,
  retrying,
}: Fallback & { onClose: (reason: CloseReason) => void }) {
  return (
    <ToolUnavailableDialog
      name="research map"
      isOpen
      onClose={() => onClose("dismiss")}
      retry={retry}
      retrying={retrying}
    />
  );
}
