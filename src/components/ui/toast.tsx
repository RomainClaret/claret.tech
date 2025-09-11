"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTestMode } from "@/components/providers/test-mode-provider";

interface ToastProps {
  message: string;
  duration?: number;
  onClose?: () => void;
  type?: "info" | "warning" | "error" | "success";
}

export function Toast({
  message,
  duration = 8000,
  onClose,
  type = "info",
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { isTestMode } = useTestMode();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Call onClose immediately in test mode to prevent blocking
    if (isTestMode) {
      const timer = setTimeout(() => {
        onClose?.();
      }, 10); // Very quick delay to allow ARIA regions to be detected
      return () => clearTimeout(timer);
    }

    if (!isVisible) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        onClose?.();
      }, 300); // Allow fade-out animation to complete
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose, isVisible, isTestMode]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose?.();
    }, 300);
  };

  // Note: We still render in test mode to ensure ARIA live regions are available for accessibility tests
  // The component will auto-close immediately in test mode via the useEffect above

  if (!mounted) return null;

  const getTypeStyles = () => {
    switch (type) {
      case "warning":
        return "bg-yellow-900/90 border-yellow-600/50 text-yellow-100";
      case "error":
        return "bg-red-900/90 border-red-600/50 text-red-100";
      case "success":
        return "bg-green-900/90 border-green-600/50 text-green-100";
      default:
        return "bg-blue-900/90 border-blue-600/50 text-blue-100";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "warning":
        return "⚠️";
      case "error":
        return "❌";
      case "success":
        return "✅";
      default:
        return "ℹ️";
    }
  };

  const toastElement = (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`fixed top-4 left-4 z-[9999] max-w-sm rounded-lg border backdrop-blur-sm shadow-lg transition-all duration-300 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
      } ${getTypeStyles()}`}
      style={{
        pointerEvents: isTestMode ? "none" : isVisible ? "auto" : "none",
      }}
      data-testid="toast"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="text-lg flex-shrink-0 mt-0.5">{getIcon()}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-5 whitespace-pre-line">
              {message}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 ml-2 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Close notification"
          >
            <span className="text-lg">×</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(toastElement, document.body);
}

// Toast container for managing multiple toasts
interface ToastMessage {
  id: string;
  message: string;
  type?: "info" | "warning" | "error" | "success";
  duration?: number;
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handleToastEvent = (event: CustomEvent<ToastMessage>) => {
      // Guard against null/undefined detail
      if (!event.detail) {
        return;
      }

      const newToast = {
        ...event.detail,
        id:
          event.detail.id ||
          `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      setToasts((prev) => [...prev, newToast]);
    };

    window.addEventListener("showToast", handleToastEvent as EventListener);

    return () => {
      window.removeEventListener(
        "showToast",
        handleToastEvent as EventListener,
      );
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Note: We still render toasts in test mode to ensure ARIA live regions are available for accessibility tests

  return (
    <>
      {/* Persistent ARIA live region for announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="toast-live-region"
      >
        {toasts.length > 0 && toasts[toasts.length - 1].message}
      </div>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </>
  );
}

// Helper function to show toasts
export function showToast(
  message: string,
  type: "info" | "warning" | "error" | "success" = "info",
  duration?: number,
) {
  // Check if we're in Playwright E2E test mode (but allow unit tests)
  if (typeof window !== "undefined" && window.location?.search) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const isPlaywright = urlParams.get("playwright") === "true";

      // Only block in Playwright E2E tests, not unit tests
      if (isPlaywright) {
        return;
      }
    } catch {
      // If window.location is not available (unit tests), continue normally
    }
  }

  const event = new CustomEvent("showToast", {
    detail: {
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message,
      type,
      duration,
    },
  });
  window.dispatchEvent(event);
}
