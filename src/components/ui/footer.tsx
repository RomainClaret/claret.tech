"use client";

import { footerNote, socialMediaLinks } from "@/data/portfolio";
import { useSyncExternalStore } from "react";
import {
  GitHubIcon,
  LinkedInIcon,
  MediumIcon,
  StackOverflowIcon,
  InstagramIcon,
  OrcidIcon,
  RedditIcon,
} from "@/components/icons";
import { useLegalModals } from "@/components/ui/legal-modals-provider";
import { legalTextsIntent } from "@/components/legal/load-legal-texts";

const subscribeNever = () => () => {};

export function Footer() {
  // The year the page was built, which is what its HTML says: the page is
  // generated once, at build time, and must hydrate with the same text.
  // Corrected once it runs, so a page built in December says the new year
  // in January.
  const currentYear = useSyncExternalStore(
    subscribeNever,
    () => new Date().getFullYear(),
    () => Number(process.env.BUILD_YEAR || new Date().getFullYear()),
  );
  // The deployed commit's day, set by the build (next.config.mjs), so the
  // HTML has it: no request on each visit, and right without scripts.
  const lastUpdate = process.env.BUILD_DATE;
  const { openPrivacyModal, openTermsModal, openLicenseModal } =
    useLegalModals();

  return (
    <footer className="bg-muted/50 border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Social Links */}
          {socialMediaLinks.display && (
            <div className="flex flex-wrap justify-center gap-3 sm:gap-6 mb-8">
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
              Built by one stubborn human and a very patient machine
            </p>
            <p className="text-sm text-muted-foreground">
              <span>
                © {currentYear} • Evolving under{" "}
                <button
                  type="button"
                  role="button"
                  aria-label="View the GNU GPLv3 or later license"
                  {...legalTextsIntent}
                  onClick={openLicenseModal}
                  className="text-primary hover:underline"
                  suppressHydrationWarning
                >
                  GNU GPLv3 or later
                </button>{" "}
                • Updated <span>{lastUpdate}</span> • Hosted on{" "}
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
                {...legalTextsIntent}
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
                {...legalTextsIntent}
                onClick={openTermsModal}
                className="text-primary hover:underline"
                suppressHydrationWarning
              >
                Terms of Service
              </button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
