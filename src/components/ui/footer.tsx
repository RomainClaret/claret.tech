"use client";

import { footerNote, socialMediaLinks } from "@/data/portfolio";
import { FadeIn } from "@/components/ui/animated";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { useEffect, useState } from "react";
import {
  GitHubIcon,
  LinkedInIcon,
  TwitterIcon,
  MediumIcon,
  StackOverflowIcon,
  InstagramIcon,
  OrcidIcon,
  RedditIcon,
} from "@/components/icons";
import { useLegalModals } from "@/components/ui/legal-modals-provider";
import { logError } from "@/lib/utils/dev-logger";

export function Footer() {
  const shouldReduceAnimations = useShouldReduceAnimations();
  const currentYear = new Date().getFullYear();
  const [lastCommitDate, setLastCommitDate] = useState<string>(
    footerNote.update,
  );
  const [isLoading, setIsLoading] = useState(true);
  const { openPrivacyModal, openTermsModal, openLicenseModal } =
    useLegalModals();

  useEffect(() => {
    // Fetch the last commit date from the API
    fetch("/api/last-commit")
      .then((res) => res.json())
      .then((data) => {
        if (data.lastCommitDate && !data.error) {
          setLastCommitDate(data.lastCommitDate);
        }
      })
      .catch((error) => {
        logError(error, "Footer.fetchLastCommitDate");
        // Keep the fallback date from footerNote
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <footer className="bg-muted/50 border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <FadeIn className="max-w-6xl mx-auto">
          {/* Social Links */}
          {socialMediaLinks.display && (
            <div className="flex justify-center gap-6 mb-8">
              {socialMediaLinks.github && (
                <a
                  href={socialMediaLinks.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground transition-colors hover:!text-[#333] dark:hover:!text-white"
                  aria-label="GitHub"
                >
                  <GitHubIcon size={28} />
                </a>
              )}
              {socialMediaLinks.linkedin && (
                <a
                  href={socialMediaLinks.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground transition-colors hover:!text-[#0077B5]"
                  aria-label="LinkedIn"
                >
                  <LinkedInIcon size={28} />
                </a>
              )}
              {socialMediaLinks.twitter && (
                <a
                  href={socialMediaLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground transition-colors hover:!text-[#1DA1F2]"
                  aria-label="Twitter"
                >
                  <TwitterIcon size={28} />
                </a>
              )}
              {socialMediaLinks.medium && (
                <a
                  href={socialMediaLinks.medium}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground transition-colors hover:!text-[#00AB6C]"
                  aria-label="Medium"
                >
                  <MediumIcon size={28} />
                </a>
              )}
              {socialMediaLinks.stackoverflow && (
                <a
                  href={socialMediaLinks.stackoverflow}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground transition-colors hover:!text-[#F48024]"
                  aria-label="Stack Overflow"
                >
                  <StackOverflowIcon size={28} />
                </a>
              )}
              {socialMediaLinks.instagram && (
                <a
                  href={socialMediaLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground transition-colors hover:!text-[#E4405F]"
                  aria-label="Instagram"
                >
                  <InstagramIcon size={28} />
                </a>
              )}
              {socialMediaLinks.orcid && (
                <a
                  href={socialMediaLinks.orcid}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground transition-colors hover:!text-[#A6CE39]"
                  aria-label="ORCID"
                >
                  <OrcidIcon size={28} />
                </a>
              )}
              {socialMediaLinks.reddit && (
                <a
                  href={socialMediaLinks.reddit}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground transition-colors hover:!text-[#FF4500]"
                  aria-label="Reddit"
                >
                  <RedditIcon size={28} />
                </a>
              )}
            </div>
          )}

          {/* Footer Text */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Ultrathinking with AI • 50% human creativity - 50% machine
              precision
            </p>
            <p className="text-sm text-muted-foreground">
              <span>
                © {currentYear} • Evolving under{" "}
                <button
                  type="button"
                  role="button"
                  aria-label="View MIT License"
                  onClick={openLicenseModal}
                  className="text-primary hover:underline"
                  suppressHydrationWarning
                >
                  MIT License
                </button>{" "}
                • Updated{" "}
                <span
                  className={
                    isLoading && !shouldReduceAnimations ? "animate-pulse" : ""
                  }
                >
                  {lastCommitDate}
                </span>{" "}
                • Hosted on{" "}
                <a
                  href={footerNote.hosturl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {footerNote.hostname}
                </a>
              </span>
            </p>
            <div
              className="text-sm text-muted-foreground"
              suppressHydrationWarning
              data-no-prefetch="true"
            >
              <button
                type="button"
                role="button"
                aria-label="View Privacy Policy"
                onClick={openPrivacyModal}
                className="text-primary hover:underline"
                suppressHydrationWarning
              >
                Privacy Policy
              </button>
              <span className="mx-1">•</span>
              <button
                type="button"
                role="button"
                aria-label="View Terms of Service"
                onClick={openTermsModal}
                className="text-primary hover:underline"
                suppressHydrationWarning
              >
                Terms of Service
              </button>
            </div>
          </div>
        </FadeIn>
      </div>
    </footer>
  );
}
