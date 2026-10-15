"use client";

import { forwardRef, useId, type CSSProperties } from "react";
import BookOpen from "lucide-react/dist/esm/icons/book-open";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import { cn } from "@/lib/utils";
import {
  byTime,
  type MapDocument,
  type MapLane,
  type MapNode,
  type ReasonKind,
  type ResearchGraph,
} from "@/lib/utils/graph-algorithms";
import {
  LINK_ORDER,
  connectionHeading,
  dateText,
  kindName,
  listNames,
  statusName,
} from "./map-styles";

export interface ConnectionGroup {
  key: string;
  kind: ReasonKind;
  heading: string;
  entries: { other: MapNode; detail: string }[];
}

/**
 * An item's links in the shown graph, grouped by kind and, for the kinds
 * that point, by which end the item is on. Curated groups first.
 */
export function connectionsOf(
  id: string,
  graph: ResearchGraph,
  items: ReadonlyMap<string, MapNode>,
): ConnectionGroup[] {
  const groups = new Map<string, ConnectionGroup>();
  for (const edge of graph.edges) {
    if (edge.source !== id && edge.target !== id) continue;
    const other = items.get(edge.source === id ? edge.target : edge.source);
    if (!other) continue;
    for (const reason of edge.reasons) {
      const heading = connectionHeading(
        reason.kind,
        reason.from === undefined || reason.from === id,
      );
      const key = `${reason.kind}:${heading}`;
      const group = groups.get(key) ?? {
        key,
        kind: reason.kind,
        heading,
        entries: [],
      };
      group.entries.push({ other, detail: reason.detail });
      groups.set(key, group);
    }
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      entries: group.entries.sort((a, b) => byTime(a.other, b.other)),
    }))
    .sort(
      (a, b) =>
        LINK_ORDER.indexOf(a.kind) - LINK_ORDER.indexOf(b.kind) ||
        a.heading.localeCompare(b.heading),
    );
}

interface MapDetailsProps {
  node: MapNode | null;
  lane?: MapLane;
  connections: ConnectionGroup[];
  onSelect: (id: string) => void;
  onOpenDocument: (document: MapDocument, node: MapNode) => void;
  onShowOnPage: (id: string) => void;
  /** 3 beside the map; 4 inside the list, under a lane's heading. */
  level?: 3 | 4;
}

const action = cn(
  "inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
);

/**
 * What an item is and how it connects: its date and venue, co-authors and
 * summary; the PDFs the site's reader opens, its outside links, and the way
 * back to its card on the page; then its links, grouped by why they exist.
 * The title takes focus (tabIndex -1) when another item is chosen from the
 * connections, so a screen reader says where the reader went.
 */
export const MapDetails = forwardRef<HTMLHeadingElement, MapDetailsProps>(
  function MapDetails(
    {
      node,
      lane,
      connections,
      onSelect,
      onOpenDocument,
      onShowOnPage,
      level = 3,
    },
    headingRef,
  ) {
    const titleId = useId();
    if (!node) {
      return (
        <p className="text-sm text-muted-foreground">
          Choose an item on the map to see what it is and how it connects to the
          rest.
        </p>
      );
    }
    const Title = level === 3 ? "h3" : "h4";
    const Group = level === 3 ? "h4" : "h5";
    const status = statusName(node);
    return (
      <section aria-labelledby={titleId} className="space-y-4">
        <div>
          <p
            className="lane-ink flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground"
            style={{ "--lane": lane?.color } as CSSProperties}
          >
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full bg-[var(--ink)]"
            />
            <span>{lane?.label}</span>
            <span aria-hidden="true">·</span>
            <span>
              {kindName(node)}, {dateText(node)}
            </span>
            {status && (
              <span className="rounded-full border border-border px-2 py-0.5 text-foreground">
                {status}
              </span>
            )}
          </p>
          <Title
            ref={headingRef}
            id={titleId}
            tabIndex={-1}
            className="mt-2 break-words text-base font-semibold leading-snug outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {node.title}
          </Title>
          {node.venue && (
            <p className="mt-1 text-sm text-muted-foreground">{node.venue}</p>
          )}
          {node.coAuthors.length > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              With {listNames(node.coAuthors)}
            </p>
          )}
        </div>

        {node.summary && (
          <p className="text-sm leading-relaxed">{node.summary}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {node.documents.map((document) => (
            <button
              key={document.url}
              type="button"
              onClick={() => onOpenDocument(document, node)}
              className={action}
            >
              <BookOpen aria-hidden="true" className="h-4 w-4" />
              {document.name}
            </button>
          ))}
          {node.links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={action}
            >
              {link.label}
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ))}
          <button
            type="button"
            onClick={() => onShowOnPage(node.id)}
            className={action}
          >
            <MapPin aria-hidden="true" className="h-4 w-4" />
            Show on page
          </button>
        </div>

        <div className="space-y-3">
          {connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No links to other items with the links shown.
            </p>
          ) : (
            connections.map((group) => (
              <div key={group.key}>
                <Group className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.heading}
                </Group>
                <ul className="mt-1 space-y-1">
                  {group.entries.map(({ other, detail }) => (
                    <li key={other.id} className="text-sm">
                      <button
                        type="button"
                        onClick={() => onSelect(other.id)}
                        className="rounded font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {other.label}
                      </button>
                      <span className="text-muted-foreground">
                        {" "}
                        ({other.year}){detail ? `: ${detail}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>
    );
  },
);
