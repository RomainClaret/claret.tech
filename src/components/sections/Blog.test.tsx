import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { Blog, mediumAnchorId } from "./Blog";
import { extractTextContent } from "./BlogCards";

// Mock portfolio data - must be inline to avoid hoisting issues
vi.mock("@/data/portfolio", () => ({
  blogSection: {
    display: true,
    displayMediumBlogs: true,
    displayKudosArticles: true,
    title: "Field Notes",
    subtitle: {
      highlightedText: "Highlighted",
      normalText: "Normal",
    },
    mediumUsername: "testuser",
    kudosProfileUrl: "https://www.growkudos.com/profile/test",
    blogs: [
      {
        title: "Static Fallback Post",
        description: "Static fallback description.",
        url: "https://example.com/static",
        image: "/images/static.webp",
      },
    ],
  },
}));

// Mock animated components
// Mock HolographicCard (exposes forceHover so deep-link tests can assert it)
vi.mock("@/components/ui/holographic-card", () => ({
  HolographicCard: ({
    children,
    className,
    forceHover,
  }: {
    children: React.ReactNode;
    className?: string;
    forceHover?: boolean;
  }) => (
    <div
      data-testid="holographic-card"
      data-force-hover={forceHover ? "true" : undefined}
      className={className}
    >
      {children}
    </div>
  ),
}));

// Mock lucide icons - every icon BlogCardHolographic imports must be listed,
// or the component renders undefined and every test crashes.
vi.mock("lucide-react", () => ({
  ExternalLink: () => <div data-testid="external-link-icon" />,
  Calendar: () => <div data-testid="calendar-icon" />,
  BookOpen: () => <div data-testid="book-open-icon" />,
  Sparkles: () => <div data-testid="sparkles-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  User: () => <div data-testid="user-icon" />,
  Share2: () => <div data-testid="share-icon" />,
  Eye: () => <div data-testid="eye-icon" />,
  ArrowRight: () => <div data-testid="arrow-right-icon" />,
  Link2: () => <div data-testid="link2-icon" />,
  Check: () => <div data-testid="check-icon" />,
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="next-image" />
  ),
}));

// Mock framer-motion
vi.mock("framer-motion", () => {
  // `m` is the slim motion API the app renders inside LazyMotion.
  const mocked = {
    motion: {
      div: ({
        children,
        ...props
      }: {
        children?: React.ReactNode;
        [key: string]: unknown;
      }) => <div {...props}>{children}</div>,
    },
  };
  return { ...mocked, m: mocked.motion };
});

// Mock hooks + utils with side effects
vi.mock("@/lib/hooks/useSafari", () => ({
  useShouldReduceAnimations: () => false,
}));
vi.mock("@/lib/hooks/useColorExtraction", () => ({
  useColorExtraction: () => ({
    color: "rgb(139, 92, 246)",
    isLoading: false,
    error: null,
  }),
}));
vi.mock("@/lib/utils/dev-logger", () => ({
  logError: vi.fn(),
}));

// ResizeObserver that survives vitest's mockReset (the config resets vi.fn
// mocks before every test; useCardDeepLink observes document.body).
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const LONG_TEXT =
  "This description is deliberately written to be much longer than one hundred and fifty characters so that the Read more button renders and the post's details dialog is observable in the test.";

// Seven Medium posts (newest first by date) so the sixth-article cap is real.
const mediumItems = Array.from({ length: 7 }, (_, i) => ({
  title: `Medium Post ${i + 1}`,
  link: `https://romainclaret.medium.com/medium-post-${i + 1}-abcdef${i}?source=rss`,
  pubDate: `2026-06-${String(20 - i).padStart(2, "0")}`,
  content: `<p>${LONG_TEXT}</p>`,
  contentSnippet: LONG_TEXT,
  guid: `guid-${i + 1}`,
  isoDate: `2026-06-${String(20 - i).padStart(2, "0")}T00:00:00Z`,
}));

const kudosItems = [
  {
    id: "gecco-2024-tuning-evolution",
    title: "Teaching AI to Evolve",
    description: LONG_TEXT,
    url: "https://www.growkudos.com/publications/test/reader",
    date: "2026-06-25",
    author: "Romain Claret",
    type: "research-story",
  },
];

function mockFetch() {
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("medium-posts")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: mediumItems }),
      } as Response);
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ articles: kudosItems }),
    } as Response);
  }) as unknown as typeof fetch;
}

describe("Blog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch();
    window.scrollTo = vi.fn();
    global.ResizeObserver =
      MockResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    window.location.hash = "";
  });

  describe("mediumAnchorId", () => {
    it("extracts the permanent slug from a Medium link, dropping the query", () => {
      expect(
        mediumAnchorId(
          "https://romainclaret.medium.com/my-hello-world-ffba38a04a95?source=rss",
        ),
      ).toBe("my-hello-world-ffba38a04a95");
    });

    it("returns undefined for malformed links", () => {
      expect(mediumAnchorId("not a url")).toBeUndefined();
    });
  });

  describe("A post's details", () => {
    it("opens a post's whole text from its Read more, and comes back", async () => {
      render(<Blog />);
      const button = await screen.findByRole("button", {
        name: "Read more about Teaching AI to Evolve",
      });

      fireEvent.click(button);

      const dialog = await screen.findByRole("dialog", {
        name: "Teaching AI to Evolve",
      });
      expect(dialog).toHaveTextContent(LONG_TEXT);
      expect(
        screen.getAllByRole("link", { name: "Read" }).at(-1),
      ).toHaveAttribute("href", kudosItems[0].url);

      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(button).toHaveFocus();
    });
  });

  describe("A post's details whose code cannot load", () => {
    afterEach(() => {
      vi.doUnmock("./BlogDetailsDialog");
      vi.resetModules();
    });

    it("says so with the start of the post's text, and gives the focus back", async () => {
      // Longer than the stand-in shows: it does not scroll.
      const story = `${LONG_TEXT} ${LONG_TEXT}`;
      global.fetch = vi.fn((input: RequestInfo | URL) =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(
              String(input).includes("medium-posts")
                ? { items: [] }
                : { articles: [{ ...kudosItems[0], description: story }] },
            ),
        } as Response),
      ) as unknown as typeof fetch;
      const imports = { count: 0 };
      vi.resetModules();
      vi.doMock("./BlogDetailsDialog", () => {
        imports.count++;
        throw new Error("chunk failed");
      });
      const { Blog: Fresh } = await import("./Blog");
      render(<Fresh />);
      const button = await screen.findByRole("button", {
        name: "Read more about Teaching AI to Evolve",
      });

      // Pointing at Read more starts fetching the dialog's code.
      fireEvent.pointerEnter(button);
      await waitFor(() => expect(imports.count).toBe(1));

      fireEvent.click(button);
      const dialog = await screen.findByRole("dialog", {
        name: "Teaching AI to Evolve",
      });
      expect(dialog).toHaveTextContent("Could not load the details.");
      expect(dialog).toHaveTextContent(`${LONG_TEXT.slice(0, 100)}`);
      expect(dialog.textContent).toContain("…");
      expect(dialog.textContent).not.toContain(story);

      fireEvent.keyDown(document, { key: "Escape" });
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(button).toHaveFocus();
    });
  });

  describe("extractTextContent", () => {
    it("keeps a post's paragraphs, a blank line between two", () => {
      expect(
        extractTextContent(
          "<h2>Title</h2><p>One <em>sentence</em>.</p><ul><li>A</li><li>B</li></ul><p>Last.</p>",
        ),
      ).toBe("Title\n\nOne sentence.\n\nA\n\nB\n\nLast.");
    });

    it("keeps a line break, and drops the source's own whitespace", () => {
      expect(
        extractTextContent(
          "<p>\n  Line one<br>line two\n</p>\n<p>Spaced\n   text<br></p><p>End</p>",
        ),
      ).toBe("Line one\nline two\n\nSpaced text\n\nEnd");
    });

    it("leaves out a photo's credit, and keeps the text after it", () => {
      // Medium's shape: a photo under a post's first lines, its credit in
      // the caption. The text was cut at the first "Photo by", which left
      // both posts on the site at their first sentence.
      expect(
        extractTextContent(
          '<p>The start.</p><figure><img alt="" src="https://cdn-images-1.medium.com/max/1024/0*a" /><figcaption>Photo by <a href="https://unsplash.com/@someone">Someone</a> on <a href="https://unsplash.com">Unsplash</a></figcaption></figure><p>The rest of the post.</p>',
        ),
      ).toBe("The start.\n\nThe rest of the post.");
    });
  });

  describe("Deep Links", () => {
    it("renders anchor ids for Kudos and Medium cards", async () => {
      render(<Blog />);

      await waitFor(() => {
        expect(screen.getByText("Teaching AI to Evolve")).toBeInTheDocument();
      });
      expect(
        document.getElementById("gecco-2024-tuning-evolution"),
      ).toBeInTheDocument();
      expect(
        document.getElementById("medium-post-1-abcdef0"),
      ).toBeInTheDocument();
    });

    it("scrolls to and glows the deep-linked post, without opening it, then releases on wheel", async () => {
      window.location.hash = "#medium-post-1-abcdef0";

      render(<Blog />);

      await waitFor(() => {
        expect(screen.getByText("Medium Post 1")).toBeInTheDocument();
      });
      const wrapper = document.getElementById("medium-post-1-abcdef0")!;
      // Scrolled with the offset math
      await waitFor(() => {
        expect(window.scrollTo).toHaveBeenCalled();
      });
      // Holds the hover glow
      await waitFor(() => {
        expect(wrapper.querySelector('[data-force-hover="true"]')).toBeTruthy();
      });
      // Points at the post: only its -full link opens the text.
      await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
      expect(screen.queryByRole("dialog")).toBeNull();

      // Wheel releases the glow back to normal hover behavior
      fireEvent.wheel(window);
      await waitFor(() => {
        expect(wrapper.querySelector('[data-force-hover="true"]')).toBeFalsy();
      });
    });

    it("opens the post's whole text for its -full link", async () => {
      window.location.hash = "#medium-post-1-abcdef0-full";

      render(<Blog />);

      const dialog = await screen.findByRole("dialog", {
        name: "Medium Post 1",
      });
      expect(dialog).toHaveTextContent(LONG_TEXT);
      expect(document.getElementById("medium-post-1-abcdef0")).toHaveClass(
        "deep-link-highlight",
      );
    });

    it("opens an older post's whole text for its -full link", async () => {
      // The 7th (oldest) article is normally cut by the slice(0, 6) cap.
      window.location.hash = "#medium-post-7-abcdef6-full";

      render(<Blog />);

      expect(
        await screen.findByRole("dialog", { name: "Medium Post 7" }),
      ).toBeInTheDocument();
    });

    it("renders the deep-linked article even when it is older than the visible six", async () => {
      // The 7th (oldest) article is normally cut by the slice(0, 6) cap.
      window.location.hash = "#medium-post-7-abcdef6";

      render(<Blog />);

      await waitFor(() => {
        expect(screen.getByText("Medium Post 7")).toBeInTheDocument();
      });
      expect(
        document.getElementById("medium-post-7-abcdef6"),
      ).toBeInTheDocument();
    });

    it("copies a post deep link from the card's copy button", async () => {
      const mockWriteText = vi.fn(() => Promise.resolve());
      Object.assign(navigator, { clipboard: { writeText: mockWriteText } });

      render(<Blog />);

      await waitFor(() => {
        expect(screen.getByText("Teaching AI to Evolve")).toBeInTheDocument();
      });

      const copyButtons = screen.getAllByLabelText("Copy link to this post");
      fireEvent.click(copyButtons[0]);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(
          expect.stringMatching(/\/#[a-z0-9-]+$/i),
        );
      });
    });
  });
});
