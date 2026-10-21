import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from "@testing-library/react";
import { Research } from "./Research";
import { isDisplayed, researchSection } from "@/data/sections/research";
import { researchDetails } from "@/data/sections/research-details";
import * as scrollModule from "@/lib/utils/scroll-to-section";

/**
 * First tests for this component. The focus is the two pieces with real logic:
 * deciding whether a link opens the in-app PDF reader or a new tab, and the
 * deep-link wiring, where the hero and the grid expand through different state
 * (the hero has its own flag, the grid shares one activeIndex).
 */

const mockOpenPDF = vi.hoisted(() => vi.fn());

vi.mock("@/lib/hooks/usePDFViewer", () => ({
  usePDFViewer: () => ({
    isOpen: false,
    pdfUrl: "",
    title: undefined,
    downloadFileName: undefined,
    openPDF: mockOpenPDF,
    closePDF: vi.fn(),
  }),
}));

vi.mock("@/components/ui/pdf-modal", () => ({
  PDFModal: () => <div data-testid="pdf-modal" />,
}));

vi.mock("@/components/ui/animated", () => ({
  SlideInUp: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ScaleIn: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/holographic-card", () => ({
  HolographicCard: ({
    children,
    forceHover,
  }: {
    children: React.ReactNode;
    forceHover?: boolean;
  }) => (
    <div data-testid="holographic-card" data-force-hover={String(!!forceHover)}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/holographic-stats-card", () => ({
  HolographicStatsCard: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/lib/hooks/useSafari", () => ({
  useShouldReduceAnimations: () => true,
}));

vi.mock("framer-motion", () => {
  // `m` is the slim motion API the app renders inside LazyMotion.
  const mocked = {
    motion: {
      div: ({
        children,
        ...props
      }: React.HTMLAttributes<HTMLDivElement> & {
        children?: React.ReactNode;
      }) => <div {...props}>{children}</div>,
      button: ({
        children,
        ...props
      }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
        children?: React.ReactNode;
      }) => <button {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
  return { ...mocked, m: mocked.motion };
});

describe("Research", () => {
  // The cards under the hero, as the page shows them.
  const grid = researchSection.projects.filter(isDisplayed).slice(1);
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    window.location.hash = "";
  });

  describe("PDF links", () => {
    it("opens the hero's thesis chapter in the in-app reader", () => {
      render(<Research />);

      fireEvent.click(
        screen.getByText("Read the Introduction in PhD Thesis (Chapter 7)"),
      );

      expect(mockOpenPDF).toHaveBeenCalledWith(
        "/pdfs/thesis_PHD_chapter_7.pdf",
        "GEENNS: Growing Minds That Keep Learning",
        "thesis_PHD_chapter_7.pdf",
      );
    });

    it("renders local PDFs as buttons, not links that navigate away", () => {
      render(<Research />);

      const trigger = screen.getByText(
        "Read the Introduction in PhD Thesis (Chapter 7)",
      );
      expect(trigger.closest("button")).toBeTruthy();
      expect(trigger.closest("a")).toBeNull();
    });

    it("leaves the hero's GitHub link as a disabled button", () => {
      render(<Research />);

      const github = screen.getByText("GitHub Repository").closest("button");
      expect(github).toBeDisabled();
    });

    it("opens a thesis from a card's dialog, which stays open under it", async () => {
      render(<Research />);

      // A click anywhere on the PhD thesis card opens its details.
      fireEvent.click(
        screen.getByText("Scaling Adaptive Substrate Neuroevolution"),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "Scaling Adaptive Substrate Neuroevolution",
      });

      fireEvent.click(within(dialog).getByText("Read Thesis"));

      expect(mockOpenPDF).toHaveBeenCalledWith(
        "/pdfs/thesis_PHD.pdf",
        "Scaling Adaptive Substrate Neuroevolution",
        "thesis_PHD.pdf",
      );
      // The reader opens above the dialog, which stays.
      expect(dialog).toBeInTheDocument();
    });

    it("keeps non-PDF links as external anchors", async () => {
      render(<Research />);

      fireEvent.click(
        screen.getByText("Scaling Adaptive Substrate Neuroevolution"),
      );
      const dialog = await screen.findByRole("dialog", {
        name: "Scaling Adaptive Substrate Neuroevolution",
      });
      // By role, not text: "EMR-HyperNEAT" is also one of the card's tags.
      const anchor = within(dialog).getByRole("link", {
        name: "EMR-HyperNEAT",
      });

      expect(anchor).toHaveAttribute("target", "_blank");
      expect(anchor).toHaveAttribute(
        "href",
        "https://github.com/RomainClaret/emr-hyperneat",
      );
    });
  });

  describe("Keyboard", () => {
    it("opens each grid card's details in a dialog, from a real button", async () => {
      // The card grew in place and pushed the grid around; its details open
      // above the page now, outside the card, and closing gives the focus
      // back to the button.
      render(<Research />);

      for (const project of grid) {
        const button = screen.getByRole("button", {
          name: `Read more about ${project.title}`,
        });
        expect(button).toHaveAttribute("aria-haspopup", "dialog");
        expect(button).not.toHaveAttribute("aria-expanded");

        fireEvent.click(button);
        const dialog = await screen.findByRole("dialog", {
          name: project.title,
        });
        expect(document.getElementById(project.anchorId!)).not.toContainElement(
          dialog,
        );

        fireEvent.keyDown(document, { key: "Escape" });
        await waitFor(() => {
          expect(screen.queryByRole("dialog")).toBeNull();
        });
        expect(button).toHaveFocus();
      }
    });

    it("lets each PhD highlight take focus, which shows its explanation", () => {
      // The explanations showed on hover only, out of reach of a keyboard
      // or a touch screen.
      render(<Research />);
      const explanations = screen.getAllByRole("tooltip", { hidden: true });
      expect(explanations.length).toBeGreaterThan(0);

      for (const explanation of explanations) {
        const box = document.querySelector(
          `[aria-describedby="${explanation.id}"]`,
        );
        expect(box).toHaveAttribute("tabindex", "0");
        // jsdom applies no :focus styles; the classes are the contract.
        expect(explanation).toHaveClass(
          "group-hover:opacity-100",
          "group-focus:opacity-100",
        );
      }
    });

    it("writes a card's technologies through the contrast helper", async () => {
      // Raw, the tags read at 2.1 to 4.0:1 on the light theme.
      render(<Research />);
      fireEvent.click(
        screen.getByRole("button", {
          name: `Read more about ${grid[0].title}`,
        }),
      );

      const dialog = await screen.findByRole("dialog", {
        name: grid[0].title,
      });
      const heading = within(dialog).getByRole("heading", {
        name: "Technologies & Methods",
      });
      const tags = within(heading.parentElement!).getAllByRole("listitem");
      expect(tags).toHaveLength(grid[0].tags.length);
      for (const tag of tags) {
        expect(tag).toHaveClass("accent-text");
        expect(tag.style.getPropertyValue("--accent")).toMatch(/^rgb\(/);
      }
    });

    it("opens the PhD's and the journey's texts in a dialog, from real buttons", async () => {
      // Both swapped their text in place; their buttons said whether they
      // were open. They open a dialog now, and closing it gives the focus
      // back.
      render(<Research />);

      for (const [name, dialogName] of [
        [
          "Read full description",
          researchSection.projects.filter(isDisplayed)[0].title,
        ],
        ["Read the full story", "My Research Journey"],
      ]) {
        const button = screen.getByRole("button", { name });
        expect(button).toHaveAttribute("aria-haspopup", "dialog");
        expect(button).not.toHaveAttribute("aria-expanded");

        fireEvent.click(button);
        await screen.findByRole("dialog", { name: dialogName });

        fireEvent.keyDown(document, { key: "Escape" });
        await waitFor(() => {
          expect(screen.queryByRole("dialog")).toBeNull();
        });
        expect(button).toHaveFocus();
      }
      expect(screen.queryByText("Show less")).toBeNull();
    });
  });

  describe("Long texts", () => {
    // research-details.ts comes with the details dialog's code, out of the
    // page's first JavaScript: none of it is on the page until a dialog
    // opens.
    const [featured, firstInGrid] =
      researchSection.projects.filter(isDisplayed);

    it("has every project's full description, and the journey's", () => {
      expect(Object.keys(researchDetails.descriptions).sort()).toEqual(
        researchSection.projects.map((project) => project.title).sort(),
      );
      expect(researchDetails.journeyDescription.length).toBeGreaterThan(
        researchSection.journeyShortDescription.length,
      );
    });

    it("shows the PhD's full description in its dialog, not on the page", async () => {
      render(<Research />);
      const full = researchDetails.descriptions[featured.title];
      expect(screen.getByText(featured.shortDescription!)).toBeInTheDocument();
      expect(screen.queryByText(full)).toBeNull();

      fireEvent.click(
        screen.getByRole("button", { name: "Read full description" }),
      );

      const dialog = await screen.findByRole("dialog", {
        name: featured.title,
      });
      expect(within(dialog).getByText(full)).toBeInTheDocument();
      // The page shows the hero's highlights, technologies and links: its
      // dialog does not repeat them.
      expect(
        within(dialog).queryByRole("heading", { name: "Key Contributions" }),
      ).toBeNull();
    });

    it("tells the journey's story in its dialog; the card has its teaser", async () => {
      render(<Research />);
      expect(
        screen.getByText(researchSection.journeyShortDescription),
      ).toBeInTheDocument();
      expect(screen.queryByText(researchDetails.journeyDescription)).toBeNull();

      fireEvent.click(
        screen.getByRole("button", { name: "Read the full story" }),
      );

      const dialog = await screen.findByRole("dialog", {
        name: "My Research Journey",
      });
      expect(
        within(dialog).getByText(researchDetails.journeyDescription),
      ).toBeInTheDocument();
    });

    it("shows a grid card's full description in its dialog, not on the card", async () => {
      render(<Research />);
      const full = researchDetails.descriptions[firstInGrid.title];
      expect(screen.queryByText(full)).toBeNull();

      fireEvent.click(
        screen.getByRole("button", {
          name: `Read more about ${firstInGrid.title}`,
        }),
      );

      const dialog = await screen.findByRole("dialog", {
        name: firstInGrid.title,
      });
      expect(within(dialog).getByText(full)).toBeInTheDocument();
    });
  });

  describe("Deep links", () => {
    it("gives every project an anchor id", () => {
      render(<Research />);

      for (const id of [
        "geenns",
        "emerging-behaviors",
        "evolvable-vocabulary",
        "phd-thesis",
        "graphqa",
        "overclouds",
        "vestibular-integration",
      ]) {
        expect(document.getElementById(id)).toBeTruthy();
      }
    });

    it("points at the hero without opening it for #geenns", async () => {
      // Deliberate: sharing the card should not force the long read on whoever
      // opens the link. #geenns-full is the variant that expands.
      window.location.hash = "#geenns";

      render(<Research />);

      await waitFor(() => {
        expect(window.scrollTo).toHaveBeenCalled();
      });
      expect(
        screen.queryByText(/Grid-based Emergent Evolution/),
      ).not.toBeInTheDocument();
      // The teaser is what stays on screen.
      expect(
        screen.getByText(/Intelligence is not one big network/),
      ).toBeInTheDocument();
    });

    it("opens the hero description for #geenns-full", async () => {
      window.location.hash = "#geenns-full";

      render(<Research />);

      const dialog = await screen.findByRole("dialog", {
        name: researchSection.projects.filter(isDisplayed)[0].title,
      });
      expect(
        within(dialog).getByText(/Grid-based Emergent Evolution/),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(window.scrollTo).toHaveBeenCalled();
      });
    });

    it("points the -full link at the hero itself", async () => {
      // It pointed at an empty span of its own at the top of the hero, which
      // also held the link: any click on the hero itself released it.
      window.location.hash = "#geenns-full";

      render(<Research />);

      await waitFor(() => {
        expect(document.getElementById("geenns")).toHaveClass(
          "deep-link-highlight",
        );
      });
      expect(document.getElementById("geenns-full")).toBeNull();
    });

    it("points at a grid card for #graphqa, without opening it", async () => {
      window.location.hash = "#graphqa";

      render(<Research />);

      await waitFor(() => {
        expect(document.getElementById("graphqa")).toHaveClass(
          "deep-link-highlight",
        );
      });
      await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("opens the targeted grid card's details for #graphqa-full, and no other", async () => {
      window.location.hash = "#graphqa-full";

      render(<Research />);

      const dialog = await screen.findByRole("dialog", {
        name: /^GraphQA/,
      });
      expect(within(dialog).getByText("Code Repository")).toBeInTheDocument();
      // An index off by one opened the card next to it: the PhD thesis,
      // whose resources include this link.
      expect(
        screen.queryByRole("link", { name: "EMR-HyperNEAT" }),
      ).not.toBeInTheDocument();
    });

    it("ignores a hash that matches no project", async () => {
      window.location.hash = "#research";

      render(<Research />);
      // The hook scrolls inside requestAnimationFrame, so asserting straight
      // after render would pass even for an anchor it had registered.
      await act(() => new Promise((resolve) => setTimeout(resolve, 100)));

      expect(window.scrollTo).not.toHaveBeenCalled();
    });
  });

  describe("A card's details whose code cannot load", () => {
    afterEach(() => {
      vi.doUnmock("./ResearchDetailsDialog");
      vi.resetModules();
    });

    it("says so with the card's own text, and gives the focus back", async () => {
      const imports = { count: 0 };
      vi.resetModules();
      vi.doMock("./ResearchDetailsDialog", () => {
        imports.count++;
        throw new Error("chunk failed");
      });
      const { Research: Fresh } = await import("./Research");
      render(<Fresh />);
      const card = document.getElementById(grid[0].anchorId!)!;

      // Pointing at a card starts fetching its details' code.
      fireEvent.pointerEnter(card);
      await waitFor(() => expect(imports.count).toBe(1));

      const button = screen.getByRole("button", {
        name: `Read more about ${grid[0].title}`,
      });
      fireEvent.click(button);
      const dialog = await screen.findByRole("dialog", {
        name: grid[0].title,
      });
      expect(dialog).toHaveTextContent(grid[0].shortDescription!);
      expect(dialog).toHaveTextContent("Could not load the details.");

      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(button).toHaveFocus();
    });
  });

  describe("Hidden projects", () => {
    // Real data, like the rest of this file: these bite while a card is
    // hidden and pass trivially when none is.
    const hidden = researchSection.projects.filter((p) => !isDisplayed(p));
    const shown = researchSection.projects.filter(isDisplayed);

    // A stat's number sits just before its label. "Active Research" is also
    // the badge on each active card, hence picking the numeric sibling.
    const statValue = (label: string) =>
      screen
        .getAllByText(label)
        .map((el) => el.previousElementSibling?.textContent?.trim())
        .find((text) => !!text && /^\d+$/.test(text));

    it("keeps a hidden project off the page", () => {
      render(<Research />);

      for (const project of hidden) {
        expect(screen.queryByText(project.title)).not.toBeInTheDocument();
        if (project.anchorId) {
          expect(document.getElementById(project.anchorId)).toBeNull();
        }
      }
    });

    it("does not answer a deep link to a hidden project", async () => {
      // Watched at scrollToSection with the anchor itself, which names the
      // card a scroll was for, where window.scrollTo only says that something
      // scrolled.
      const scrollSpy = vi.spyOn(scrollModule, "scrollToSection");

      // Control: a visible card's anchor does reach the spy, so silence below
      // means the hidden anchor was skipped, not that the spy is deaf.
      const visibleAnchor = shown.find((p) => p.anchorId)!.anchorId!;
      window.location.hash = `#${visibleAnchor}`;
      const control = render(<Research />);
      // Ids only: an exact-arguments match stops matching anything the moment
      // the call gains a parameter, which would leave the check below vacuous.
      const scrolledTo = () => scrollSpy.mock.calls.map(([id]) => id);
      await waitFor(() => expect(scrolledTo()).toContain(visibleAnchor));
      control.unmount();

      for (const project of hidden.filter((p) => p.anchorId)) {
        scrollSpy.mockClear();
        window.location.hash = `#${project.anchorId}`;
        const { unmount } = render(<Research />);

        // The hook scrolls inside requestAnimationFrame, so checking straight
        // after render would pass whether or not the anchor was registered.
        await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
        expect(scrolledTo()).not.toContain(project.anchorId);
        unmount();
      }
      scrollSpy.mockRestore();
    });

    it("counts only the projects on the page", () => {
      render(<Research />);

      expect(statValue("Research Projects")).toBe(String(shown.length));
      expect(statValue("Active Research")).toBe(
        String(shown.filter((p) => p.status === "active").length),
      );
    });
  });
});
