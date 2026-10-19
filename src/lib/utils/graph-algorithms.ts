import type { Publication } from "@/lib/api/fetch-publications";
import type { Paper } from "@/data/sections/papers";
import { isDisplayed, type ResearchProject } from "@/data/sections/research";

/**
 * The research map's graph: the owner's papers and projects as nodes, and
 * the reasons they belong together as edges. Pure: the dialog builds it
 * from the section data and src/data/research-map.json, and nothing here
 * reads the page.
 *
 * Every edge says why it exists. A curated relation (extends, companion,
 * precursor, part of) comes from the map's data file, which the owner
 * reviews; the others are derived from the data itself: the same code
 * repository, a co-author other than the owner who is not on every paper
 * of the group, the same venue, or a project that links the item.
 */

export type MapNodeKind = "publication" | "other-work" | "project";
export type RelationKind = "extends" | "companion" | "precursor" | "part-of";
export type DerivedKind =
  "same-repository" | "co-authors" | "same-venue" | "project-link";
export type ReasonKind = RelationKind | DerivedKind;

export const RELATION_KINDS: readonly RelationKind[] = [
  "extends",
  "companion",
  "precursor",
  "part-of",
];
export const DERIVED_KINDS: readonly DerivedKind[] = [
  "same-repository",
  "co-authors",
  "same-venue",
  "project-link",
];

/** Curated kinds that point from one item to another. */
const DIRECTED: ReadonlySet<ReasonKind> = new Set([
  "extends",
  "precursor",
  "part-of",
]);

export interface MapLane {
  id: string;
  label: string;
  color: string;
  repos: string[];
  members: string[];
  fallback: boolean;
}

export interface MapRelation {
  from: string;
  to: string;
  kind: RelationKind;
  note: string;
}

export interface MapConfig {
  owner: string;
  lanes: MapLane[];
  labels: Record<string, string>;
  relations: MapRelation[];
}

/** A PDF the site's reader opens, named as its card names it. */
export interface MapDocument {
  name: string;
  url: string;
}

export interface MapLink {
  label: string;
  url: string;
}

export interface MapNode {
  /** The id the page already uses as a deep link (#id). */
  id: string;
  kind: MapNodeKind;
  title: string;
  label: string;
  year: number;
  /** 1 to 12 when known. */
  month?: number;
  /** For work still running: the year it runs to (today). */
  until?: number;
  /** Work still running ("2020-Present"). */
  ongoing?: boolean;
  lane: string;
  venue?: string;
  /** A paper's state when it is not simply published. */
  status?: "to-appear" | "presented" | "preprint";
  /** A project's kind of work, such as "PhD Thesis". */
  subtitle?: string;
  coAuthors: string[];
  summary: string;
  documents: MapDocument[];
  links: MapLink[];
  /** Every URL the item names, to match a project's links against. */
  urls: string[];
  repos: string[];
}

export interface EdgeReason {
  kind: ReasonKind;
  origin: "curated" | "derived";
  /** The reason as a sentence: the curated note, or the evidence. */
  text: string;
  /** The note, or the evidence alone: a repository, a name, a venue. */
  detail: string;
  /** For a directed curated reason: where it points. */
  from?: string;
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  /** Points from source to target (a directed curated reason). */
  directed: boolean;
  reasons: EdgeReason[];
}

export interface ResearchGraph {
  lanes: MapLane[];
  nodes: MapNode[];
  edges: MapEdge[];
}

const isString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;
const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter(isString) : [];

/**
 * The map's data file, checked. Entries that cannot be used are left out
 * rather than thrown: the page keeps working, and the data file's own test
 * fails instead.
 */
export function parseMapConfig(raw: unknown): MapConfig {
  const data = (raw ?? {}) as Record<string, unknown>;
  const lanes = (Array.isArray(data.lanes) ? data.lanes : [])
    .map((lane) => lane as Record<string, unknown>)
    .filter((lane) => isString(lane.id) && isString(lane.label))
    .map((lane): MapLane => ({
      id: lane.id as string,
      label: lane.label as string,
      color: isString(lane.color) ? lane.color : "#64748b",
      repos: stringList(lane.repos),
      members: stringList(lane.members),
      fallback: lane.fallback === true,
    }));
  const labels: Record<string, string> = {};
  if (data.labels && typeof data.labels === "object") {
    for (const [id, label] of Object.entries(data.labels)) {
      if (isString(label)) labels[id] = label;
    }
  }
  const relations = (Array.isArray(data.relations) ? data.relations : [])
    .map((relation) => relation as Record<string, unknown>)
    .filter(
      (relation) =>
        isString(relation.from) &&
        isString(relation.to) &&
        relation.from !== relation.to &&
        RELATION_KINDS.includes(relation.kind as RelationKind),
    )
    .map((relation): MapRelation => ({
      from: relation.from as string,
      to: relation.to as string,
      kind: relation.kind as RelationKind,
      note: isString(relation.note) ? relation.note : "",
    }));
  return {
    owner: isString(data.owner) ? data.owner : "",
    lanes,
    labels,
    relations,
  };
}

/** "Genetic and Evolutionary Computation Conference (GECCO)" -> "GECCO". */
export function venueAcronym(venue: string | undefined): string | undefined {
  if (!venue) return undefined;
  const match = /\(([A-Z][A-Za-z]*)(?:\s[^)]*)?\)/.exec(venue);
  return match ? match[1].toUpperCase() : undefined;
}

/** "2026" or "07.2026" -> { year: 2026, month: 7 }. */
export function parsePaperDate(
  date: string,
): { year: number; month?: number } | null {
  const match = /^(?:(\d{1,2})\.)?(\d{4})$/.exec(date.trim());
  if (!match) return null;
  const month = match[1] ? Number(match[1]) : undefined;
  return {
    year: Number(match[2]),
    month: month && month >= 1 && month <= 12 ? month : undefined,
  };
}

/** A project's start: researchStart ("2026-07"), else its year ("2020-Present"). */
export function parseProjectSpan(
  project: Pick<ResearchProject, "researchStart" | "year">,
  now: number,
): { year: number; month?: number; until?: number; ongoing: boolean } | null {
  const start = /^(\d{4})-(\d{2})$/.exec(project.researchStart ?? "");
  const range = /^(\d{4})(?:\s*-\s*(\d{4}|Present))?$/i.exec(
    (project.year ?? "").trim(),
  );
  if (!start && !range) return null;
  const year = start ? Number(start[1]) : Number(range![1]);
  const month = start ? Number(start[2]) : undefined;
  const end = range?.[2];
  const ongoing = end !== undefined && /present/i.test(end);
  const until = !end
    ? undefined
    : ongoing
      ? now
      : Number(end) > year
        ? Number(end)
        : undefined;
  return { year, month, until, ongoing };
}

const isRepo = (url: string) =>
  /^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(url);
const normalizeUrl = (url: string) => url.replace(/\/+$/, "");
const isPdf = (url: string) => /^\/pdfs\/.+\.pdf$/i.test(url);

/** A shared URL, named for people: a repository, a document or a site. */
function linkName(url: string): string {
  if (isRepo(url)) return url.split("/").pop() ?? url;
  if (isPdf(url)) return documentKind(url);
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** What a PDF is, from its file name. */
function documentKind(url: string): string {
  const name = url.toLowerCase();
  if (name.includes("poster")) return "poster";
  if (name.includes("presentation") || name.includes("slides")) return "slides";
  if (name.includes("thesis")) return "thesis";
  return "paper";
}

function shortLabel(config: MapConfig, id: string, title: string): string {
  if (config.labels[id]) return config.labels[id];
  const words = title.split(/\s+/).slice(0, 3).join(" ");
  return words.length > 24 ? `${words.slice(0, 23)}...` : words;
}

function itemDocuments(item: {
  paperPdf?: string;
  posterPdf?: string;
  presentationPdf?: string;
}): MapDocument[] {
  const documents: MapDocument[] = [];
  // The chips' own words on the cards.
  if (item.paperPdf) documents.push({ name: "Read Paper", url: item.paperPdf });
  if (item.posterPdf) {
    documents.push({ name: "Read Poster", url: item.posterPdf });
  }
  if (item.presentationPdf) {
    documents.push({ name: "Read Presentation", url: item.presentationPdf });
  }
  return documents;
}

function publicationNode(pub: Publication, config: MapConfig): MapNode {
  const links: MapLink[] = [];
  if (pub.doi) links.push({ label: "DOI", url: `https://doi.org/${pub.doi}` });
  if (pub.arxivId) {
    links.push({ label: "arXiv", url: `https://arxiv.org/abs/${pub.arxivId}` });
  }
  if (pub.codeUrl) links.push({ label: "Code", url: pub.codeUrl });
  if (pub.videoUrl) links.push({ label: "Video", url: pub.videoUrl });
  const documents = itemDocuments(pub);
  const urls = [
    ...links.map((link) => link.url),
    ...documents.map((document) => document.url),
  ].map(normalizeUrl);
  return {
    id: pub.id,
    kind: "publication",
    title: pub.title,
    label: shortLabel(config, pub.id, pub.title),
    year: Number(pub.year),
    month: pub.month,
    lane: "",
    venue: pub.venue,
    status: pub.status,
    coAuthors: pub.authors.filter((author) => author !== config.owner),
    summary: pub.shortDescription ?? "",
    documents,
    links,
    urls,
    repos: pub.codeUrl ? [normalizeUrl(pub.codeUrl)] : [],
  };
}

function paperNode(paper: Paper, config: MapConfig): MapNode | null {
  const date = parsePaperDate(paper.date);
  if (!paper.anchorId || !date) return null;
  const links: MapLink[] = paper.footerLink
    .filter((link) => isString(link.url) && !isPdf(link.url))
    .map((link) => ({
      // A card may call its arXiv page "Paper", next to its "Read Paper".
      label: link.url.includes("arxiv.org/") ? "arXiv" : link.name,
      url: link.url,
    }));
  if (paper.arxivId && !links.some((link) => link.url.includes("arxiv.org"))) {
    links.push({
      label: "arXiv",
      url: `https://arxiv.org/abs/${paper.arxivId}`,
    });
  }
  if (paper.videoUrl) links.push({ label: "Video", url: paper.videoUrl });
  const documents = itemDocuments(paper);
  const urls = [
    ...links.map((link) => link.url),
    ...documents.map((document) => document.url),
  ].map(normalizeUrl);
  return {
    id: paper.anchorId,
    kind: "other-work",
    title: paper.title,
    label: shortLabel(config, paper.anchorId, paper.title),
    year: date.year,
    month: date.month,
    lane: "",
    status: paper.status,
    coAuthors: (paper.authors ?? []).filter(
      (author) => author !== config.owner,
    ),
    summary: paper.shortDescription ?? paper.subtitle,
    documents,
    links,
    urls,
    repos: links.map((link) => normalizeUrl(link.url)).filter(isRepo),
  };
}

function projectNode(
  project: ResearchProject,
  config: MapConfig,
  now: number,
): MapNode | null {
  const span = parseProjectSpan(project, now);
  if (!project.anchorId || !span) return null;
  const all = (project.links ?? []).filter((link) => isString(link.url));
  const documents: MapDocument[] = all
    .filter((link) => isPdf(link.url))
    .map((link) => ({ name: link.name, url: link.url }));
  const links: MapLink[] = all
    .filter((link) => !isPdf(link.url))
    .map((link) => ({ label: link.name, url: link.url }));
  return {
    id: project.anchorId,
    kind: "project",
    title: project.title,
    label: shortLabel(config, project.anchorId, project.title),
    year: span.year,
    month: span.month,
    until: span.until,
    ongoing: span.ongoing,
    lane: "",
    subtitle: project.subtitle,
    coAuthors: [],
    summary: project.shortDescription ?? "",
    documents,
    links,
    urls: all.map((link) => normalizeUrl(link.url)),
    repos: links.map((link) => normalizeUrl(link.url)).filter(isRepo),
  };
}

/** Earlier first: year, then month (unknown months first), then id. */
export function byTime(a: MapNode, b: MapNode): number {
  return (
    a.year - b.year ||
    (a.month ?? 0) - (b.month ?? 0) ||
    a.id.localeCompare(b.id)
  );
}

function assignLane(node: MapNode, lanes: MapLane[]): string {
  const member = lanes.find((lane) => lane.members.includes(node.id));
  if (member) return member.id;
  const byRepo = lanes.find((lane) =>
    lane.repos.some((repo) => node.repos.includes(normalizeUrl(repo))),
  );
  if (byRepo) return byRepo.id;
  return (
    (lanes.find((lane) => lane.fallback) ?? lanes[lanes.length - 1])?.id ?? ""
  );
}

const pairId = (a: string, b: string) => (a < b ? `${a}--${b}` : `${b}--${a}`);

/**
 * Members of a group joined one after the next, in time: a group of five
 * draws four links, not ten.
 */
function chain(nodes: MapNode[]): [MapNode, MapNode][] {
  const ordered = [...nodes].sort(byTime);
  const pairs: [MapNode, MapNode][] = [];
  for (let i = 1; i < ordered.length; i++) {
    pairs.push([ordered[i - 1], ordered[i]]);
  }
  return pairs;
}

/**
 * Co-authors who tell items apart. Within each group of items joined by
 * shared co-authors, someone on every item says nothing about which of them
 * belong together when others are on only some: on the owner's
 * neuroevolution papers, the two co-authors on all eight drop out and the
 * ones on some of them stay. A group with no such author, two items with
 * the same two co-authors say, keeps them all: they are what joins it.
 */
function distinctiveCoAuthors(items: MapNode[]): Map<string, MapNode[]> {
  const byAuthor = new Map<string, MapNode[]>();
  for (const item of items) {
    for (const author of item.coAuthors) {
      byAuthor.set(author, [...(byAuthor.get(author) ?? []), item]);
    }
  }
  // Groups: items joined by any shared co-author (union-find over ids).
  const parent = new Map<string, string>(
    items.map((item) => [item.id, item.id]),
  );
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    return root;
  };
  for (const group of byAuthor.values()) {
    for (let i = 1; i < group.length; i++) {
      parent.set(find(group[i].id), find(group[0].id));
    }
  }
  const groupSize = new Map<string, number>();
  for (const item of items) {
    const root = find(item.id);
    groupSize.set(root, (groupSize.get(root) ?? 0) + 1);
  }
  const shared = [...byAuthor].filter(([, group]) => group.length > 1);
  const onEvery = ([, group]: [string, MapNode[]]) =>
    group.length === groupSize.get(find(group[0].id));
  // The groups where someone is on only some of the items.
  const structured = new Set(
    shared
      .filter((entry) => !onEvery(entry))
      .map(([, group]) => find(group[0].id)),
  );
  return new Map(
    shared.filter(
      (entry) => !onEvery(entry) || !structured.has(find(entry[1][0].id)),
    ),
  );
}

/**
 * The graph for the map: nodes from the section data, lanes from the data
 * file, edges from the curated relations and the derived links.
 */
export function buildResearchGraph({
  publications,
  papers,
  projects,
  config,
  now,
}: {
  publications: Publication[];
  papers: Paper[];
  projects: ResearchProject[];
  config: MapConfig;
  now: number;
}): ResearchGraph {
  const nodes: MapNode[] = [];
  const seen = new Set<string>();
  const add = (node: MapNode | null) => {
    if (!node || seen.has(node.id) || !Number.isFinite(node.year)) return;
    seen.add(node.id);
    nodes.push(node);
  };
  for (const pub of publications) add(publicationNode(pub, config));
  for (const paper of papers) add(paperNode(paper, config));
  for (const project of projects.filter(isDisplayed)) {
    add(projectNode(project, config, now));
  }
  for (const node of nodes) node.lane = assignLane(node, config.lanes);

  const edges = new Map<string, MapEdge>();
  const addReason = (a: MapNode, b: MapNode, reason: EdgeReason) => {
    const id = pairId(a.id, b.id);
    const edge = edges.get(id) ?? {
      id,
      source: a.id,
      target: b.id,
      directed: false,
      reasons: [],
    };
    if (
      !edge.reasons.some(
        (r) => r.kind === reason.kind && r.text === reason.text,
      )
    ) {
      edge.reasons.push(reason);
    }
    if (reason.from && DIRECTED.has(reason.kind) && !edge.directed) {
      edge.directed = true;
      edge.source = reason.from;
      edge.target = reason.from === a.id ? b.id : a.id;
    }
    edges.set(id, edge);
  };
  const byId = new Map(nodes.map((node) => [node.id, node]));

  // Curated first, so their direction and kind lead.
  for (const relation of config.relations) {
    const from = byId.get(relation.from);
    const to = byId.get(relation.to);
    if (!from || !to) continue;
    addReason(from, to, {
      kind: relation.kind,
      origin: "curated",
      text: relation.note,
      detail: relation.note,
      from: DIRECTED.has(relation.kind) ? from.id : undefined,
    });
  }

  const items = nodes.filter((node) => node.kind !== "project");

  const byRepo = new Map<string, MapNode[]>();
  for (const item of items) {
    for (const repo of item.repos) {
      byRepo.set(repo, [...(byRepo.get(repo) ?? []), item]);
    }
  }
  for (const [repo, group] of byRepo) {
    const name = repo.split("/").pop() ?? repo;
    for (const [a, b] of chain(group)) {
      addReason(a, b, {
        kind: "same-repository",
        origin: "derived",
        text: `Same code repository: ${name}`,
        detail: name,
      });
    }
  }

  for (const [author, group] of distinctiveCoAuthors(items)) {
    for (const [a, b] of chain(group)) {
      addReason(a, b, {
        kind: "co-authors",
        origin: "derived",
        text: `Co-author: ${author}`,
        detail: author,
      });
    }
  }

  const byVenue = new Map<string, MapNode[]>();
  for (const item of items) {
    const acronym = venueAcronym(item.venue);
    if (acronym) byVenue.set(acronym, [...(byVenue.get(acronym) ?? []), item]);
  }
  for (const [acronym, group] of byVenue) {
    for (const [a, b] of chain(group)) {
      addReason(a, b, {
        kind: "same-venue",
        origin: "derived",
        text: `Same venue: ${acronym}`,
        detail: acronym,
      });
    }
  }

  for (const project of nodes.filter((node) => node.kind === "project")) {
    for (const item of items) {
      const shared = item.urls.filter((url) => project.urls.includes(url));
      if (shared.length === 0) continue;
      addReason(project, item, {
        kind: "project-link",
        origin: "derived",
        text: `Linked from the ${project.label} card: ${shared.map(linkName).join(", ")}`,
        detail: shared.map(linkName).join(", "),
      });
    }
  }

  return {
    lanes: config.lanes,
    nodes: nodes.sort(byTime),
    edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

/**
 * The graph with only the chosen lanes and link kinds. An edge keeps the
 * reasons of the chosen kinds and goes when none is left.
 */
export function filterGraph(
  graph: ResearchGraph,
  { lanes, kinds }: { lanes?: string[]; kinds?: ReasonKind[] },
): ResearchGraph {
  const laneSet = lanes ? new Set(lanes) : null;
  const kindSet = kinds ? new Set(kinds) : null;
  const nodes = graph.nodes.filter(
    (node) => !laneSet || laneSet.has(node.lane),
  );
  const kept = new Set(nodes.map((node) => node.id));
  const edges = graph.edges
    .filter((edge) => kept.has(edge.source) && kept.has(edge.target))
    .map((edge) => ({
      ...edge,
      reasons: edge.reasons.filter(
        (reason) => !kindSet || kindSet.has(reason.kind),
      ),
    }))
    .filter((edge) => edge.reasons.length > 0);
  return {
    lanes: graph.lanes.filter((lane) => !laneSet || laneSet.has(lane.id)),
    nodes,
    edges,
  };
}
