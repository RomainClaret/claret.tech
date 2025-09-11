"use client";

import { useState, useEffect } from "react";
import { useLegalModals } from "@/components/ui/legal-modals-provider";

export default function CookieNotice() {
  const [showNotice, setShowNotice] = useState(false);
  const { openPrivacyModal, openTermsModal } = useLegalModals();

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

  const handleAccept = () => {
    try {
      localStorage.setItem("cookie-notice-acknowledged", "true");
    } catch (error) {
      // If localStorage is unavailable, continue anyway - the notice will just show again on reload
      console.warn("Unable to save cookie acknowledgment:", error);
    }
    setShowNotice(false);
  };

  if (!showNotice) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 md:px-16 py-4 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 shadow-lg animate-slide-up">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex-1 text-center sm:text-left">
            <p className="text-gray-300 text-sm">
              <span className="font-semibold text-white">
                🧬 Cookie Selection:
              </span>{" "}
              Only the essential survive—theme genes and performance
              adaptations. We use privacy-focused analytics (Vercel) to
              understand site performance. No invasive tracking, no third-party
              advertising. View our{" "}
              <button
                onClick={openPrivacyModal}
                className="text-primary-purple hover:text-primary-pink underline transition-colors font-medium"
                aria-label="Open Privacy Policy"
              >
                Privacy Policy
              </button>{" "}
              and{" "}
              <button
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
              aria-label="Accept cookie notice"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
