import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExperienceTimeline } from "./ExperienceTimeline";

/**
 * First tests for this component. It is the one the site actually renders
 * (`page.tsx` imports it as `Experience`), while the neighbouring
 * `Experience.tsx` is dead code that only its own test file exercises.
 *
 * The focus here is the deep-link behaviour, which is the part with real
 * moving pieces: hash matching, scrolling, forcing the card open, and forcing
 * it visible past an IntersectionObserver that will never fire in jsdom.
 */

// jsdom has no real IntersectionObserver, and the ambient stub is not complete
// enough to be observed against. A no-op observer is also what we want here:
// it never reports intersection, so entrance state stays false and the
// deep-link visibility override is genuinely exercised rather than masked.
class NoopIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];
}

vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);

vi.mock("@/components/ui/animated", () => ({
  FadeIn: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="fade-in">{children}</div>
  ),
}));

vi.mock("@/components/ui/optimized-image", () => ({
  OptimizedImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock("@/components/ui/theme-provider", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("@/lib/hooks/useColorExtraction", () => ({
  useColorExtraction: () => ({ color: "rgb(59, 130, 246)" }),
  adjustColorBrightness: (color: string) => color,
}));

// Surfaces forceHover so the held-glow assertion has something to read.
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

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      children?: React.ReactNode;
    }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Seven roles so the five-item cutoff is real: two sit behind it.
// vi.hoisted because vi.mock is lifted above the file body, so a plain const
// would still be in its temporal dead zone when the factory runs.
const ROLES = vi.hoisted(() =>
  [
    {
      role: "University Teaching Specialist",
      company: "University College Dublin",
      anchorId: "ucd-teaching-specialist",
    },
    {
      role: "Doctoral Assistant",
      company: "University of Neuchatel",
      anchorId: "unine-doctoral-assistant",
    },
    {
      role: "Visiting Researcher",
      company: "University College Dublin",
      anchorId: "ucd-visiting-researcher",
    },
    {
      role: "Guest Lecturer",
      company: "University of Geneva",
      anchorId: "unige-guest-lecturer",
    },
    {
      role: "Founder",
      company: "Artificialkind",
      anchorId: "artificialkind-founder",
    },
    // Index 5 and 6 are hidden while collapsed.
    {
      role: "Co-Founder",
      company: "Versicherix",
      anchorId: "versicherix-cofounder",
    },
    {
      role: "Internship",
      company: "Jenks Vestibular Lab",
      anchorId: "jenks-vestibular-internship",
    },
  ].map((r, i) => ({
    ...r,
    companyUrl: "https://example.com/",
    companyLogo: "/images/logo.webp",
    companyDesc: `Desc ${i}`,
    date: `20${10 + i}`,
    desc: `DETAIL-${i} only shown once the card is expanded.`,
    location: "Somewhere",
    descBullets: [`Achievement ${i}`, "#Tag"],
  })),
);

vi.mock("@/data/portfolio", () => ({
  workExperiences: {
    display: true,
    title: "Selection Pressure",
    subtitle: { highlightedText: "Highlighted", normalText: "Normal" },
    experience: ROLES,
  },
}));

describe("ExperienceTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    window.location.hash = "";
  });

  // `unstubGlobals` is not enabled in vitest.config, and `restoreMocks` does
  // not cover stubGlobal, so the IntersectionObserver replacement above would
  // otherwise leak into whichever file runs next in this worker.
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("renders each role", () => {
    render(<ExperienceTimeline />);

    expect(
      screen.getByText("University Teaching Specialist"),
    ).toBeInTheDocument();
    expect(screen.getByText("Founder")).toBeInTheDocument();
  });

  it("gives every role an anchor id so it can be linked to", () => {
    render(<ExperienceTimeline />);

    expect(document.getElementById("ucd-teaching-specialist")).toBeTruthy();
    expect(document.getElementById("artificialkind-founder")).toBeTruthy();
  });

  it("keeps details hidden until a card is opened", () => {
    render(<ExperienceTimeline />);

    expect(screen.queryByText(/DETAIL-0/)).not.toBeInTheDocument();
  });

  describe("Collapsed list", () => {
    it("shows only the first five roles", () => {
      render(<ExperienceTimeline />);

      expect(
        screen.getByText("University Teaching Specialist"),
      ).toBeInTheDocument();
      expect(screen.getByText("Artificialkind")).toBeInTheDocument();
      // Index 5 and 6 are behind the cutoff.
      expect(screen.queryByText("Versicherix")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Jenks Vestibular Lab"),
      ).not.toBeInTheDocument();
    });

    it("reports how many roles are hidden", () => {
      render(<ExperienceTimeline />);

      expect(screen.getByLabelText("Show 2 earlier roles")).toBeInTheDocument();
    });

    it("reveals the rest when the node is used, and hides them again", () => {
      render(<ExperienceTimeline />);

      fireEvent.click(screen.getByLabelText("Show 2 earlier roles"));

      expect(screen.getByText("Versicherix")).toBeInTheDocument();
      expect(screen.getByText("Jenks Vestibular Lab")).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText("Collapse earlier roles"));

      expect(screen.queryByText("Versicherix")).not.toBeInTheDocument();
    });

    it("does not trail a connector below the last visible card", () => {
      // isLast is computed against the rendered slice, not the full array.
      // Measured against the full array the fifth card stays isLast=false and
      // its gradient line runs down into empty space.
      const { container } = render(<ExperienceTimeline />);

      const connectors = container.querySelectorAll("div.w-0\\.5.flex-1");
      // Five cards, so four connectors between them. The fifth card's line is
      // the reveal node's own dashed segment, which is not this class.
      expect(connectors).toHaveLength(4);
    });
  });

  describe("Deep Links", () => {
    it("scrolls to and expands the role targeted by the URL hash", async () => {
      window.location.hash = "#artificialkind-founder";

      render(<ExperienceTimeline />);

      await waitFor(() => {
        expect(window.scrollTo).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(screen.getByText(/DETAIL-4/)).toBeInTheDocument();
      });
      // Only the targeted card opens.
      expect(screen.queryByText(/DETAIL-0/)).not.toBeInTheDocument();
    });

    it("shows the deep-linked card even though the observer never fires", async () => {
      // jsdom has no IntersectionObserver behaviour, so entrance state stays
      // false. Without the isDeepLinked override the link would scroll the
      // viewport to a card sitting at opacity 0.
      window.location.hash = "#artificialkind-founder";

      render(<ExperienceTimeline />);

      await waitFor(() => {
        const card = document.getElementById("artificialkind-founder");
        expect(card?.className).toContain("opacity-100");
      });
      expect(
        document.getElementById("ucd-teaching-specialist")?.className,
      ).toContain("opacity-0");
    });

    it("holds the hover glow until the user scrolls", async () => {
      window.location.hash = "#artificialkind-founder";

      render(<ExperienceTimeline />);

      await waitFor(() => {
        expect(
          document.querySelectorAll('[data-force-hover="true"]').length,
        ).toBe(1);
      });

      fireEvent.wheel(window);

      await waitFor(() => {
        expect(
          document.querySelectorAll('[data-force-hover="true"]').length,
        ).toBe(0);
      });
    });

    it("reveals the hidden region when the target is behind the cutoff", async () => {
      // versicherix-cofounder is index 5, so it does not render at all until
      // the list expands. Without this the hash would resolve to nothing.
      window.location.hash = "#versicherix-cofounder";

      render(<ExperienceTimeline />);

      await waitFor(() => {
        expect(screen.getByText("Versicherix")).toBeInTheDocument();
      });
      expect(document.getElementById("versicherix-cofounder")).toBeTruthy();
      await waitFor(() => {
        expect(screen.getByText(/DETAIL-5/)).toBeInTheDocument();
      });
    });

    it("leaves the list collapsed when the target is already visible", async () => {
      // The explicit requirement: only expand when the target is hidden.
      // artificialkind-founder is index 4, inside the first five.
      window.location.hash = "#artificialkind-founder";

      render(<ExperienceTimeline />);

      await waitFor(() => {
        expect(screen.getByText(/DETAIL-4/)).toBeInTheDocument();
      });
      expect(screen.queryByText("Versicherix")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Show 2 earlier roles")).toBeInTheDocument();
    });

    it("ignores a hash that matches no role", async () => {
      window.location.hash = "#experience";

      render(<ExperienceTimeline />);

      expect(screen.queryByText(/DETAIL-0/)).not.toBeInTheDocument();
      expect(screen.queryByText(/DETAIL-4/)).not.toBeInTheDocument();
      expect(window.scrollTo).not.toHaveBeenCalled();
    });

    it("copies a role's deep link from its copy button", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      render(<ExperienceTimeline />);

      fireEvent.click(
        screen.getByLabelText("Copy link to Founder at Artificialkind"),
      );

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(
          expect.stringMatching(/\/#artificialkind-founder$/),
        );
      });
    });

    it("does not toggle the card when the copy button is clicked", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      render(<ExperienceTimeline />);

      // The whole card body toggles on click, so the button must stop
      // propagation or copying a link would also collapse the card.
      fireEvent.click(
        screen.getByLabelText("Copy link to Founder at Artificialkind"),
      );

      await waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(screen.queryByText(/DETAIL-4/)).not.toBeInTheDocument();
    });
  });
});
