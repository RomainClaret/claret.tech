import { STATIC_PUBLICATIONS } from "@/lib/api/fetch-publications";
import { papersSection } from "@/data/sections/papers";
import { researchSection } from "@/data/sections/research";
import mapData from "@/data/research-map.json";
import {
  buildResearchGraph,
  parseMapConfig,
  type ResearchGraph,
} from "@/lib/utils/graph-algorithms";

/**
 * The research map's graph from the site's own data: the publications the
 * Papers section shows (/api/publications serves a mirror of the same
 * list), its Other Work cards, the displayed research cards, and
 * src/data/research-map.json.
 */
export function siteResearchGraph(
  now: number = new Date().getFullYear(),
): ResearchGraph {
  return buildResearchGraph({
    publications: STATIC_PUBLICATIONS,
    papers: papersSection.papersCards,
    projects: researchSection.projects,
    config: parseMapConfig(mapData),
    now,
  });
}
