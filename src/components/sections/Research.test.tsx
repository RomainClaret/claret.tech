import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { Research } from "./Research";
import { isDisplayed, researchSection } from "@/data/sections/research";
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
  FadeIn: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
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

vi.mock("framer-motion", () => ({
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
}));

describe("Research", () => {
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

    it("opens a thesis from a grid card and does not collapse it", async () => {
      render(<Research />);

      // Expand the PhD thesis card.
      fireEvent.click(
        screen.getByText("Scaling Adaptive Substrate Neuroevolution"),
      );
      const readThesis = await screen.findByText("Read Thesis");

      fireEvent.click(readThesis);

      expect(mockOpenPDF).toHaveBeenCalledWith(
        "/pdfs/thesis_PHD.pdf",
        "Scaling Adaptive Substrate Neuroevolution",
        "thesis_PHD.pdf",
      );
      // The whole card is a click target, so without stopPropagation the
      // click that opened the PDF would also close the card behind it.
      expect(screen.getByText("Read Thesis")).toBeInTheDocument();
    });

    it("keeps non-PDF links as external anchors", async () => {
      render(<Research />);

      fireEvent.click(
        screen.getByText("Scaling Adaptive Substrate Neuroevolution"),
      );
      // By role, not text: "EMR-HyperNEAT" is also one of the card's tags.
      const anchor = await screen.findByRole("link", {
        name: "EMR-HyperNEAT",
      });

      expect(anchor).toHaveAttribute("target", "_blank");
      expect(anchor).toHaveAttribute(
        "href",
        "https://github.com/RomainClaret/emr-hyperneat",
      );
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

      await waitFor(() => {
        expect(
          screen.getByText(/Grid-based Emergent Evolution/),
        ).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(window.scrollTo).toHaveBeenCalled();
      });
    });

    it("gives the -full variant an element to scroll to", () => {
      // useCardDeepLink resolves its target with getElementById, so the
      // variant needs a real node or the scroll silently does nothing.
      render(<Research />);

      expect(document.getElementById("geenns-full")).toBeTruthy();
    });

    it("expands the targeted grid card and leaves the others shut", async () => {
      window.location.hash = "#graphqa";

      render(<Research />);

      await waitFor(() => {
        expect(screen.getByText("Code Repository")).toBeInTheDocument();
      });
      // The PhD thesis card shares the same activeIndex and must stay closed,
      // so its resource links are not rendered at all.
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
