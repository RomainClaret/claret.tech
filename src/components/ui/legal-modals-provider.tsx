"use client";

import { createContext, useContext, useState, ReactNode, useMemo } from "react";
import dynamic from "next/dynamic";
import { LegalModal } from "@/components/ui/legal-modal";
import {
  loadLegalTexts,
  loadedLegalTexts,
} from "@/components/legal/load-legal-texts";
import { withLoadFallback } from "@/lib/utils/load-fallback";
import { logError } from "@/lib/utils/dev-logger";
import { reloadPage } from "@/lib/utils/reload-page";

// Fetched on intent (load-legal-texts.ts); a modal only renders its text
// while open. The placeholder holds the text area's minimum height.
const textPlaceholder = () => <div className="min-h-[400px]" />;

// A failed load of the texts' chunk (a renamed chunk after a deploy, a CSP or
// a blocker). Logged in development; production stays silent, as dev-logger
// is on the client.
const reportLegalTextError = (error: unknown) =>
  logError(error, "Legal texts chunk");

// Shown in the modal when the text's chunk cannot be fetched. These
// providers sit in the root layout, so an error here would otherwise reach
// global-error and replace the whole site.
export function LegalTextUnavailable({
  retry,
  retrying,
}: {
  retry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="min-h-[400px] space-y-3 text-muted-foreground">
      <p>Could not load this text. Check your connection and try again.</p>
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="text-primary hover:underline disabled:opacity-60 disabled:no-underline"
        >
          {retrying ? "Trying again..." : "Try again"}
        </button>
        {/* Once a retry has failed too: a deploy may have replaced the
            texts' chunk since this page loaded. */}
        {!retrying && (
          <button
            type="button"
            onClick={reloadPage}
            className="text-primary hover:underline"
          >
            Reload page
          </button>
        )}
      </div>
    </div>
  );
}

const PrivacyContent = dynamic(
  withLoadFallback(
    () => loadLegalTexts().then((mod) => mod.PrivacyContent),
    LegalTextUnavailable,
    {
      onError: reportLegalTextError,
      peek: () => loadedLegalTexts()?.PrivacyContent,
    },
  ),
  { ssr: false, loading: textPlaceholder },
);
const TermsContent = dynamic(
  withLoadFallback(
    () => loadLegalTexts().then((mod) => mod.TermsContent),
    LegalTextUnavailable,
    {
      onError: reportLegalTextError,
      peek: () => loadedLegalTexts()?.TermsContent,
    },
  ),
  { ssr: false, loading: textPlaceholder },
);
const LicenseContent = dynamic(
  withLoadFallback(
    () => loadLegalTexts().then((mod) => mod.LicenseContent),
    LegalTextUnavailable,
    {
      onError: reportLegalTextError,
      peek: () => loadedLegalTexts()?.LicenseContent,
    },
  ),
  { ssr: false, loading: textPlaceholder },
);

interface LegalModalsContextType {
  openPrivacyModal: () => void;
  openTermsModal: () => void;
  openLicenseModal: () => void;
}

const LegalModalsContext = createContext<LegalModalsContextType | null>(null);

export function useLegalModals() {
  const context = useContext(LegalModalsContext);
  if (!context) {
    throw new Error("useLegalModals must be used within a LegalModalsProvider");
  }
  return context;
}

interface LegalModalsProviderProps {
  children: ReactNode;
}

export function LegalModalsProvider({ children }: LegalModalsProviderProps) {
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);

  const contextValue: LegalModalsContextType = useMemo(
    () => ({
      openPrivacyModal: () => setIsPrivacyModalOpen(true),
      openTermsModal: () => setIsTermsModalOpen(true),
      openLicenseModal: () => setIsLicenseModalOpen(true),
    }),
    [],
  );

  return (
    <LegalModalsContext.Provider value={contextValue}>
      {children}

      {/* Legal Modals - Rendered at provider level */}
      <LegalModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        title="Privacy Policy"
      >
        <PrivacyContent />
      </LegalModal>

      <LegalModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
        title="Terms of Service"
      >
        <TermsContent />
      </LegalModal>

      <LegalModal
        isOpen={isLicenseModalOpen}
        onClose={() => setIsLicenseModalOpen(false)}
        title="GNU GPLv3 or later"
      >
        <LicenseContent />
      </LegalModal>
    </LegalModalsContext.Provider>
  );
}
