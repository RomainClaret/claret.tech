import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ResearchMapDialog } from "./research-map-dialog";

// The site's reader stands in as a plain dialog that names its document.
vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function Reader({
      isOpen,
      title,
      pdfUrl,
    }: {
      isOpen: boolean;
      title?: string;
      pdfUrl: string;
    }) {
      return isOpen ? (
        <div role="dialog" aria-label={`Reader: ${title}`} data-pdf={pdfUrl} />
      ) : null;
    },
}));
vi.mock("@/components/ui/pdf-modal-loader", () => ({ loadPdfModal: vi.fn() }));

/** Phones (under 640 px) start in the list. */
function asPhone() {
  window.matchMedia = ((query: string) => ({
    matches: query === "(max-width: 639px)",
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const mapItem = (id: string) => {
  const found = within(screen.getByRole("group", { name: "Research map" }))
    .getAllByRole("button")
    .find((button) => button.dataset.node === id);
  if (!found) throw new Error(`no item ${id}`);
  return found;
};

beforeEach(() => {
  // The page's scroll comes back on close; jsdom has no scrolling.
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  // Not vi.restoreAllMocks() here: the dialog unmounts after this hook and
  // gives the page its scroll back through the stub (the config restores
  // mocks before the next test).
  window.location.hash = "";
});

describe("ResearchMapDialog", () => {
  it("opens as a modal dialog with the map, on a wide screen", () => {
    render(<ResearchMapDialog onClose={() => {}} />);

    const dialog = screen.getByRole("dialog", { name: "Research map" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(document.activeElement).toBe(dialog);
    expect(screen.getByRole("group", { name: "Research map" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Map" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("starts in the list on a phone, grouped by line of work", () => {
    asPhone();
    render(<ResearchMapDialog onClose={() => {}} />);

    expect(screen.queryByRole("group", { name: "Research map" })).toBeNull();
    expect(screen.getByRole("heading", { name: /^GEENNS/ })).toBeTruthy();
    const emr = screen.getByRole("button", {
      name: "EMR-HyperNEAT Paper, July 2026",
    });
    expect(emr).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(emr);
    expect(emr).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("heading", {
        name: /Tensor-Accelerated Eager Multi-Resolution Grids/,
      }),
    ).toBeTruthy();
  });

  it("shows an item's details beside the map: what it is, its documents and links", () => {
    render(<ResearchMapDialog onClose={() => {}} />);
    fireEvent.click(mapItem("claret2026emr"));

    const details = screen.getByRole("complementary", { name: "Details" });
    expect(
      within(details).getByRole("heading", {
        name: /Tensor-Accelerated Eager Multi-Resolution Grids/,
      }),
    ).toBeTruthy();
    expect(
      within(details).getByText(
        "With Michael O'Neill, Paul Cotofrei and Kilian Stoffel",
      ),
    ).toBeTruthy();
    for (const name of ["Read Paper", "Read Poster", "Show on page"]) {
      expect(within(details).getByRole("button", { name })).toBeTruthy();
    }
    const doi = within(details).getByRole("link", { name: /^DOI/ });
    expect(doi).toHaveAttribute("target", "_blank");
    expect(doi).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("groups an item's connections by why they exist", () => {
    render(<ResearchMapDialog onClose={() => {}} />);
    fireEvent.click(mapItem("claret2026emr"));

    const details = screen.getByRole("complementary", { name: "Details" });
    const headings = within(details)
      .getAllByRole("heading", { level: 4 })
      .map((heading) => heading.textContent);
    // The curated relations first, in the words of their direction, then
    // the links derived from the data.
    expect(headings).toEqual([
      "Built on by",
      "Companion work",
      "Part of",
      "Same code repository",
      "Linked from a research card",
      "Shared co-authors",
      "Same venue",
    ]);
  });

  it("goes to a connected item and puts the focus on its title", async () => {
    render(<ResearchMapDialog onClose={() => {}} />);
    fireEvent.click(mapItem("claret2026emr"));
    const details = screen.getByRole("complementary", { name: "Details" });

    fireEvent.click(
      within(details).getAllByRole("button", { name: "Activations" })[0],
    );

    const title = within(details).getByRole("heading", {
      level: 3,
      name: /Per-Node Activation Function Evolution/,
    });
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect(mapItem("claret2026activations")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("opens a document in the site's reader, over the map", () => {
    render(<ResearchMapDialog onClose={() => {}} />);
    fireEvent.click(mapItem("claret2026emr"));

    fireEvent.click(screen.getByRole("button", { name: "Read Paper" }));

    const reader = screen.getByRole("dialog", {
      name: /^Reader: Tensor-Accelerated/,
    });
    expect(reader.dataset.pdf).toMatch(/^\/pdfs\/.+\.pdf$/);
  });

  it("closes on Escape, the close button or the backdrop, as dismissed", () => {
    const onClose = vi.fn();
    render(<ResearchMapDialog onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close research map" }));
    fireEvent.click(screen.getByTestId("research-map-backdrop"));

    expect(onClose.mock.calls).toEqual([["dismiss"], ["dismiss"], ["dismiss"]]);
  });

  it("leaves for an item's card on the page with Show on page", async () => {
    const card = document.createElement("article");
    card.id = "claret2026emr";
    document.body.appendChild(card);
    const onClose = vi.fn();
    render(<ResearchMapDialog onClose={onClose} />);
    fireEvent.click(mapItem("claret2026emr"));

    fireEvent.click(screen.getByRole("button", { name: "Show on page" }));

    expect(onClose).toHaveBeenCalledWith("navigate");
    await waitFor(() => expect(window.location.hash).toBe("#claret2026emr"));
    card.remove();
  });

  it("hides a line of work from the map, and says so politely", () => {
    render(<ResearchMapDialog onClose={() => {}} />);
    const before = within(
      screen.getByRole("group", { name: "Research map" }),
    ).getAllByRole("button").length;

    fireEvent.click(
      within(screen.getByRole("group", { name: "Lines of work" })).getByRole(
        "button",
        { name: "Earlier work" },
      ),
    );

    const after = within(
      screen.getByRole("group", { name: "Research map" }),
    ).getAllByRole("button").length;
    expect(after).toBeLessThan(before);
    expect(screen.getByText(/^Showing \d+ of \d+ items/)).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });
});
