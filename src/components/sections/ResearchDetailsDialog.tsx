"use client";

// Deep per-icon imports: a lazily loaded component (pdf-viewer.tsx).
import BookOpen from "lucide-react/dist/esm/icons/book-open";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import Rocket from "lucide-react/dist/esm/icons/rocket";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { researchSection } from "@/data/sections/research";
import { researchDetails } from "@/data/sections/research-details";
import {
  AccentChips,
  DetailsDialog,
  DetailsProse,
  DetailsSection,
} from "@/components/ui/details-dialog";
import { accentStyle } from "@/components/ui/accent-text";
import type { DetailsStandInProps } from "@/components/ui/lazy-details";
import { pdfReaderIntent } from "@/lib/pdf-reader-preload";
import {
  isLocalPdf,
  pdfFileName,
  projectColor,
  iconKey,
  iconMap,
  statusConfig,
  visibleProjects,
} from "./research-shared";

/**
 * Which of the section's texts the dialog shows: a project's (index 0 is the
 * hero), or the research journey's.
 */
export type ResearchSubject =
  { kind: "project"; index: number } | { kind: "journey" };

/** The journey card's colour, amber. */
const JOURNEY_COLOR = "245, 158, 11";

export interface ResearchDetailsDialogProps extends DetailsStandInProps {
  subject: ResearchSubject;
  onOpenPDF: (url: string, title: string, fileName: string) => void;
}

/**
 * A research card's details, above the page, instead of the card growing
 * in place (round 27). A chunk of its own, with the section's long texts
 * (research-details.ts): neither is in the page's first JavaScript.
 */
export function ResearchDetailsDialog({
  subject,
  title,
  dialog,
  onOpenPDF,
}: ResearchDetailsDialogProps) {
  if (subject.kind === "journey") {
    return (
      <DetailsDialog
        title={title}
        icon={Rocket}
        accent={JOURNEY_COLOR}
        meta={<span>{researchSection.journeyBadge}</span>}
        onClose={dialog.onClose}
        returnFocus={dialog.returnFocus}
        restoreScroll={dialog.restoreScroll}
        testId="research-details"
      >
        <DetailsProse>{researchDetails.journeyDescription}</DetailsProse>
      </DetailsDialog>
    );
  }

  const project = visibleProjects[subject.index];
  // The hero shows its highlights, technologies and links on the page: its
  // dialog is the full description.
  const isHero = subject.index === 0;
  const color = projectColor(project);
  const status = statusConfig[project.status];
  const StatusIcon = status.icon;
  const linkClass =
    "inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:underline";

  return (
    <DetailsDialog
      title={title}
      icon={iconMap[iconKey(project)]}
      accent={color}
      meta={
        <>
          <span>{project.subtitle}</span>
          {project.year && <span>{project.year}</span>}
          <span
            className="accent-text inline-flex items-center gap-1"
            style={accentStyle(`rgb(${status.rgbColor})`)}
          >
            <StatusIcon aria-hidden="true" className="h-3.5 w-3.5" />
            {status.text}
          </span>
        </>
      }
      onClose={dialog.onClose}
      returnFocus={dialog.returnFocus}
      restoreScroll={dialog.restoreScroll}
      testId="research-details"
    >
      <DetailsProse>
        {researchDetails.descriptions[project.title] ??
          project.shortDescription}
      </DetailsProse>

      {!isHero && project.highlights && project.highlights.length > 0 && (
        <DetailsSection title="Key Contributions">
          <ul className="grid gap-2">
            {project.highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-2 text-sm">
                <Sparkles
                  aria-hidden="true"
                  className="mt-0.5 h-3 w-3 shrink-0 text-primary"
                />
                <span className="text-muted-foreground">{highlight}</span>
              </li>
            ))}
          </ul>
        </DetailsSection>
      )}

      {!isHero && project.tags && project.tags.length > 0 && (
        <DetailsSection title="Technologies & Methods">
          <AccentChips items={project.tags} accent={color} />
        </DetailsSection>
      )}

      {!isHero && project.links && project.links.length > 0 && (
        <DetailsSection title="Resources & Publications">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {project.links.map((link) =>
              isLocalPdf(link.url) ? (
                // The reader opens above this dialog, which stays.
                <button
                  key={link.url}
                  type="button"
                  className={linkClass}
                  {...pdfReaderIntent}
                  onClick={() =>
                    onOpenPDF(link.url, project.title, pdfFileName(link.url))
                  }
                >
                  <BookOpen aria-hidden="true" className="h-4 w-4" />
                  {link.name}
                </button>
              ) : (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  {link.name.includes("GitHub") ? (
                    <GitBranch aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  )}
                  {link.name}
                </a>
              ),
            )}
          </div>
        </DetailsSection>
      )}
    </DetailsDialog>
  );
}
