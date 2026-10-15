import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MapToolbar } from "./map-toolbar";
import type { MapLane, ReasonKind } from "@/lib/utils/graph-algorithms";

const lanes: MapLane[] = [
  {
    id: "geenns",
    label: "GEENNS",
    color: "#8b5cf6",
    repos: [],
    members: [],
    fallback: false,
  },
  {
    id: "earlier",
    label: "Earlier work",
    color: "#64748b",
    repos: [],
    members: [],
    fallback: true,
  },
];

function renderToolbar(over: Partial<Parameters<typeof MapToolbar>[0]> = {}) {
  const props = {
    view: "map" as const,
    onView: vi.fn(),
    lanes,
    hiddenLanes: new Set<string>(),
    onToggleLane: vi.fn(),
    kinds: ["same-repository", "co-authors"] as ReasonKind[],
    hiddenKinds: new Set<ReasonKind>(),
    onToggleKind: vi.fn(),
    isFiltered: false,
    onReset: vi.fn(),
    summary: "18 items and 17 links.",
    ...over,
  };
  render(<MapToolbar {...props} />);
  return props;
}

describe("MapToolbar", () => {
  it("switches between the map and the list", () => {
    const props = renderToolbar();
    const view = screen.getByRole("group", { name: "View" });

    expect(within(view).getByRole("button", { name: "Map" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(within(view).getByRole("button", { name: "List" }));
    expect(props.onView).toHaveBeenCalledWith("list");
  });

  it("toggles a line of work, and says which are shown", () => {
    const props = renderToolbar({ hiddenLanes: new Set(["earlier"]) });
    const group = screen.getByRole("group", { name: "Lines of work" });

    expect(
      within(group).getByRole("button", { name: "GEENNS" }),
    ).toHaveAttribute("aria-pressed", "true");
    const earlier = within(group).getByRole("button", { name: "Earlier work" });
    expect(earlier).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(earlier);
    expect(props.onToggleLane).toHaveBeenCalledWith("earlier");
  });

  it("offers a toggle for each kind of link the map has, and no other", () => {
    const props = renderToolbar({ hiddenKinds: new Set(["co-authors"]) });
    const group = screen.getByRole("group", { name: "Links" });
    const toggles = within(group).getAllByRole("button");

    expect(toggles.map((button) => button.textContent)).toEqual([
      "Same code",
      "Co-authors",
    ]);
    expect(toggles[1]).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggles[0]);
    expect(props.onToggleKind).toHaveBeenCalledWith("same-repository");
  });

  it("leaves out the links row when the map has no links", () => {
    renderToolbar({ kinds: [] });

    expect(screen.queryByRole("group", { name: "Links" })).toBeNull();
  });

  it("offers Show all only while something is hidden", () => {
    renderToolbar();

    expect(screen.getByRole("button", { name: "Show all" })).toBeDisabled();
  });

  it("shows everything again on Show all", () => {
    const { onReset } = renderToolbar({ isFiltered: true });

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("says what the map shows in a polite live region", () => {
    renderToolbar({ summary: "Showing 2 of 18 items and 1 of 17 links." });

    const status = screen.getByText("Showing 2 of 18 items and 1 of 17 links.");
    expect(status).toHaveAttribute("aria-live", "polite");
  });
});
