"use client";

// Deep per-icon imports, as in the PDF reader: the section's tests mock the
// lucide barrel with the icons the cards use, and this stays ready to load
// as a chunk of its own.
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Globe from "lucide-react/dist/esm/icons/globe";
import Star from "lucide-react/dist/esm/icons/star";
import GitFork from "lucide-react/dist/esm/icons/git-fork";
import type { Repository } from "@/contexts/projects-context";
import {
  AccentChips,
  DetailsDialog,
  DetailsSection,
  primaryActionClass,
  secondaryActionClass,
} from "@/components/ui/details-dialog";
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
 * One repository's details, above the page (DetailsDialog).
 *
 * The cards opened a panel inside their grid item: the card grew with blank
 * space, the panel painted under the next row's card (each grid item is a
 * stacking context), and its links' clicks reached that card.
 */
export function ProjectDetailsDialog({
  project,
  onClose,
  returnFocus,
}: ProjectDetailsDialogProps) {
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

  return (
    <DetailsDialog
      title={project.name}
      icon={LanguageIcon}
      accent={color}
      meta={
        <>
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
        </>
      }
      lead={project.description || "No detailed description available."}
      onClose={onClose}
      returnFocus={returnFocus}
      testId="project-details"
      footer={
        <>
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className={primaryActionClass}
          >
            <ExternalLink aria-hidden="true" className="h-4 w-4" />
            View on GitHub
          </a>
          {homepage && (
            <a
              href={homepage}
              target="_blank"
              rel="noopener noreferrer"
              className={secondaryActionClass}
            >
              <Globe aria-hidden="true" className="h-4 w-4" />
              Live Demo
            </a>
          )}
        </>
      }
    >
      {topics && topics.length > 0 && (
        <DetailsSection title="Topics">
          <AccentChips items={topics} accent={color} outsideColor />
        </DetailsSection>
      )}

      {languages.length > 0 ? (
        <DetailsSection title="Languages">
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
        </DetailsSection>
      ) : (
        project.primaryLanguage && (
          <DetailsSection title="Primary language">
            <p className="inline-flex items-center gap-1.5 text-sm">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: project.primaryLanguage.color || "#8b949e",
                }}
              />
              {project.primaryLanguage.name}
            </p>
          </DetailsSection>
        )
      )}

      {(created || pushed) && (
        <DetailsSection title="Activity">
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
        </DetailsSection>
      )}
    </DetailsDialog>
  );
}
