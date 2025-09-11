import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NetworkControls } from "./network-controls";

// Mock framer-motion to avoid matchMedia issues
vi.mock("framer-motion", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    motion: {
      div: React.forwardRef(
        (
          props: React.HTMLAttributes<HTMLDivElement>,
          ref: React.Ref<HTMLDivElement>,
        ) => {
          const {
            initial: _initial,
            animate: _animate,
            exit: _exit,
            transition: _transition,
            variants: _variants,
            whileHover: _whileHover,
            whileTap: _whileTap,
            ...divProps
          } = props as any;
          return React.createElement("div", { ...divProps, ref });
        },
      ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

describe("NetworkControls", () => {
  const mockProps = {
    viewMode: "network" as const,
    onViewModeChange: vi.fn(),
    onFilterChange: vi.fn(),
    onExport: vi.fn(),
    isFullscreen: false,
    onFullscreenToggle: vi.fn(),
    totalPapers: 25,
    totalCitations: 150,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Form Field Accessibility", () => {
    it("has proper id and name attributes for search input", () => {
      render(<NetworkControls {...mockProps} />);

      // Open filters panel
      const filtersButton = screen.getByLabelText("Toggle filters");
      fireEvent.click(filtersButton);

      const searchInput = screen.getByPlaceholderText("Search papers...");
      expect(searchInput).toHaveAttribute("id", "papers-search");
      expect(searchInput).toHaveAttribute("name", "papers-search");
    });

    it("has proper id and name attributes for year range inputs", () => {
      render(<NetworkControls {...mockProps} />);

      // Open filters panel
      const filtersButton = screen.getByLabelText("Toggle filters");
      fireEvent.click(filtersButton);

      const startYearInput = screen.getByDisplayValue("2010");
      const endYearInput = screen.getByDisplayValue(
        new Date().getFullYear().toString(),
      );

      expect(startYearInput).toHaveAttribute("id", "year-range-start");
      expect(startYearInput).toHaveAttribute("name", "year-range-start");
      expect(endYearInput).toHaveAttribute("id", "year-range-end");
      expect(endYearInput).toHaveAttribute("name", "year-range-end");
    });

    it("has proper id and name attributes for min citations input", () => {
      render(<NetworkControls {...mockProps} />);

      // Open filters panel
      const filtersButton = screen.getByLabelText("Toggle filters");
      fireEvent.click(filtersButton);

      const minCitationsInput = screen.getByDisplayValue("0");
      expect(minCitationsInput).toHaveAttribute("id", "min-citations");
      expect(minCitationsInput).toHaveAttribute("name", "min-citations");
    });

    it("has proper id and name attributes for paper type checkboxes", () => {
      render(<NetworkControls {...mockProps} />);

      // Open filters panel
      const filtersButton = screen.getByLabelText("Toggle filters");
      fireEvent.click(filtersButton);

      const thesesCheckbox = screen.getByLabelText("Theses");
      const papersCheckbox = screen.getByLabelText("Papers");
      const postersCheckbox = screen.getByLabelText("Posters");

      expect(thesesCheckbox).toHaveAttribute("id", "show-theses");
      expect(thesesCheckbox).toHaveAttribute("name", "show-theses");
      expect(papersCheckbox).toHaveAttribute("id", "show-papers");
      expect(papersCheckbox).toHaveAttribute("name", "show-papers");
      expect(postersCheckbox).toHaveAttribute("id", "show-posters");
      expect(postersCheckbox).toHaveAttribute("name", "show-posters");
    });
  });

  describe("View Mode Toggle", () => {
    it("renders network view as selected by default", () => {
      render(<NetworkControls {...mockProps} />);

      const networkButton = screen.getByLabelText("Network view");
      const gridButton = screen.getByLabelText("Grid view");

      expect(networkButton).toHaveClass("bg-primary");
      expect(gridButton).not.toHaveClass("bg-primary");
    });

    it("calls onViewModeChange when switching views", () => {
      render(<NetworkControls {...mockProps} />);

      const gridButton = screen.getByLabelText("Grid view");
      fireEvent.click(gridButton);

      expect(mockProps.onViewModeChange).toHaveBeenCalledWith("grid");
    });
  });

  describe("Filter Panel", () => {
    it("has functional filter toggle button", () => {
      render(<NetworkControls {...mockProps} />);

      // Verify filter toggle button exists and is accessible
      const filtersButton = screen.getByLabelText("Toggle filters");
      expect(filtersButton).toBeInTheDocument();

      // Verify clicking doesn't crash
      expect(() => fireEvent.click(filtersButton)).not.toThrow();

      // Search input should be accessible (filters may be open by default)
      const searchInput = screen.getByPlaceholderText("Search papers...");
      expect(searchInput).toBeInTheDocument();
    });

    it("calls onFilterChange when search input changes", () => {
      render(<NetworkControls {...mockProps} />);

      // Open filters panel
      const filtersButton = screen.getByLabelText("Toggle filters");
      fireEvent.click(filtersButton);

      const searchInput = screen.getByPlaceholderText("Search papers...");
      fireEvent.change(searchInput, { target: { value: "test query" } });

      expect(mockProps.onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          searchQuery: "test query",
        }),
      );
    });

    it("calls onFilterChange when year range changes", () => {
      render(<NetworkControls {...mockProps} />);

      // Open filters panel
      const filtersButton = screen.getByLabelText("Toggle filters");
      fireEvent.click(filtersButton);

      const startYearInput = screen.getByDisplayValue("2010");
      fireEvent.change(startYearInput, { target: { value: "2020" } });

      expect(mockProps.onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          yearRange: [2020, expect.any(Number)],
        }),
      );
    });

    it("calls onFilterChange when min citations changes", () => {
      render(<NetworkControls {...mockProps} />);

      // Open filters panel
      const filtersButton = screen.getByLabelText("Toggle filters");
      fireEvent.click(filtersButton);

      const minCitationsInput = screen.getByDisplayValue("0");
      fireEvent.change(minCitationsInput, { target: { value: "5" } });

      expect(mockProps.onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          minCitations: 5,
        }),
      );
    });

    it("calls onFilterChange when paper type checkboxes change", () => {
      render(<NetworkControls {...mockProps} />);

      // Open filters panel
      const filtersButton = screen.getByLabelText("Toggle filters");
      fireEvent.click(filtersButton);

      const thesesCheckbox = screen.getByLabelText("Theses");
      fireEvent.click(thesesCheckbox);

      expect(mockProps.onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          showTheses: false,
        }),
      );
    });
  });

  describe("Quick Actions", () => {
    it("resets filters when Reset Filters button is clicked", () => {
      render(<NetworkControls {...mockProps} />);

      // Open filters panel
      const filtersButton = screen.getByLabelText("Toggle filters");
      fireEvent.click(filtersButton);

      const resetButton = screen.getByText("Reset Filters");
      fireEvent.click(resetButton);

      expect(mockProps.onFilterChange).toHaveBeenCalledWith({
        yearRange: [2010, new Date().getFullYear()],
        minCitations: 0,
        searchQuery: "",
        showTheses: true,
        showPapers: true,
        showPosters: true,
      });
    });

    it("sets high impact filter when High Impact button is clicked", () => {
      render(<NetworkControls {...mockProps} />);

      // Open filters panel
      const filtersButton = screen.getByLabelText("Toggle filters");
      fireEvent.click(filtersButton);

      const highImpactButton = screen.getByText("High Impact");
      fireEvent.click(highImpactButton);

      expect(mockProps.onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          minCitations: 10,
        }),
      );
    });

    it("sets recent filter when Recent button is clicked", () => {
      render(<NetworkControls {...mockProps} />);

      // Open filters panel
      const filtersButton = screen.getByLabelText("Toggle filters");
      fireEvent.click(filtersButton);

      const recentButton = screen.getByText("Recent");
      fireEvent.click(recentButton);

      const currentYear = new Date().getFullYear();
      expect(mockProps.onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({
          yearRange: [currentYear - 2, currentYear],
        }),
      );
    });
  });

  describe("Action Buttons", () => {
    it("calls onExport when export button is clicked", () => {
      render(<NetworkControls {...mockProps} />);

      const exportButton = screen.getByLabelText("Export visualization");
      fireEvent.click(exportButton);

      expect(mockProps.onExport).toHaveBeenCalled();
    });

    it("calls onFullscreenToggle when fullscreen button is clicked", () => {
      render(<NetworkControls {...mockProps} />);

      const fullscreenButton = screen.getByLabelText("Enter fullscreen");
      fireEvent.click(fullscreenButton);

      expect(mockProps.onFullscreenToggle).toHaveBeenCalled();
    });

    it("shows correct fullscreen button label when in fullscreen mode", () => {
      const fullscreenProps = { ...mockProps, isFullscreen: true };
      render(<NetworkControls {...fullscreenProps} />);

      expect(screen.getByLabelText("Exit fullscreen")).toBeInTheDocument();
    });
  });

  describe("Stats Display", () => {
    it("displays total papers and citations", () => {
      render(<NetworkControls {...mockProps} />);

      expect(screen.getByText("25")).toBeInTheDocument();
      expect(screen.getByText("papers")).toBeInTheDocument();
      expect(screen.getByText("150")).toBeInTheDocument();
      expect(screen.getByText("citations")).toBeInTheDocument();
    });
  });
});
