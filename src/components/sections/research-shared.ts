import {
  Beaker,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Ear,
  Scaling,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { isDisplayed, researchSection } from "@/data/sections/research";

/**
 * What the Research section's cards and their details dialog share: the
 * dialog loads as a chunk of its own (ResearchDetailsDialog.tsx), so it
 * cannot import the section, whose cards it details.
 */

export type ResearchProject = (typeof researchSection.projects)[number];

// Hidden cards are dropped once, here, so the hero, the grid, the stats, the
// deep links and the dialog all index the same list.
export const visibleProjects = researchSection.projects.filter(isDisplayed);

export const statusConfig = {
  active: {
    icon: Zap,
    text: "Active Research",
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-500/20",
    borderColor: "border-green-500/30",
    glowColor: "shadow-green-500/25",
    rgbColor: "34, 197, 94",
  },
  ongoing: {
    icon: Clock,
    text: "Ongoing",
    color: "text-yellow-700 dark:text-yellow-400",
    bgColor: "bg-yellow-500/20",
    borderColor: "border-yellow-500/30",
    glowColor: "shadow-yellow-500/25",
    rgbColor: "250, 204, 21",
  },
  completed: {
    icon: CheckCircle2,
    text: "Completed",
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-500/20",
    borderColor: "border-blue-500/30",
    glowColor: "shadow-blue-500/25",
    rgbColor: "59, 130, 246",
  },
};

// The icons the research data names.
export const iconMap = {
  Brain: Brain,
  Bot: Bot,
  Shield: Shield,
  Ear: Ear,
  Beaker: Beaker,
  Zap: Zap,
  Sparkles: Sparkles,
  Scaling: Scaling,
};

/**
 * A project's icon's name in iconMap: its own, or the beaker. Rendered as
 * `iconMap[iconKey(project)]`, a lookup: a component returned by a call
 * during render reads as one created there (react-hooks/static-components).
 */
export const iconKey = (project: ResearchProject): keyof typeof iconMap =>
  project.icon && project.icon in iconMap
    ? (project.icon as keyof typeof iconMap)
    : "Beaker";

/** A project's colour, as "r, g, b". */
export const projectColor = (project: ResearchProject) =>
  project.color || "139, 92, 246";

/**
 * A locally hosted PDF, which opens in the in-app reader rather than a new tab.
 *
 * Same predicate Papers uses for the same decision, so GitHub and journal
 * links keep behaving like links.
 */
export const isLocalPdf = (url: string) =>
  url.startsWith("/") && url.endsWith(".pdf");

export const pdfFileName = (url: string) =>
  url.split("/").pop() || "document.pdf";
