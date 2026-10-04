import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Introduction } from "./Introduction";
import {
  DynamicImportFn,
  DynamicImportOptions,
  SlideInLeftProps,
  SlideInRightProps,
  TypeWriterProps,
  ConditionalMotionProps,
  ProtectedLucideIconProps,
  IconProps,
} from "@/test/mock-types";

// Mock dynamic imports
vi.mock("next/dynamic", () => ({
  default: (importFn: DynamicImportFn, options: DynamicImportOptions) => {
    const MockComponent = () => {
      try {
        return options && options.loading ? (
          options.loading()
        ) : (
          <div data-testid="dynamic-component" />
        );
      } catch {
        return (
          <div data-testid="dynamic-component-error">
            Dynamic component error
          </div>
        );
      }
    };
    MockComponent.displayName = "DynamicComponent";
    return MockComponent;
  },
}));

// Mock framer-motion to prevent IPC crashes
vi.mock("framer-motion", () => ({
  motion: {
    div: "div",
    span: "span",
    section: "section",
    h1: "h1",
    p: "p",
    // Simplified mocks to prevent IPC crashes
  },
  useAnimation: () => ({ start: vi.fn(), stop: vi.fn() }),
  useInView: () => true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock animated components
vi.mock("@/components/ui/animated", () => ({
  SlideInLeft: ({ children, ...props }: SlideInLeftProps) => (
    <div data-testid="slide-in-left" {...props}>
      {children}
    </div>
  ),
  SlideInRight: ({ children, ...props }: SlideInRightProps) => (
    <div data-testid="slide-in-right" {...props}>
      {children}
    </div>
  ),
}));

// Mock UI components
vi.mock("@/components/ui/TypeWriter", () => ({
  TypeWriter: ({ text }: TypeWriterProps) => (
    <div data-testid="typewriter">{text}</div>
  ),
}));

vi.mock("@/components/ui/SocialLinks", () => ({
  SocialLinks: () => <div data-testid="social-links">Social Links</div>,
}));

vi.mock("@/components/ui/shooting-stars", () => ({
  ShootingStars: () => <div data-testid="shooting-stars">Shooting Stars</div>,
}));

vi.mock("@/components/ui/grid-background", () => ({
  GridBackground: () => (
    <div data-testid="grid-background">Grid Background</div>
  ),
}));

vi.mock("@/components/ui/neural-background", () => ({
  NeuralBackground: () => (
    <div data-testid="neural-background">Neural Background</div>
  ),
}));

vi.mock("@/components/ui/interest-constellation", () => ({
  InterestConstellation: () => (
    <div data-testid="interest-constellation">Interest Constellation</div>
  ),
}));

vi.mock("@/components/ui/skills-neural-cloud", () => ({
  SkillsNeuralCloud: () => (
    <div data-testid="skills-neural-cloud">Skills Neural Cloud</div>
  ),
}));

vi.mock("@/components/ui/conditional-motion", () => ({
  ConditionalMotion: ({ children }: ConditionalMotionProps) => (
    <div data-testid="conditional-motion">{children}</div>
  ),
}));

vi.mock("@/components/ui/protected-lucide-icon", () => ({
  ProtectedLucideIcon: ({ Icon, ...props }: ProtectedLucideIconProps) => {
    if (!Icon) return <div data-testid="protected-icon" {...props} />;
    const IconComponent = Icon;
    return <IconComponent {...props} />;
  },
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  FileText: (props: IconProps) => (
    <div data-testid="file-text-icon" {...props} />
  ),
  Mail: (props: IconProps) => <div data-testid="mail-icon" {...props} />,
}));

// Mock hooks
const mockPDFViewer = {
  isOpen: false,
  pdfUrl: "",
  title: "",
  downloadFileName: "",
  openPDF: vi.fn(),
  closePDF: vi.fn(),
};

vi.mock("@/lib/hooks/usePDFViewer", () => ({
  usePDFViewer: () => mockPDFViewer,
}));

vi.mock("@/lib/hooks/useIntersectionObserver", () => ({
  useIntersectionObserver: vi.fn(() => [
    { current: null }, // proper ref object
    true, // isVisible
  ]),
}));

vi.mock("@/lib/hooks/useSafari", () => ({
  useShouldReduceAnimations: vi.fn(() => false),
  useIsSafari: vi.fn(() => false),
}));

// Mock contexts
// One function for the whole file, created once. Introduction's effect depends
// on generateBackgroundData's identity, as it should: the real provider memoizes
// it. A fresh vi.fn() per render changed that identity every time, so the effect
// re-ran, set new dimensions, re-rendered, and got another fresh function: an
// endless loop that allocated a mock per pass until the heap ran out.
const { mockGenerateBackgroundData } = vi.hoisted(() => ({
  mockGenerateBackgroundData: vi.fn(),
}));
vi.mock("@/contexts/background-context", () => ({
  useBackground: () => ({
    generateBackgroundData: mockGenerateBackgroundData,
    backgroundData: [],
    isLoading: false,
    error: null,
  }),
}));

// Mock data
vi.mock("@/data/portfolio", () => ({
  greeting: {
    titleGreetingNewline: "I am Romain,",
    titleGreetingTitleList: ["Developer", 700, "Designer", 700, "Creator", 700],
    subTitle: "A test subtitle.",
    resumeLink: "/pdfs/CV_RomainClaret.pdf",
    interests: [],
  },
}));

// Mock utils
vi.mock("@/lib/utils", () => ({
  cn: (...classes: (string | undefined | null | boolean)[]) =>
    classes.filter(Boolean).join(" "),
}));

/**
 * Introduction is the orchestration layer: IntroductionContent and
 * IntroductionAnimations have their own test files. What lives here is the
 * effect that sizes the background, and the two button handlers.
 */
describe("Introduction", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  it("generates the background once on mount, from the window size", () => {
    render(<Introduction />);

    // Once, not once per render. The effect keys on generateBackgroundData,
    // so an identity that changes every render turns it into a loop.
    expect(mockGenerateBackgroundData).toHaveBeenCalledTimes(1);
    expect(mockGenerateBackgroundData).toHaveBeenCalledWith(1024, 768, 64);
  });

  it("regenerates the background when the window is resized", () => {
    render(<Introduction />);

    window.innerWidth = 1440;
    window.innerHeight = 900;
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(mockGenerateBackgroundData).toHaveBeenLastCalledWith(1440, 900, 64);
  });

  it("removes its resize listener on unmount", () => {
    // Spies, which restoreMocks puts back after each test. This file used to
    // assign vi.fn() over window's listener methods and never restore them,
    // leaking a dead event API into whatever file ran next.
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Introduction />);

    const handler = add.mock.calls.find(([type]) => type === "resize")?.[1];
    expect(handler).toBeTypeOf("function");
    unmount();

    expect(remove).toHaveBeenCalledWith("resize", handler);
  });

  it("opens the resume in the in-app reader", () => {
    render(<Introduction />);

    fireEvent.click(screen.getByText("View Resume"));

    expect(mockPDFViewer.openPDF).toHaveBeenCalledWith(
      "/pdfs/CV_RomainClaret.pdf",
      "Resume - Romain Claret",
      "Romain_Claret_Resume.pdf",
    );
  });

  it("scrolls to the contact section", () => {
    const contact = document.createElement("section");
    contact.id = "contact";
    contact.scrollIntoView = vi.fn();
    document.body.appendChild(contact);
    render(<Introduction />);

    fireEvent.click(screen.getByText("Contact Me"));

    expect(contact.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
    contact.remove();
  });
});
