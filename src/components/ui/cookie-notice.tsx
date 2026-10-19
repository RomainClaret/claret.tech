"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useIsomorphicLayoutEffect } from "@/lib/hooks/useIsomorphicLayoutEffect";
import { useLegalModals } from "@/components/ui/legal-modals-provider";
import { legalTextsIntent } from "@/components/legal/load-legal-texts";

export default function CookieNotice() {
  const [showNotice, setShowNotice] = useState(false);
  const { openPrivacyModal, openTermsModal } = useLegalModals();
  const noticeRef = useRef<HTMLDivElement>(null);
  // First in <body>, before the skip links (GOV.UK's placement): keyboard
  // and screen reader users meet it first, and once it is gone the next Tab
  // goes on to the skip link. Rendered last, it came after the whole page,
  // and after "Got it!" WebKit sent the next Tab to the browser itself. A
  // container of its own, put in place before paint; its height is measured
  // after (the effect below).
  const [host] = useState(() =>
    typeof document === "undefined" ? null : document.createElement("div"),
  );
  useIsomorphicLayoutEffect(() => {
    if (!showNotice || !host) return;
    document.body.prepend(host);
    return () => host.remove();
  }, [showNotice, host]);

  useEffect(() => {
    try {
      // Check if user has already acknowledged the cookie notice
      const hasAcknowledged = localStorage.getItem(
        "cookie-notice-acknowledged",
      );
      if (!hasAcknowledged) {
        // Show notice after a short delay to avoid layout shift
        const timer = setTimeout(() => {
          setShowNotice(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    } catch {
      // If localStorage is unavailable, show the notice anyway
      const timer = setTimeout(() => {
        setShowNotice(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Its height, for the page to keep clear of it while it shows
  // (globals.css): fixed at the bottom, it covered the footer's last row,
  // the legal links, and the floating navigation's last button.
  useEffect(() => {
    const notice = noticeRef.current;
    if (!showNotice || !notice) return;
    const root = document.documentElement;
    const write = () =>
      root.style.setProperty(
        "--cookie-notice-height",
        `${notice.offsetHeight}px`,
      );
    write();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(write);
    observer?.observe(notice);
    return () => {
      observer?.disconnect();
      root.style.removeProperty("--cookie-notice-height");
    };
  }, [showNotice]);

  const handleAccept = () => {
    try {
      localStorage.setItem("cookie-notice-acknowledged", "true");
    } catch (error) {
      // If localStorage is unavailable, continue anyway - the notice will just show again on reload
      console.warn("Unable to save cookie acknowledgment:", error);
    }
    setShowNotice(false);
  };

  if (!showNotice || !host) return null;

  return createPortal(
    <div
      ref={noticeRef}
      role="region"
      aria-label="Cookies on claret.tech"
      data-nosnippet=""
      className="fixed bottom-0 left-0 right-0 z-50 px-4 md:px-16 py-4 bg-gray-900/95 backdrop-blur-xs border-t border-gray-800 shadow-lg animate-slide-up"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex-1 text-center sm:text-left">
            <p className="text-gray-300 text-sm">
              <span className="font-semibold text-white">
                🧬 Cookie Selection:
              </span>{" "}
              Only the essential survive: theme genes and performance
              adaptations. We use privacy-focused analytics (Vercel) to
              understand site performance. No invasive tracking, no third-party
              advertising. View our{" "}
              <button
                {...legalTextsIntent}
                onClick={openPrivacyModal}
                className="text-primary-purple hover:text-primary-pink underline transition-colors font-medium"
                aria-label="Open Privacy Policy"
              >
                Privacy Policy
              </button>{" "}
              and{" "}
              <button
                {...legalTextsIntent}
                onClick={openTermsModal}
                className="text-primary-purple hover:text-primary-pink underline transition-colors font-medium"
                aria-label="Open Terms of Service"
              >
                Terms of Service
              </button>{" "}
              (also available in the footer).
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleAccept}
              className="px-6 py-2 bg-primary-purple hover:bg-primary-pink text-white font-medium rounded-lg transition-colors text-sm"
              // Its visible text first (WCAG 2.5.3, label in name).
              aria-label="Got it! Accept cookie notice"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>,
    host,
  );
}
