"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTerminal } from "@/lib/terminal/terminal-context";
import { withLoadFallback } from "@/lib/utils/load-fallback";
import { logError } from "@/lib/utils/dev-logger";
import { ResearchMapUnavailable } from "./research-map-unavailable";
import type { CloseReason } from "./research-map-dialog";

// Fetched on the first `research`, so the map costs the page nothing until
// someone asks for it. A chunk that cannot be fetched shows the stand-in.
const ResearchMapDialog = dynamic(
  withLoadFallback(
    () => import("./research-map-dialog").then((mod) => mod.ResearchMapDialog),
    ResearchMapUnavailable,
    { onError: (error) => logError(error, "Research map chunk") },
  ),
  { ssr: false },
);

/**
 * Opens the research map on the terminal's `research` and closes it on
 * `research close`. An open event counts only with a token less than ten
 * seconds old, as the performance dashboard's does.
 *
 * The terminal steps aside while the map is open: it sits above every
 * dialog, and its window would cover the map and take its clicks (its
 * minimized bar too, over the map's toolbar). Dismissed, the map gives it
 * back with the focus in its input; left for a card on the page, the map
 * gives it back minimized, out of the card's way.
 */
export function ResearchMapRenderer() {
  const [open, setOpen] = useState(false);
  const { isOpen: terminalOpen, setAside, minimize } = useTerminal();
  const terminalOpenRef = useRef(terminalOpen);
  terminalOpenRef.current = terminalOpen;
  const tookTerminal = useRef(false);

  const close = useCallback(
    (reason: CloseReason) => {
      setOpen(false);
      if (!tookTerminal.current) return;
      tookTerminal.current = false;
      setAside(false);
      if (reason === "navigate") {
        minimize();
        return;
      }
      // Next frame: the terminal is shown again by then, and focus can go
      // back to where `research` was typed.
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLTextAreaElement>(".xterm-helper-textarea")
          ?.focus({ preventScroll: true }),
      );
    },
    [setAside, minimize],
  );
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    const onOpen = (event: Event) => {
      const { token, timestamp } =
        (event as CustomEvent<{ token?: string; timestamp?: number }>).detail ??
        {};
      if (!token || !timestamp || Date.now() - timestamp >= 10000) return;
      setOpen(true);
      if (terminalOpenRef.current && !tookTerminal.current) {
        tookTerminal.current = true;
        setAside(true);
      }
    };
    const onClose = () => closeRef.current("dismiss");
    window.addEventListener("terminal-research-map", onOpen);
    window.addEventListener("terminal-research-close", onClose);
    return () => {
      window.removeEventListener("terminal-research-map", onOpen);
      window.removeEventListener("terminal-research-close", onClose);
    };
  }, [setAside]);

  if (!open) return null;
  return <ResearchMapDialog onClose={close} />;
}
