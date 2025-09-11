import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IntroductionContent } from "./IntroductionContent";

// Mock dependencies
vi.mock("@/components/ui/TypeWriter", () => ({
  TypeWriter: ({ strings }: { strings: string[] }) => (
    <div data-testid="typewriter">{JSON.stringify(strings)}</div>
  ),
}));

vi.mock("@/components/ui/SocialLinks", () => ({
  SocialLinks: () => <div data-testid="social-links">Social Links</div>,
}));

vi.mock("@/components/ui/protected-lucide-icon", () => ({
  ProtectedLucideIcon: ({
    Icon,
    ...props
  }: {
    Icon?: React.ComponentType;
    [key: string]: unknown;
  }) => {
    if (!Icon) return <div data-testid="protected-icon" {...props} />;
    return <Icon {...props} />;
  },
}));

vi.mock("lucide-react", () => ({
  FileText: (props: React.ComponentProps<"div">) => (
    <div data-testid="file-text-icon" {...props} />
  ),
  Mail: (props: React.ComponentProps<"div">) => (
    <div data-testid="mail-icon" {...props} />
  ),
}));

vi.mock("@/data/portfolio", () => ({
  greeting: {
    titleGreeting: "Accuracy is a lie",
    titleGreetingNewline: "I am Romain,",
    titleGreetingTitleList: ["Developer", 700, "Designer", 700, "Creator", 700],
    subTitle: "I create amazing web experiences",
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: (...classes: (string | undefined | null | boolean)[]) =>
    classes.filter(Boolean).join(" "),
}));

describe("IntroductionContent", () => {
  const mockProps = {
    onResumeClick: vi.fn(),
    onContactClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders greeting content correctly", () => {
    render(<IntroductionContent {...mockProps} />);

    expect(screen.getByText("Accuracy")).toBeInTheDocument();
    expect(screen.getByText("is a lie")).toBeInTheDocument();
    expect(
      screen.getByText("I create amazing web experiences"),
    ).toBeInTheDocument();
  });

  it("renders TypeWriter with correct strings", () => {
    render(<IntroductionContent {...mockProps} />);

    const typewriter = screen.getByTestId("typewriter");
    expect(typewriter).toBeInTheDocument();
    expect(typewriter).toHaveTextContent('["Developer","Designer","Creator"]');
  });

  it("renders social links", () => {
    render(<IntroductionContent {...mockProps} />);

    expect(screen.getByTestId("social-links")).toBeInTheDocument();
  });

  it("renders action buttons", () => {
    render(<IntroductionContent {...mockProps} />);

    const resumeButton = screen.getByText("View Resume");
    const contactButton = screen.getByText("Contact Me");

    expect(resumeButton).toBeInTheDocument();
    expect(contactButton).toBeInTheDocument();
  });

  it("handles resume button click", () => {
    render(<IntroductionContent {...mockProps} />);

    const resumeButton = screen.getByText("View Resume");
    fireEvent.click(resumeButton);

    expect(mockProps.onResumeClick).toHaveBeenCalledTimes(1);
  });

  it("handles contact button click", () => {
    render(<IntroductionContent {...mockProps} />);

    const contactButton = screen.getByText("Contact Me");
    fireEvent.click(contactButton);

    expect(mockProps.onContactClick).toHaveBeenCalledTimes(1);
  });

  it("renders button icons", () => {
    render(<IntroductionContent {...mockProps} />);

    expect(screen.getByTestId("file-text-icon")).toBeInTheDocument();
    expect(screen.getByTestId("mail-icon")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <IntroductionContent {...mockProps} className="custom-class" />,
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("has proper semantic structure", () => {
    render(<IntroductionContent {...mockProps} />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent("Accuracy is a lie");
  });

  it("has accessible button attributes", () => {
    render(<IntroductionContent {...mockProps} />);

    const resumeButton = screen.getByText("View Resume");
    const contactButton = screen.getByText("Contact Me");

    expect(resumeButton).toHaveAttribute("type", "button");
    expect(contactButton).toHaveAttribute("type", "button");
  });
});
