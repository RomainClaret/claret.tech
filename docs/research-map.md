# The research map

`research` in the terminal opens a map of the papers and research projects on
the site: one row per line of work, time running left to right, and lines
between items that say why they belong together. Escape, its close button or
the backdrop closes it (there is no `research close`: the terminal steps
aside while the map is open); `man research` lists its keys.

It is built from the data the sections already show. Nothing on the map is
typed twice, except the few things below that only the map needs.

| What                                           | Where it comes from                                                                           |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Papers                                         | `src/lib/api/static-publications.json` (`STATIC_PUBLICATIONS`), the Papers section's own list |
| Other Work                                     | `papersSection.papersCards` in `src/data/sections/papers.ts` (those with an `anchorId`)       |
| Research projects                              | `researchSection.projects` in `src/data/sections/research.ts`, displayed ones only            |
| Lines of work, short labels, curated relations | `src/data/research-map.json`                                                                  |

Each item is keyed by the deep link its card already has (`#claret2026emr`,
`#geenns`), and **Show on page** follows it. A card with `display: false`
stays off the map, as it stays off the page.

## Adding a paper or a project

Add it to its section as `docs/publications.md` describes: it is on the map
from then on. Two optional touches in `src/data/research-map.json`:

- **`labels`**: its short label on the map (`"claret2026emr": "EMR-HyperNEAT"`).
  Without one the map uses the first three words of its title.
- **`lanes`**: which line of work it belongs to. An item goes to the lane that
  lists its id in `members`, else to the lane whose `repos` has its code
  repository, else to the lane marked `fallback`.

`src/lib/utils/research-map-data.test.ts` checks the file: every id it names
must be on the map, relations must not loop, lane colours must reach 3:1
against both themes, and no em or en dashes.

## Links

Derived from the data, each with its evidence:

| Kind       | When                                                                                                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Same code  | two items name the same GitHub repository                                                                                                                                                                                                        |
| Card links | a research card links an item's PDF, code or page                                                                                                                                                                                                |
| Co-authors | two items share a co-author, other than the owner and other than one on every item of the group when someone else is on only some of them (on the neuroevolution papers, the supervisors on all eight say nothing; Stoffel, Gygax and Felber do) |
| Same venue | the same acronym in the venue's parentheses (GECCO, ALIFE)                                                                                                                                                                                       |

A group (one repository, one co-author) is drawn as a chain in time, not as
every pair, and a pair gets one line whatever its number of reasons.

**Curated relations**, in `relations`, are written by hand:
`{ "from": "...", "to": "...", "kind": "...", "note": "..." }`. The note shows
in the item's details. Directions:

| kind        | meaning                | details read                |
| ----------- | ---------------------- | --------------------------- |
| `extends`   | `to` builds on `from`  | "Builds on" / "Built on by" |
| `precursor` | `from` led to `to`     | "Grew out of" / "Led to"    |
| `part-of`   | `from` is part of `to` | "Part of" / "Includes"      |
| `companion` | no direction           | "Companion work"            |

The map draws an arrowhead at `to`. Curated lines are heavier than derived
ones; derived kinds differ by their dashes, never by colour alone.

A relation is a claim about the research, so it goes in only once Romain has
reviewed it. The 20 in the file (2026-10-15): the five papers the thesis is
based on, each with its chapter (the thesis's List of Publications), what
the site's own text states, and four links it does not state (Bio palettes
and the breeder, the TPE study under Partitioned and Early stopping,
Blockchain and Overclouds). A note shows on both items' panels, so it names
its subject: a card's "This thesis" becomes the project's name.

## Code

| File                                                    | Does                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/lib/utils/graph-algorithms.ts`                     | builds the graph: nodes, lanes, links and their reasons                                |
| `src/lib/utils/research-map-layout.ts`                  | places it: lanes, years, labels, curves, arrow keys                                    |
| `src/lib/hooks/useResearchMap.ts`                       | the map's state: filters, view, open item, Tab stop                                    |
| `src/components/research-map/`                          | the dialog, the drawing, the list, the details                                         |
| `src/components/research-map/research-map-renderer.tsx` | opens it on the terminal's event, in the page bundle; the rest loads on the first open |

The terminal steps aside while the map is open (`aside` in the terminal
context): it sits above every dialog and would cover the map.
`tests/e2e/research-map.spec.ts` runs in CI's terminal job.
