"use client";

import { useId } from "react";
import { createPortal } from "react-dom";
// Deep per-icon imports, as in the PDF reader: the section's tests mock the
// lucide barrel with the icons the cards use, and this stays ready to load
// as a chunk of its own.
import X from "lucide-react/dist/esm/icons/x";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Globe from "lucide-react/dist/esm/icons/globe";
import Star from "lucide-react/dist/esm/icons/star";
import GitFork from "lucide-react/dist/esm/icons/git-fork";
import type { Repository } from "@/contexts/projects-context";
import { useModalDialog } from "@/lib/hooks/useModalDialog";
import { useOverlayLock } from "@/lib/hooks/useMotionGate";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { cn } from "@/lib/utils";
import { accentStyle } from "@/components/ui/accent-text";
import { formatFileSizeDisplay } from "@/lib/utils/formatters";
import {
  defaultLanguageIcon,
  getProjectColor,
  languageIcons,
} from "@/lib/utils/language-colors";

interface ProjectDetailsDialogProps {
  project: Repository;
  onClose: () => void;
  /** The card's button: Safari never focuses a button it clicks. */
  returnFocus?: HTMLElement | null;
}

/**
 * A repository's homepage as a link, or null. http(s) is kept; an address
 * without a scheme gets https (as a relative link it would point at this
 * site); any other scheme (javascript:, data:) is dropped.
 */
export function homepageHref(value: string | null | undefined): string | null {
  const address = value?.trim();
  if (!address) return null;
  if (/^https?:\/\//i.test(address)) return address;
  if (/^[a-z][a-z0-9+.-]*:/i.test(address)) return null;
  return `https://${address}`;
}

/**
 * A date from the API, formatted in UTC so every visitor (and every test
 * machine) reads the same day. Null for the empty strings pinned
 * repositories carry.
 */
function formatDate(
  value: string,
  options: Intl.DateTimeFormatOptions,
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}

/**
 * Each language's share of the code, largest first. The API returns the 10
 * largest languages, so these are shares of those.
 */
function languageShares(project: Repository) {
  const edges = (project.languages?.edges ?? []).filter(
    (edge) => edge.size > 0,
  );
  const total = edges.reduce((sum, edge) => sum + edge.size, 0);
  return edges
    .map((edge) => ({
      name: edge.node.name,
      color: edge.node.color || "#8b949e",
      share: (edge.size / total) * 100,
    }))
    .sort((a, b) => b.share - a.share);
}

/**
 * One repository's details, above the page.
 *
 * The cards opened a panel inside their grid item: the card grew with blank
 * space, the panel painted under the next row's card (each grid item is a
 * stacking context), and its links' clicks reached that card. This renders
 * once for the whole section, at the end of <body> through a portal, above
 * the cookie notice (z-50) as PerformanceModal is, and below the terminal.
 * No framer: it must open when framer's chunk failed.
 */
export function ProjectDetailsDialog({
  project,
  onClose,
  returnFocus,
}: ProjectDetailsDialogProps) {
  useOverlayLock(true); // mounted only while open
  const dialogRef = useModalDialog<HTMLDivElement>(true, onClose, {
    lockScroll: true,
    returnFocus,
  });
  const reduce = useShouldReduceAnimations();
  const titleId = useId();
  const descriptionId = useId();

  const color = getProjectColor(
    project.primaryLanguage?.color,
    project.primaryLanguage?.name,
  );
  // A lookup, not a call: the icons are module-level components.
  const LanguageIcon =
    languageIcons[project.primaryLanguage?.name ?? ""] || defaultLanguageIcon;
  const topics = project.topics?.edges.map((edge) => edge.node.topic.name);
  const languages = languageShares(project);
  const created = formatDate(project.createdAt, {
    month: "short",
    year: "numeric",
  });
  const pushed = formatDate(project.pushedAt, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const homepage = homepageHref(project.homepageUrl);

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-end justify-center sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        data-testid="project-details-backdrop"
        // Not on the second click of a double click: the first one, on a
        // card, opened the dialog under the pointer.
        onClick={(event) => {
          if (event.detail <= 1) onClose();
        }}
        className={cn(
          "absolute inset-0",
          reduce ? "bg-background/90" : "bg-background/80 backdrop-blur-xs",
        )}
      />
      {/* The dialog is the one scroller, with the header and footer
          sticky: it holds focus as it opens, so the arrow keys scroll it. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={cn(
          "relative flex w-full flex-col overflow-y-auto overscroll-contain outline-hidden",
          "max-h-[85vh] supports-[height:100dvh]:max-h-[85dvh] sm:max-w-2xl",
          "rounded-t-2xl border border-border bg-background shadow-2xl sm:rounded-xl",
          !reduce && "motion-safe:animate-[slideUp_200ms_ease-out]",
        )}
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-border bg-background p-4 sm:p-6">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `rgba(${color}, 0.1)` }}
          >
            <LanguageIcon
              className="h-5 w-5"
              style={{ color: `rgb(${color})` }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="wrap-break-word text-lg font-bold sm:text-xl"
            >
              {project.name}
            </h2>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Star aria-hidden="true" className="h-4 w-4" />
                {project.stargazerCount}
                <span className="sr-only"> stars</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <GitFork aria-hidden="true" className="h-4 w-4" />
                {project.forkCount}
                <span className="sr-only"> forks</span>
              </span>
              <span>{formatFileSizeDisplay(project.diskUsage)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          <p
            id={descriptionId}
            className="whitespace-pre-line wrap-break-word text-sm leading-relaxed text-muted-foreground"
          >
            {project.description || "No detailed description available."}
          </p>

          {topics && topics.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Topics</h3>
              <ul className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <li
                    key={topic}
                    className="accent-text-any max-w-full wrap-break-word rounded-lg px-2.5 py-1 text-xs font-medium"
                    style={{
                      ...accentStyle(`rgb(${color})`),
                      backgroundColor: `rgba(${color}, 0.1)`,
                      border: `1px solid rgba(${color}, 0.3)`,
                    }}
                  >
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {languages.length > 0 ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Languages</h3>
              <div
                aria-hidden="true"
                className="flex h-2 overflow-hidden rounded-full bg-muted"
              >
                {languages.map((language) => (
                  <span
                    key={language.name}
                    style={{
                      width: `${language.share}%`,
                      backgroundColor: language.color,
                    }}
                  />
                ))}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {languages.map((language) => (
                  <li
                    key={language.name}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: language.color }}
                    />
                    {language.name}
                    <span className="text-muted-foreground">
                      {language.share.toFixed(1)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            project.primaryLanguage && (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Primary language</h3>
                <p className="inline-flex items-center gap-1.5 text-sm">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        project.primaryLanguage.color || "#8b949e",
                    }}
                  />
                  {project.primaryLanguage.name}
                </p>
              </div>
            )
          )}

          {(created || pushed) && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Activity</h3>
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {created && (
                  <div>
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="font-medium">
                      <time dateTime={project.createdAt}>{created}</time>
                    </dd>
                  </div>
                )}
                {pushed && (
                  <div>
                    <dt className="text-muted-foreground">Last push</dt>
                    <dd className="font-medium">
                      <time dateTime={project.pushedAt}>{pushed}</time>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-t border-border bg-background p-4 sm:flex-row sm:p-6">
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            View on GitHub
          </a>
          {homepage && (
            <a
              href={homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Globe aria-hidden="true" className="h-4 w-4" />
              Live Demo
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
