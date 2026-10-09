"use client";

import { useLayoutEffect, useRef } from "react";
import { reloadPage } from "@/lib/utils/reload-page";

// Shown while the terminal's code cannot be fetched. It honours the toggle
// like the terminal does: the fallback this replaced ignored isOpen and
// onClose, and next/dynamic kept it, so after one failed load a fixed
// 800x600 box stayed on the page, with no way to close it, until a reload.
export function TerminalUnavailable({
  isOpen,
  onClose,
  retry,
  retrying,
}: {
  isOpen: boolean;
  onClose: () => void;
  retry: () => void;
  retrying: boolean;
}) {
  // The terminal stays mounted once opened, and this stand-in with it, so
  // withLoadFallback's try on mount does not come round again: try on every
  // reopen instead. Not on mount, when that first try is already running.
  // Before paint, so the reopened box shows "Retrying" from its first frame.
  const wasOpen = useRef(isOpen);
  useLayoutEffect(() => {
    if (isOpen && !wasOpen.current) retry();
    wasOpen.current = isOpen;
  }, [isOpen, retry]);

  if (!isOpen) return null;
  return (
    <div
      role="alert"
      // Above the page, as the terminal itself is (zIndex 10000); the old
      // fallback had none and sat behind the content.
      className="fixed bottom-0 right-0 z-[10000] w-full md:w-[800px] h-[600px] bg-black rounded-t-lg shadow-2xl border border-red-500/50 p-4 font-mono"
    >
      <p className="text-red-500">
        Error loading terminal. Check your connection and try again.
      </p>
      <div className="mt-4 flex gap-4 text-sm">
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="text-green-400 hover:underline disabled:opacity-60 disabled:no-underline"
        >
          {retrying ? "Retrying..." : "Retry"}
        </button>
        {/* Once a retry has failed too: a deploy may have replaced the
            terminal's chunk since this page loaded. */}
        {!retrying && (
          <button
            type="button"
            onClick={reloadPage}
            className="text-green-400 hover:underline"
          >
            Reload page
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:underline"
        >
          Close
        </button>
      </div>
    </div>
  );
}
