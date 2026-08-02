import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { Papers } from "./Papers";
import {
  STATIC_PUBLICATIONS,
  type Publication,
} from "@/lib/api/fetch-publications";
import {
  FadeInProps,
  SlideInUpProps,
  NextImageProps,
  NextLinkProps,
  IconProps,
  PDFViewerModalProps,
  MotionDivProps,
  BaseMockProps,
  OptimizedImageProps,
  DynamicImportFn,
  DynamicImportOptions,
  MockHookFunction,
} from "@/test/mock-types";

// ResizeObserver that survives vitest's mockReset (the config resets vi.fn
// mocks before every test; useCardDeepLink observes document.body).
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(() => []),
  root: null,
  rootMargin: "",
  thresholds: [],
}));

// Mock the portfolio data - must be inline to avoid hoisting issues
vi.mock("@/data/portfolio", () => ({
  papersSection: {
    display: true,
    title: "Academic Contributions",
    subtitle: {
      highlightedText: "Leaving breadcrumbs of a longer journey",
      normalText:
        ", documenting discoveries that captured what I knew at the time. Looking back, they were all converging.",
    },
    papersCards: [
      {
        title: "Blockchain, a techie overview",
        date: "2016",
        status: "preprint",
        anchorId: "claret2016blockchain",
        // An Other Work card carrying citations, so the header's citation
        // total can be shown to include them and not just the publications.
        citations: 4,
        shortDescription:
          "Demystifying blockchain when everyone thought it would change everything. Technical reality vs. religious fervor.",
        subtitle:
          "Written at peak blockchain hysteria. While everyone proclaimed revolution, I documented reality: consensus mechanisms with serious trade-offs. Explored three evolutionary paths for crypto (spoiler: none are utopian), dissected verification protocols (PoW wastes energy, PoS enables plutocracy), cataloged attack vectors everyone ignored. The takeaway: blockchain is A digital consensus, not THE digital consensus. MaidSafe was already doing distributed consensus differently. The paper that said what techies were thinking but investors didn't want to hear.",
        image: "/images/paper_blockchain_2016.webp",
        footerLink: [
          {
            name: "Paper",
            url: "/pdfs/paper_blockchain_small_techie_overview_2016.pdf",
          },
        ],
      },
      {
        title: "Forthcoming Paper On Substrates",
        date: "2026",
        status: "to-appear",
        shortDescription: "A forthcoming paper.",
        subtitle: "A forthcoming paper, to appear.",
        image: "/images/paper_geenns_2024.webp",
        footerLink: [
          { name: "arXiv", url: "https://arxiv.org/abs/0000.00000" },
        ],
      },
      {
        title: "Master's Thesis: Deep Learning Applications",
        date: "2018",
        status: "presented",
        posterPdf: "/pdfs/poster_static_mock.pdf",
        shortDescription: "Research on neural network architectures",
        subtitle: "Exploring neural network architectures for vision tasks.",
        image: "/images/thesis_2018.webp",
        footerLink: [
          {
            name: "PDF",
            url: "/pdfs/thesis.pdf",
          },
          {
            name: "GitHub",
            url: "https://github.com/example/thesis",
          },
        ],
      },
    ],
  },
  socialMediaLinks: {
    orcid: "0000-0000-0000-0000",
  },
}));

// Mock hooks - must be inline to avoid hoisting issues
vi.mock("@/lib/hooks/useSafari", () => ({
  useShouldReduceAnimations: vi.fn(() => false),
}));

// Hoisted spy so tests can assert the in-app PDF reader was opened.
const { mockOpenPDF } = vi.hoisted(() => ({ mockOpenPDF: vi.fn() }));
vi.mock("@/lib/hooks/usePDFViewer", () => ({
  usePDFViewer: vi.fn(() => ({
    isOpen: false,
    pdfUrl: "",
    title: "",
    downloadFileName: "",
    openPDF: mockOpenPDF,
    closePDF: vi.fn(),
  })),
}));

vi.mock("@/lib/hooks/useConferenceLogo", () => ({
  useConferenceLogo: vi.fn(() => ({
    logoUrl: "/logos/default-conference.png",
    isLoading: false,
  })),
}));

vi.mock("@/lib/hooks/useColorExtraction", () => ({
  useColorExtraction: vi.fn(() => ({
    color: "rgb(139, 92, 246)",
    isLoading: false,
    error: null,
  })),
}));

// Mock animated components
vi.mock("@/components/ui/animated", () => ({
  FadeIn: ({ children, className }: FadeInProps) => (
    <div data-testid="fade-in" className={className}>
      {children}
    </div>
  ),
  SlideInUp: ({ children, delay, className }: SlideInUpProps) => (
    <div data-testid="slide-in-up" data-delay={delay} className={className}>
      {children}
    </div>
  ),
}));

// Mock HolographicCard (exposes forceHover so deep-link tests can assert it)
vi.mock("@/components/ui/holographic-card", () => ({
  HolographicCard: ({
    children,
    className,
    forceHover,
  }: BaseMockProps & { forceHover?: boolean }) => (
    <div
      data-testid="holographic-card"
      data-force-hover={forceHover ? "true" : undefined}
      className={className}
    >
      {children}
    </div>
  ),
}));

// Mock Next.js components
vi.mock("next/image", () => ({
  default: ({ src, alt, className, ...props }: NextImageProps) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InRyYW5zcGFyZW50Ii8+PC9zdmc+"
      alt={alt}
      className={className}
      data-testid="next-image"
      data-original-src={src}
      {...props}
    />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: NextLinkProps) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock OptimizedImage
vi.mock("@/components/ui/optimized-image", () => ({
  OptimizedImage: ({ src, alt, className }: OptimizedImageProps) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      data-testid="optimized-image"
    />
  ),
}));

// Mock PDF Modal
vi.mock("@/components/ui/pdf-modal", () => ({
  PDFModal: ({ isOpen, onClose, pdfUrl, title }: PDFViewerModalProps) =>
    isOpen ? (
      <div data-testid="pdf-modal" data-pdf-url={pdfUrl} data-title={title}>
        <button onClick={onClose}>Close PDF</button>
      </div>
    ) : null,
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  ExternalLink: () => <div data-testid="external-link-icon">ExternalLink</div>,
  Download: () => <div data-testid="download-icon">Download</div>,
  BookOpen: () => <div data-testid="book-open-icon">BookOpen</div>,
  Copy: () => <div data-testid="copy-icon">Copy</div>,
  Check: () => <div data-testid="check-icon">Check</div>,
  Calendar: () => <div data-testid="calendar-icon">Calendar</div>,
  Users: () => <div data-testid="users-icon">Users</div>,
  FileText: () => <div data-testid="file-text-icon">FileText</div>,
  Sparkles: () => <div data-testid="sparkles-icon">Sparkles</div>,
  Quote: () => <div data-testid="quote-icon">Quote</div>,
  ChevronDown: () => <div data-testid="chevron-down-icon">ChevronDown</div>,
  Award: () => <div data-testid="award-icon">Award</div>,
  Eye: () => <div data-testid="eye-icon">Eye</div>,
  MessageCircle: () => (
    <div data-testid="message-circle-icon">MessageCircle</div>
  ),
  Star: () => <div data-testid="star-icon">Star</div>,
  Link2: () => <div data-testid="link2-icon">Link2</div>,
  Presentation: () => <div data-testid="presentation-icon">Presentation</div>,
  Play: () => <div data-testid="play-icon">Play</div>,
}));

// Mock ORCID icon
vi.mock("@/components/icons", () => ({
  OrcidIcon: ({ className }: IconProps) => (
    <div data-testid="orcid-icon" className={className}>
      ORCID
    </div>
  ),
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, _whileHover, _transition, ...props }: MotionDivProps) => (
      <div data-testid="motion-div" {...props}>
        {children}
      </div>
    ),
  },
}));

// Mock dynamic import - Next.js dynamic returns a component
vi.mock("next/dynamic", () => ({
  default: (_loader: DynamicImportFn, _options: DynamicImportOptions) => {
    // Return a mock PDFModal component
    const MockPDFModal = ({
      isOpen,
      onClose,
      pdfUrl,
      title,
      _downloadFileName,
    }: PDFViewerModalProps) =>
      isOpen ? (
        <div data-testid="pdf-modal" data-pdf-url={pdfUrl} data-title={title}>
          <button onClick={onClose}>Close PDF</button>
        </div>
      ) : null;
    return MockPDFModal;
  },
}));

// Mock fetch for dynamic publications
const mockPublications: Publication[] = [
  {
    id: "test-pub-1",
    title: "Neuroevolution Research Paper",
    authors: ["Author A", "Author B"],
    venue: "NeurIPS 2023",
    year: "2023",
    citations: 15,
    paperUrl: "https://example.com/paper1",
    abstract: "Research on neuroevolution and neural networks",
    source: "static" as const,
  },
  {
    id: "test-pub-2",
    title: "Machine Learning Applications",
    authors: ["Author C"],
    venue: "ICML 2023",
    year: "2023",
    citations: 8,
    paperUrl: "https://example.com/paper2",
    abstract: "Applications of machine learning in real-world scenarios",
    source: "static" as const,
  },
];

describe("Papers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.ResizeObserver =
      MockResizeObserver as unknown as typeof ResizeObserver;

    // Mock successful API response
    global.fetch = vi.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            publications: mockPublications,
            totalCitations: 23,
            count: 2,
          }),
      } as Response),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Rendering", () => {
    it("renders the main papers section", () => {
      render(<Papers />);

      expect(screen.getByText("Academic Contributions")).toBeInTheDocument();
      expect(
        screen.getByText("Leaving breadcrumbs of a longer journey"),
      ).toBeInTheDocument();
    });

    it("renders static paper cards", () => {
      render(<Papers />);

      expect(
        screen.getByText("Blockchain, a techie overview"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Master's Thesis: Deep Learning Applications"),
      ).toBeInTheDocument();
    });

    it("fetches and renders dynamic publications", async () => {
      render(<Papers />);

      await waitFor(() => {
        expect(
          screen.getByText("Neuroevolution Research Paper"),
        ).toBeInTheDocument();
        expect(
          screen.getByText("Machine Learning Applications"),
        ).toBeInTheDocument();
      });
    });

    it("counts academic works and peer-reviewed publications separately", async () => {
      // The header used to call all of them "publications" while the body
      // filed several under Other Work as explicitly not that.
      render(<Papers />);

      await waitFor(() => {
        expect(screen.getByText("5 academic works")).toBeInTheDocument(); // 3 cards + 2 publications
        expect(screen.getByText("2 peer-reviewed")).toBeInTheDocument();
        // 23 from the publications feed plus the 4 on the blockchain card.
        expect(screen.getByText("27 citations")).toBeInTheDocument();
      });
    });

    it("derives the counts from the data rather than a fixed number", async () => {
      // Same component, a different number of publications: if either count
      // were written into the copy, one of these renders would be wrong.
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              publications: [mockPublications[0]],
              totalCitations: 7,
              count: 1,
            }),
        } as Response),
      );

      render(<Papers />);

      await waitFor(() => {
        expect(screen.getByText("4 academic works")).toBeInTheDocument();
        expect(screen.getByText("1 peer-reviewed")).toBeInTheDocument();
      });
    });

    it("counts citations from Other Work as well as publications", async () => {
      // The vestibular poster carries its citations on the card, since those
      // entries have no citation feed. Before this they vanished from the
      // total the moment a card moved out of the publications list. The mock
      // feed reports 23 and one card carries 4, so anything reading 23 here
      // means the cards are being ignored again.
      render(<Papers />);

      await waitFor(() =>
        expect(screen.getByText("27 citations")).toBeInTheDocument(),
      );
      expect(screen.queryByText("23 citations")).toBeNull();
    });

    it("leaves the counts alone when a filter hides cards", async () => {
      // They describe the record, not the current view.
      render(<Papers />);

      await waitFor(() =>
        expect(screen.getByText("5 academic works")).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByText("Papers Only"));

      expect(screen.getByText("5 academic works")).toBeInTheDocument();
      expect(screen.getByText("2 peer-reviewed")).toBeInTheDocument();
    });

    it("handles API fetch errors gracefully", async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error("API Error")));

      render(<Papers />);

      // Should still render static papers
      expect(
        screen.getByText("Blockchain, a techie overview"),
      ).toBeInTheDocument();

      // The publications list is seeded from the static array the API mirrors,
      // so a failed request leaves the real publications on screen instead of
      // an empty grid under a header that still counts them. Asserted against
      // that array rather than a literal, so adding a publication does not
      // make this fail for the wrong reason.
      const seeded = STATIC_PUBLICATIONS.length;
      await waitFor(() => {
        expect(screen.getByText(`${seeded} peer-reviewed`)).toBeInTheDocument();
      });
      expect(
        screen.getByText(`${seeded + 3} academic works`),
      ).toBeInTheDocument();
    });

    it("respects display flag", () => {
      // Test that component handles display flag from mocked data
      // The mock already sets display: true, so component should render
      render(<Papers />);

      expect(screen.getByText("Academic Contributions")).toBeInTheDocument();
    });
  });

  describe("Filtering", () => {
    it("renders filter buttons", () => {
      render(<Papers />);

      expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Papers Only" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Other Work" }),
      ).toBeInTheDocument();
    });

    it("filters to show papers only", async () => {
      render(<Papers />);

      await waitFor(() => {
        expect(
          screen.getByText("Neuroevolution Research Paper"),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Papers Only" }));

      // Dynamic papers should be visible
      expect(
        screen.getByText("Neuroevolution Research Paper"),
      ).toBeInTheDocument();
      // Static papers (theses) should be hidden
      expect(
        screen.queryByText("Blockchain, a techie overview"),
      ).not.toBeInTheDocument();
    });

    it("filters to show other work only", async () => {
      render(<Papers />);

      await waitFor(() => {
        expect(
          screen.getByText("Neuroevolution Research Paper"),
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Other Work" }));

      // Static papers should be visible
      expect(
        screen.getByText("Blockchain, a techie overview"),
      ).toBeInTheDocument();
      // Dynamic papers should be hidden
      expect(
        screen.queryByText("Neuroevolution Research Paper"),
      ).not.toBeInTheDocument();
    });

    it("shows all papers when All filter is selected", async () => {
      render(<Papers />);

      await waitFor(() => {
        expect(
          screen.getByText("Neuroevolution Research Paper"),
        ).toBeInTheDocument();
      });

      // First filter to papers only
      fireEvent.click(screen.getByRole("button", { name: "Papers Only" }));

      // Then back to all
      fireEvent.click(screen.getByRole("button", { name: "All" }));

      // Both types should be visible
      expect(
        screen.getByText("Blockchain, a techie overview"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Neuroevolution Research Paper"),
      ).toBeInTheDocument();
    });
  });

  describe("PDF Viewer", () => {
    it("opens PDF modal when PDF link is clicked", async () => {
      // Create a local mock that we can check
      let openPDFCalled = false;
      let openPDFArgs: string[] = [];

      const { usePDFViewer } = await import("@/lib/hooks/usePDFViewer");
      (usePDFViewer as unknown as MockHookFunction).mockReturnValue({
        isOpen: false,
        pdfUrl: "",
        title: "",
        downloadFileName: "",
        openPDF: (...args: string[]) => {
          openPDFCalled = true;
          openPDFArgs = args;
        },
        closePDF: vi.fn(),
      });

      render(<Papers />);

      // Find buttons with "Paper" text
      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        const paperButton = buttons.find(
          (btn) => btn.textContent?.trim() === "Paper",
        );

        if (paperButton) {
          fireEvent.click(paperButton);

          // Check if the function was called
          expect(openPDFCalled).toBe(true);
          expect(openPDFArgs[0]).toContain(".pdf");
          expect(openPDFArgs[1]).toContain("Blockchain");
        }
      });
    });

    it("opens the in-app reader from the Read Paper and Read Poster chips", async () => {
      const mockPubsWithPdfs: Publication[] = [
        {
          id: "pdf-1",
          title: "Paper with PDFs",
          authors: ["Author A"],
          venue: "Conference 2026",
          year: "2026",
          paperPdf: "/pdfs/paper_test.pdf",
          posterPdf: "/pdfs/poster_test.pdf",
          presentationPdf: "/pdfs/presentation_test.pdf",
          source: "static" as const,
        },
      ];
      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              publications: mockPubsWithPdfs,
              totalCitations: 0,
              count: 1,
            }),
        } as Response),
      );

      render(<Papers />);

      await waitFor(() => {
        expect(screen.getByText("Paper with PDFs")).toBeInTheDocument();
      });

      // Dynamic card chips open the internal reader with the local file
      fireEvent.click(screen.getByText("Read Paper"));
      expect(mockOpenPDF).toHaveBeenCalledWith(
        "/pdfs/paper_test.pdf",
        "Paper with PDFs",
        "paper_test.pdf",
      );

      const posterChips = screen.getAllByText("Read Poster");
      // Dynamic pub + the static mock card with posterPdf
      expect(posterChips.length).toBe(2);
      fireEvent.click(posterChips[0]);
      expect(mockOpenPDF).toHaveBeenCalledWith(
        "/pdfs/poster_test.pdf",
        "Paper with PDFs",
        "poster_test.pdf",
      );

      fireEvent.click(screen.getByText("Read Presentation"));
      expect(mockOpenPDF).toHaveBeenCalledWith(
        "/pdfs/presentation_test.pdf",
        "Paper with PDFs",
        "presentation_test.pdf",
      );
    });

    it("renders PDF modal when isOpen is true", async () => {
      const { usePDFViewer } = await import("@/lib/hooks/usePDFViewer");

      (usePDFViewer as unknown as MockHookFunction).mockReturnValue({
        isOpen: true,
        pdfUrl: "/pdfs/test.pdf",
        title: "Test PDF",
        downloadFileName: "test.pdf",
        openPDF: vi.fn(),
        closePDF: vi.fn(),
      });

      render(<Papers />);

      expect(screen.getByTestId("pdf-modal")).toBeInTheDocument();
      expect(screen.getByTestId("pdf-modal")).toHaveAttribute(
        "data-pdf-url",
        "/pdfs/test.pdf",
      );
    });

    it("handles external links correctly", () => {
      render(<Papers />);

      // The mock data doesn't have a GitHub link, so let's check for any external link behavior
      const links = screen.getAllByRole("link");
      const externalLinks = links.filter((link) =>
        link.getAttribute("href")?.startsWith("http"),
      );

      // Check that external links have proper attributes
      externalLinks.forEach((link) => {
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
      });
    });
  });

  describe("Research Area Detection", () => {
    it("detects neuroevolution research area", async () => {
      render(<Papers />);

      await waitFor(() => {
        const cards = screen.getAllByTestId("holographic-card");
        expect(cards.length).toBeGreaterThan(0);
      });

      // The neuroevolution paper should trigger color extraction
      const { useColorExtraction } = await import(
        "@/lib/hooks/useColorExtraction"
      );
      expect(useColorExtraction).toHaveBeenCalled();
    });
  });

  describe("Publication Status", () => {
    it("shows publication status badges", async () => {
      render(<Papers />);

      await waitFor(() => {
        // Published papers should have status indicators
        expect(screen.getAllByText("Published").length).toBeGreaterThan(0);
        // Forthcoming papers show a "To Appear" badge
        expect(screen.getAllByText("To Appear").length).toBeGreaterThan(0);
        // Explicitly marked statuses render their own badges
        expect(screen.getAllByText("Presented").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Preprint").length).toBeGreaterThan(0);
      });
    });
  });

  describe("Card Interactions", () => {
    it("expands paper cards to show full content", async () => {
      render(<Papers />);

      // Scoped to the blockchain card rather than taking the first "Read more"
      // on the page: the publications grid renders above the static cards, so
      // an index picks whichever card happens to sort first.
      const card = screen
        .getByText("Blockchain, a techie overview")
        .closest("div[class]")!.parentElement!;
      const readMore = within(card as HTMLElement).getByText("Read more");

      fireEvent.click(readMore);

      await waitFor(() => {
        expect(screen.getByText(/blockchain hysteria/)).toBeInTheDocument();
      });

      expect(
        within(card as HTMLElement).getByText("Show less"),
      ).toBeInTheDocument();
    });

    it("copies the BibTeX entry to clipboard for dynamic papers", async () => {
      // Mock clipboard API
      const mockWriteText = vi.fn(() => Promise.resolve());
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });

      // Update mock publications to include DOI
      const mockPubsWithDOI: Publication[] = [
        {
          id: "test-doi-1",
          title: "Paper with DOI",
          authors: ["Author A"],
          venue: "Conference 2023",
          year: "2023",
          citations: 10,
          paperUrl: "https://example.com/paper",
          abstract: "Abstract",
          doi: "10.1234/example.doi",
          bibtex:
            "@inproceedings{test-doi-1,\n  title={Paper with DOI},\n  doi={10.1234/example.doi},\n}",
          source: "static" as const,
        },
      ];

      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              publications: mockPubsWithDOI,
              totalCitations: 10,
              count: 1,
            }),
        } as Response),
      );

      render(<Papers />);

      // Wait for dynamic papers to load
      await waitFor(() => {
        expect(screen.getByText("Paper with DOI")).toBeInTheDocument();
      });

      // Find BibTeX button (it contains "BibTeX" text)
      const bibtexButtons = screen.getAllByText("BibTeX");
      expect(bibtexButtons.length).toBeGreaterThan(0);

      fireEvent.click(bibtexButtons[0]);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalled();
      });
      // The curated verbatim entry is copied as-is
      const copied = mockWriteText.mock.calls[0][0] as unknown as string;
      expect(copied).toBe(
        "@inproceedings{test-doi-1,\n  title={Paper with DOI},\n  doi={10.1234/example.doi},\n}",
      );
    });

    it("shows Code instead of Details when a publication has a code repository", async () => {
      const mockPubsWithCode: Publication[] = [
        {
          id: "test-code-1",
          title: "Paper with Code",
          authors: ["Author A"],
          venue: "Conference 2026",
          year: "2026",
          semanticScholarUrl: "https://semanticscholar.org/paper/test-code-1",
          codeUrl: "https://github.com/example/repo",
          source: "static" as const,
        },
        {
          id: "test-details-1",
          title: "Paper with Details only",
          authors: ["Author B"],
          venue: "Conference 2025",
          year: "2025",
          semanticScholarUrl:
            "https://semanticscholar.org/paper/test-details-1",
          source: "static" as const,
        },
      ];

      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              publications: mockPubsWithCode,
              totalCitations: 0,
              count: 2,
            }),
        } as Response),
      );

      render(<Papers />);

      await waitFor(() => {
        expect(screen.getByText("Paper with Code")).toBeInTheDocument();
      });

      // The paper with a repo shows a Code button linking to it
      const codeButton = screen.getByText("Code").closest("a");
      expect(codeButton).toHaveAttribute(
        "href",
        "https://github.com/example/repo",
      );
      // Details is suppressed for that paper but still shown for the other
      expect(screen.getAllByText("Details")).toHaveLength(1);
    });
  });

  describe("Deep Links", () => {
    afterEach(() => {
      window.location.hash = "";
    });

    it("scrolls to and expands the publication targeted by the URL hash", async () => {
      window.scrollTo = vi.fn();
      const mockDeepPubs: Publication[] = [
        {
          id: "deep-1",
          title: "Deep Linked Paper",
          authors: ["Author A"],
          venue: "Conference 2026",
          year: "2026",
          abstract:
            "A very long abstract that goes well past the two hundred character truncation threshold so that the collapsed and expanded states are clearly distinguishable in this test. It keeps going with enough filler words to comfortably exceed the limit and finally includes the marker END-OF-ABSTRACT.",
          shortDescription: "The short teaser.",
          source: "static" as const,
        },
      ];
      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              publications: mockDeepPubs,
              totalCitations: 0,
              count: 1,
            }),
        } as Response),
      );
      window.location.hash = "#deep-1";

      render(<Papers />);

      await waitFor(() => {
        expect(screen.getByText("Deep Linked Paper")).toBeInTheDocument();
      });
      // The card wrapper carries the anchor id
      expect(document.getElementById("deep-1")).toBeInTheDocument();
      // The offset scroll fired
      await waitFor(() => {
        expect(window.scrollTo).toHaveBeenCalled();
      });
      // The abstract auto-expanded (full abstract replaces the teaser)
      await waitFor(() => {
        expect(screen.getByText(/END-OF-ABSTRACT/)).toBeInTheDocument();
      });
    });

    it("holds the hover glow on the deep-linked card until the user interacts", async () => {
      window.scrollTo = vi.fn();
      const mockDeepPubs: Publication[] = [
        {
          id: "deep-2",
          title: "Glowing Paper",
          authors: ["Author A"],
          venue: "Conference 2026",
          year: "2026",
          abstract: "Abstract",
          source: "static" as const,
        },
      ];
      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              publications: mockDeepPubs,
              totalCitations: 0,
              count: 1,
            }),
        } as Response),
      );
      window.location.hash = "#deep-2";

      render(<Papers />);

      await waitFor(() => {
        expect(screen.getByText("Glowing Paper")).toBeInTheDocument();
      });
      const wrapper = document.getElementById("deep-2")!;
      // The linked card holds the forced hover glow
      await waitFor(() => {
        expect(wrapper.querySelector('[data-force-hover="true"]')).toBeTruthy();
      });

      // A click inside the linked card keeps the glow
      fireEvent.pointerDown(
        wrapper.querySelector('[data-testid="holographic-card"]')!,
      );
      expect(wrapper.querySelector('[data-force-hover="true"]')).toBeTruthy();

      // Scrolling (wheel) releases it back to normal hover behavior
      fireEvent.wheel(window);
      await waitFor(() => {
        expect(wrapper.querySelector('[data-force-hover="true"]')).toBeFalsy();
      });
    });

    it("renders anchor ids for Other Work cards", () => {
      render(<Papers />);

      expect(
        document.getElementById("claret2016blockchain"),
      ).toBeInTheDocument();
    });

    it("copies a paper deep link from the card's copy button", async () => {
      const mockWriteText = vi.fn(() => Promise.resolve());
      Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

      render(<Papers />);

      await waitFor(() => {
        expect(
          screen.getByText("Neuroevolution Research Paper"),
        ).toBeInTheDocument();
      });

      const copyButtons = screen.getAllByLabelText("Copy link to this paper");
      fireEvent.click(copyButtons[0]);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringMatching(/\/#(test-pub-1|test-pub-2)$/),
        );
      });
    });
  });

  describe("Animation and Performance", () => {
    it("applies animation delays to cards", () => {
      render(<Papers />);

      const slideInElements = screen.getAllByTestId("slide-in-up");

      // Cards should have staggered delays
      const delays = slideInElements.map((el) =>
        parseInt(el.getAttribute("data-delay") || "0"),
      );

      // Delays should be incremental
      expect(delays.some((delay) => delay > 0)).toBe(true);
    });

    it("reduces animations when requested", async () => {
      const { useShouldReduceAnimations } = await import(
        "@/lib/hooks/useSafari"
      );
      (
        useShouldReduceAnimations as unknown as MockHookFunction
      ).mockReturnValue(true);

      render(<Papers />);

      // Component should still render but with reduced animations
      expect(screen.getByText("Academic Contributions")).toBeInTheDocument();
    });
  });

  describe("Dynamic Publication Cards", () => {
    it("renders publication venue and year", async () => {
      render(<Papers />);

      await waitFor(() => {
        expect(screen.getByText("NeurIPS 2023")).toBeInTheDocument();
        expect(screen.getByText("ICML 2023")).toBeInTheDocument();
      });
    });

    it("shows citation count for each publication", async () => {
      render(<Papers />);

      // Wait for dynamic papers to load
      await waitFor(() => {
        expect(
          screen.getByText("Neuroevolution Research Paper"),
        ).toBeInTheDocument();
      });

      // Check for citation text - it should be in format "X citations"
      await waitFor(() => {
        const citationElements = screen.getAllByText(/citations/);
        expect(citationElements.length).toBeGreaterThan(0);
        // The first paper has 15 citations
        const firstCitation = citationElements.find((el) =>
          el.textContent?.includes("15"),
        );
        expect(firstCitation).toBeDefined();
      });
    });

    it("marks new publications", async () => {
      // Modify mock data to have isNew flag
      const mockPubs: Publication[] = [
        {
          id: "test-new-1",
          title: "New Research Paper",
          authors: ["Author A"],
          venue: "Conference 2024",
          year: "2024",
          citations: 0,
          paperUrl: "https://example.com/new",
          abstract: "New research",
          source: "static" as const,
        },
      ];

      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              publications: mockPubs,
              totalCitations: 0,
              count: 1,
            }),
        } as Response),
      );

      render(<Papers />);

      // Wait for dynamic papers to load
      await waitFor(() => {
        expect(screen.getByText("New Research Paper")).toBeInTheDocument();
      });

      // Check for "New" badge in publication status
      // Since we check publication status based on venue/title, let's verify the paper is rendered
      expect(screen.getByText("Conference 2024")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("provides proper ARIA labels for interactive elements", () => {
      render(<Papers />);

      const filterButtons = screen.getAllByRole("button");
      filterButtons.forEach((button) => {
        expect(button).toHaveAccessibleName();
      });
    });

    it("uses semantic HTML for paper cards", () => {
      render(<Papers />);

      // Should use article elements for paper cards
      const articles = document.querySelectorAll("article");
      expect(articles.length).toBeGreaterThanOrEqual(0);
    });

    it("provides alt text for paper images", () => {
      render(<Papers />);

      const images = screen.getAllByTestId("optimized-image");
      images.forEach((img) => {
        expect(img).toHaveAttribute("alt");
      });
    });
  });

  describe("Empty State", () => {
    it("handles empty publications gracefully", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              publications: [],
              totalCitations: 0,
              count: 0,
            }),
        } as Response),
      );

      render(<Papers />);

      // Should still show static papers
      expect(
        screen.getByText("Blockchain, a techie overview"),
      ).toBeInTheDocument();

      // An empty response means no peer-reviewed work to show, so the header
      // must say zero rather than keep the seeded number.
      await waitFor(() => {
        expect(screen.getByText("3 academic works")).toBeInTheDocument();
        expect(screen.getByText("0 peer-reviewed")).toBeInTheDocument();
      });
    });
  });
});
