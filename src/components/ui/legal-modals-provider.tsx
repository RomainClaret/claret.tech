"use client";

import { createContext, useContext, useState, ReactNode, useMemo } from "react";
import { LegalModal } from "@/components/ui/legal-modal";
import { PrivacyContent } from "@/components/legal/privacy-content";
import { TermsContent } from "@/components/legal/terms-content";
import { LicenseContent } from "@/components/legal/license-content";

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
        title="MIT License"
      >
        <LicenseContent />
      </LegalModal>
    </LegalModalsContext.Provider>
  );
}
