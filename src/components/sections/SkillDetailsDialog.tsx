"use client";

import type { ComponentType, CSSProperties } from "react";
import type { skillsSection } from "@/data/portfolio";
import { skillsDetails } from "@/data/sections/skills-details";
import {
  AccentChips,
  DetailsDialog,
  DetailsProse,
  DetailsSection,
} from "@/components/ui/details-dialog";
import type { DetailsStandInProps } from "@/components/ui/lazy-details";

type CoreActivity = (typeof skillsSection.coreActivities)[number];
type PhilosophyPanel =
  (typeof skillsSection.researchInterests)[keyof typeof skillsSection.researchInterests];

/** The card whose details are open, as the section resolves it. */
export type OpenSkill =
  | { kind: "activity"; activity: CoreActivity }
  | { kind: "philosophy"; panel: PhilosophyPanel };

export interface SkillDetailsDialogProps extends DetailsStandInProps {
  open: OpenSkill;
  /** The card's icon, drawn in `accent`, its colour as "r, g, b". */
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  accent: string;
  /** The part of the section the card is in, under the title. */
  context: string;
}

/**
 * A Skills card's details, above the page, instead of the card growing in
 * place (round 27): a core activity's story and its technologies, or a
 * philosophy card's framing and all its points, of which the card shows the
 * first. A chunk of its own, with the section's long texts
 * (skills-details.ts): neither is in the page's first JavaScript.
 */
export function SkillDetailsDialog({
  open,
  title,
  icon,
  accent,
  context,
  dialog,
}: SkillDetailsDialogProps) {
  return (
    <DetailsDialog
      title={title}
      icon={icon}
      accent={accent}
      meta={<span>{context}</span>}
      lead={open.kind === "philosophy" ? open.panel.description : undefined}
      onClose={dialog.onClose}
      returnFocus={dialog.returnFocus}
      restoreScroll={dialog.restoreScroll}
      testId="skill-details"
    >
      {open.kind === "activity" ? (
        <>
          <DetailsProse>
            {skillsDetails.activities[title] ?? open.activity.description}
          </DetailsProse>
          <DetailsSection title="Technologies & Methods">
            <AccentChips
              items={open.activity.technologies.map((tech) => tech.name)}
              accent={accent}
            />
          </DetailsSection>
        </>
      ) : (
        <>
          {skillsDetails.philosophy[title] && (
            <DetailsProse>{skillsDetails.philosophy[title]}</DetailsProse>
          )}
          <ul className="grid gap-3">
            {open.panel.bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex items-start gap-3 text-sm leading-relaxed sm:text-base"
              >
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: `rgb(${accent})` }}
                />
                <span className="text-muted-foreground">{bullet}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </DetailsDialog>
  );
}
