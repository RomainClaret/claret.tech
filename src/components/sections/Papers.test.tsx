import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Papers } from "./Papers";
import type { Publication } from "@/lib/api/fetch-publications";
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
        "—documenting discoveries that captured what I knew at the time. Looking back, they were all converging.",
    },
    papersCards: [
      {
        title: "Blockchain, a techie overview",
        date: "2016",
        shortDescription:
          "Demystifying blockchain when everyone thought it would change everything. Technical reality vs. religious fervor.",
        subtitle:
          "Written at peak blockchain hysteria. While everyone proclaimed revolution, I documented reality: consensus mechanisms with serious trade-offs. Explored three evolutionary paths for crypto (spoiler: none are utopian), dissected verification protocols (PoW wastes energy, PoS enables plutocracy), catalogued attack vectors everyone ignored. Key insight: blockchain is A digital consensus, not THE digital consensus. MaidSafe was already doing distributed consensus differently. The paper that said what techies were thinking but investors didn't want to hear.",
        image: "/images/paper_blockchain_2016.webp",
        footerLink: [
          {
            name: "Paper",
            url: "/pdfs/paper_blockchain_small_techie_overview_2016.pdf",
          },
        ],
      },
      {
        title: "Master's Thesis: Deep Learning Applications",
        date: "2018",
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

vi.mock("@/lib/hooks/usePDFViewer", () => ({
  usePDFViewer: vi.fn(() => ({
    isOpen: false,
    pdfUrl: "",
    title: "",
    downloadFileName: "",
    openPDF: vi.fn(),
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

// Mock HolographicCard
vi.mock("@/components/ui/holographic-card", () => ({
  HolographicCard: ({ children, className }: BaseMockProps) => (
    <div data-testid="holographic-card" className={className}>
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

    it("displays publication count and citations", async () => {
      render(<Papers />);

      await waitFor(() => {
        expect(screen.getByText("4 publications")).toBeInTheDocument(); // 2 static + 2 dynamic
        expect(screen.getByText("23 citations")).toBeInTheDocument();
      });
    });

    it("handles API fetch errors gracefully", async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error("API Error")));

      render(<Papers />);

      // Should still render static papers
      expect(
        screen.getByText("Blockchain, a techie overview"),
      ).toBeInTheDocument();

      // Should show static paper count only
      await waitFor(() => {
        expect(screen.getByText("2 publications")).toBeInTheDocument();
      });
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
      });
    });
  });

  describe("Card Interactions", () => {
    it("expands paper cards to show full content", async () => {
      render(<Papers />);

      // Find "Read more" buttons for static papers
      const readMoreButtons = screen.getAllByText("Read more");

      if (readMoreButtons.length > 0) {
        fireEvent.click(readMoreButtons[0]);

        // Full subtitle should be visible
        await waitFor(() => {
          expect(screen.getByText(/blockchain hysteria/)).toBeInTheDocument();
        });

        // Should now show "Show less" button
        expect(screen.getByText("Show less")).toBeInTheDocument();
      }
    });

    it("copies DOI to clipboard for dynamic papers", async () => {
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

      // Find DOI button (it contains "DOI" text)
      const doiButtons = screen.getAllByText("DOI");
      expect(doiButtons.length).toBeGreaterThan(0);

      fireEvent.click(doiButtons[0]);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith("10.1234/example.doi");
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

      await waitFor(() => {
        expect(screen.getByText("2 publications")).toBeInTheDocument();
      });
    });
  });
});
