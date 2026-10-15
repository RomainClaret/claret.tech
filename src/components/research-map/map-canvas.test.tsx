import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useMemo } from "react";
import { MapCanvas } from "./map-canvas";
import { useResearchMap } from "@/lib/hooks/useResearchMap";
import { layoutResearchGraph } from "@/lib/utils/research-map-layout";
import {
  buildResearchGraph,
  parseMapConfig,
  type ResearchGraph,
} from "@/lib/utils/graph-algorithms";
import { STATIC_PUBLICATIONS } from "@/lib/api/fetch-publications";
import { papersSection } from "@/data/sections/papers";
import { researchSection } from "@/data/sections/research";
import mapData from "@/data/research-map.json";

/** The map's drawing on the site's data, driven by the real state hook. */

const graph = buildResearchGraph({
  publications: STATIC_PUBLICATIONS,
  papers: papersSection.papersCards,
  projects: researchSection.projects,
  config: parseMapConfig(mapData),
  now: 2026,
});

function Harness({ source }: { source: ResearchGraph }) {
  const map = useResearchMap(source);
  const layout = useMemo(() => layoutResearchGraph(map.shown), [map.shown]);
  const items = useMemo(
    () => new Map(source.nodes.map((node) => [node.id, node])),
    [source],
  );
  return <MapCanvas map={map} layout={layout} items={items} />;
}

const items = () =>
  within(screen.getByRole("group", { name: "Research map" })).getAllByRole(
    "button",
  );
const item = (id: string) => {
  const found = items().find((button) => button.dataset.node === id);
  if (!found) throw new Error(`no button for ${id}`);
  return found;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MapCanvas", () => {
  it("draws one button per item, named first by its label", () => {
    render(<Harness source={graph} />);

    expect(items()).toHaveLength(graph.nodes.length);
    for (const node of graph.nodes) {
      const name = item(node.id).getAttribute("aria-label") ?? "";
      expect(name.startsWith(`${node.label}, `)).toBe(true);
      expect(item(node.id)).toHaveTextContent(node.label);
    }
  });

  it("shapes each item by its kind", () => {
    const { container } = render(<Harness source={graph} />);
    const count = (shape: string) =>
      container.querySelectorAll(`[data-shape="${shape}"]`).length;
    const kinds = (kind: string) =>
      graph.nodes.filter((node) => node.kind === kind).length;

    expect(count("dot")).toBe(kinds("publication"));
    expect(count("ring")).toBe(kinds("other-work"));
    expect(count("disc")).toBe(kinds("project"));
  });

  it("gives the whole map one Tab stop, on the newest item", () => {
    render(<Harness source={graph} />);

    const stops = items().filter((button) => button.tabIndex === 0);
    expect(stops.map((button) => button.dataset.node)).toEqual([
      "claret2026bio",
    ]);
  });

  it("moves the Tab stop with the arrow keys, along a lane and across", () => {
    render(<Harness source={graph} />);
    item("claret2026bio").focus();

    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(item("claret2026neuromodulation"));
    expect(item("claret2026neuromodulation").tabIndex).toBe(0);
    expect(item("claret2026bio").tabIndex).toBe(-1);

    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(document.activeElement).toBe(item("claret2026quadtree"));

    // Down from the PhD thesis lane's only item to the next lane: of the
    // three items it links to there, the nearest in time.
    item("phd-thesis").focus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(item("claret2026partitioned"));
  });

  it("opens an item on a press, and closes it on a second", () => {
    render(<Harness source={graph} />);

    fireEvent.click(item("claret2026emr"));
    expect(item("claret2026emr")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(item("claret2026emr"));
    expect(item("claret2026emr")).toHaveAttribute("aria-pressed", "false");
  });

  it("lights the pointed item's links and dims the others", () => {
    const { container } = render(<Harness source={graph} />);
    const edges = () => [...container.querySelectorAll("[data-edge]")];
    expect(edges().some((edge) => edge.classList.contains("opacity-20"))).toBe(
      false,
    );

    fireEvent.pointerEnter(item("claret2026pruner"));

    const lit = edges().filter(
      (edge) => !edge.classList.contains("opacity-20"),
    );
    expect(lit.map((edge) => edge.getAttribute("data-edge")).sort()).toEqual(
      graph.edges
        .filter(
          (edge) =>
            edge.source === "claret2026pruner" ||
            edge.target === "claret2026pruner",
        )
        .map((edge) => edge.id)
        .sort(),
    );
  });

  it("listens to no keys on window or document, and loops no animation", () => {
    const onWindow = vi.spyOn(window, "addEventListener");
    const onDocument = vi.spyOn(document, "addEventListener");

    const { container } = render(<Harness source={graph} />);

    const keys = [...onWindow.mock.calls, ...onDocument.mock.calls].filter(
      ([type]) => String(type).startsWith("key"),
    );
    expect(keys).toEqual([]);
    const looping = [...container.querySelectorAll("*")].filter((element) =>
      /\banimate-(spin|ping|pulse|bounce)|infinite/.test(
        element.getAttribute("class") ?? "",
      ),
    );
    expect(looping).toEqual([]);
  });
});
