import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Contact } from "./Contact";

// Mock external components and utilities
vi.mock("@/components/ui/animated", () => ({
  FadeIn: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <div data-testid="fade-in" {...props}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/education-style-card", () => ({
  EducationStyleCard: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <div data-testid="education-style-card" {...props}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/ui/protected-lucide-icon", () => ({
  ProtectedLucideIcon: ({
    Icon,
    ...props
  }: {
    Icon?: React.ComponentType<unknown>;
    [key: string]: unknown;
  }) => {
    if (!Icon) return <div data-testid="protected-icon" {...props} />;
    const IconComponent = Icon;
    return <IconComponent {...props} />;
  },
}));

// Mock icons
vi.mock("@/components/icons", () => ({
  GitHubIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="github-icon" data-size={size} className={className}>
      GitHub
    </div>
  ),
  LinkedInIcon: ({
    className,
    style,
  }: {
    className?: string;
    style?: React.CSSProperties;
  }) => (
    <div data-testid="linkedin-icon" className={className} style={style}>
      LinkedIn
    </div>
  ),
}));

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  Mail: (props: { [key: string]: unknown }) => (
    <div data-testid="mail-icon" {...props}>
      Mail
    </div>
  ),
  Twitter: (props: { [key: string]: unknown }) => (
    <div data-testid="twitter-icon" {...props}>
      Twitter
    </div>
  ),
}));

// Mock Next.js components
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    target,
    rel,
    ...props
  }: {
    children: React.ReactNode;
    href?: string;
    target?: string;
    rel?: string;
    [key: string]: unknown;
  }) => (
    <a href={href} target={target} rel={rel} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    width,
    height,
    priority,
    placeholder,
    blurDataURL,
    ...props
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    priority?: boolean;
    placeholder?: string;
    blurDataURL?: string;
    [key: string]: unknown;
  }) => {
    const imgProps: { [key: string]: unknown } = {
      src,
      alt,
      width,
      height,
      "data-testid": "next-image",
      ...props,
    };

    // Handle boolean props correctly - when priority is present without value, it's truthy
    if (priority !== undefined)
      imgProps.priority = priority === true ? "" : priority;
    if (placeholder !== undefined) imgProps.placeholder = placeholder;
    if (blurDataURL !== undefined) imgProps.blurDataURL = blurDataURL;

    // eslint-disable-next-line @next/next/no-img-element
    return <img {...imgProps} alt={(imgProps.alt as string) || "Image"} />;
  },
}));

// Mock Framer Motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      [key: string]: unknown;
    }) => <div {...props}>{children}</div>,
  },
}));

// Mock portfolio data
vi.mock("@/data/portfolio", () => ({
  contactInfo: {
    title: "Get in Touch",
    subtitle: {
      highlightedText: "Let's collaborate",
      normalText: " on exciting projects",
    },
    emailAddress: "contact@example.com",
    emailDesc: "Send me an email",
    twitterUrl: "https://twitter.com/username",
    twitterDesc: "Follow me on Twitter",
    newTab: true,
  },
  socialMediaLinks: {
    github: "https://github.com/username",
    linkedin: "https://linkedin.com/in/username",
  },
}));

// Mock environment variables
Object.defineProperty(process, "env", {
  value: {
    NEXT_PUBLIC_GH_USERNAME: "testuser",
  },
});

describe("Contact Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders contact section with title and subtitle", () => {
      render(<Contact />);

      expect(screen.getByText("Get in Touch")).toBeInTheDocument();
      expect(screen.getByText("Let's collaborate")).toBeInTheDocument();
      expect(screen.getByText("on exciting projects")).toBeInTheDocument();
    });

    it("renders all contact method cards", () => {
      render(<Contact />);

      expect(screen.getByText("Send me an email")).toBeInTheDocument();
      expect(screen.getByText("Follow me on Twitter")).toBeInTheDocument();
      expect(screen.getByText("Connect on LinkedIn")).toBeInTheDocument();
    });

    it("wraps content in animation components", () => {
      render(<Contact />);

      expect(screen.getByTestId("fade-in")).toBeInTheDocument();
    });

    it("renders education style cards for each contact method", () => {
      render(<Contact />);

      const educationCards = screen.getAllByTestId("education-style-card");
      expect(educationCards.length).toBeGreaterThanOrEqual(4); // Email, Twitter, LinkedIn, GitHub avatar
    });
  });

  describe("Email Contact", () => {
    it("renders email contact information", () => {
      render(<Contact />);

      expect(screen.getByText("Send me an email")).toBeInTheDocument();
      expect(screen.getByText("contact@example.com")).toBeInTheDocument();
    });

    it("creates proper mailto link", () => {
      render(<Contact />);

      const emailLink = screen.getByText("Send me an email").closest("a");
      expect(emailLink).toHaveAttribute("href", "mailto:contact@example.com");
    });

    it("renders mail icon", () => {
      render(<Contact />);

      expect(screen.getByTestId("mail-icon")).toBeInTheDocument();
    });

    it("email link is clickable", () => {
      render(<Contact />);

      const emailCard = screen.getByText("Send me an email").closest("a");
      expect(emailCard).toBeInTheDocument();
      expect(emailCard).toHaveAttribute("href", "mailto:contact@example.com");
    });
  });

  describe("Twitter Contact", () => {
    it("renders Twitter contact information", () => {
      render(<Contact />);

      expect(screen.getByText("Follow me on Twitter")).toBeInTheDocument();
      expect(screen.getByText("@username")).toBeInTheDocument();
    });

    it("creates proper Twitter link with target and rel attributes", () => {
      render(<Contact />);

      const twitterLink = screen.getByText("Follow me on Twitter").closest("a");
      expect(twitterLink).toHaveAttribute(
        "href",
        "https://twitter.com/username",
      );
      expect(twitterLink).toHaveAttribute("target", "_blank");
      expect(twitterLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("renders Twitter icon", () => {
      render(<Contact />);

      expect(screen.getByTestId("twitter-icon")).toBeInTheDocument();
    });

    it("extracts username from Twitter URL", () => {
      render(<Contact />);

      expect(screen.getByText("@username")).toBeInTheDocument();
    });
  });

  describe("LinkedIn Contact", () => {
    it("renders LinkedIn contact information", () => {
      render(<Contact />);

      expect(screen.getByText("Connect on LinkedIn")).toBeInTheDocument();
      expect(screen.getByText("@RomainClaret")).toBeInTheDocument();
    });

    it("creates proper LinkedIn link with external attributes", () => {
      render(<Contact />);

      const linkedinLink = screen.getByText("Connect on LinkedIn").closest("a");
      expect(linkedinLink).toHaveAttribute(
        "href",
        "https://linkedin.com/in/username",
      );
      expect(linkedinLink).toHaveAttribute("target", "_blank");
      expect(linkedinLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("renders LinkedIn icon", () => {
      render(<Contact />);

      expect(screen.getByTestId("linkedin-icon")).toBeInTheDocument();
    });
  });

  describe("GitHub Profile", () => {
    it("renders GitHub profile avatar", () => {
      render(<Contact />);

      const avatar = screen.getByTestId("next-image");
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute("src", "https://github.com/testuser.png");
      expect(avatar).toHaveAttribute("alt", "GitHub Profile");
      expect(avatar).toHaveAttribute("width", "300");
      expect(avatar).toHaveAttribute("height", "300");
    });

    it("renders GitHub icon button", () => {
      render(<Contact />);

      expect(screen.getByTestId("github-icon")).toBeInTheDocument();
      expect(screen.getByTestId("github-icon")).toHaveAttribute(
        "data-size",
        "28",
      );
    });

    it("GitHub icon links to profile", () => {
      render(<Contact />);

      const githubLink = screen.getByLabelText("GitHub Profile");
      expect(githubLink).toBeInTheDocument();
      expect(githubLink).toHaveAttribute("href", "https://github.com/username");
      expect(githubLink).toHaveAttribute("target", "_blank");
      expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("falls back to default username when env var not set", () => {
      // Override the environment variable
      Object.defineProperty(process, "env", {
        value: {},
      });

      render(<Contact />);

      const avatar = screen.getByTestId("next-image");
      expect(avatar).toHaveAttribute(
        "src",
        "https://github.com/RomainClaret.png",
      );
    });
  });

  describe("Layout and Structure", () => {
    it("has proper grid layout structure", () => {
      const { container } = render(<Contact />);

      // Check for grid layout classes
      const gridContainer = container.querySelector(".lg\\:grid-cols-2");
      expect(gridContainer).toBeInTheDocument();
    });

    it("organizes contact methods in left column", () => {
      render(<Contact />);

      // All contact method cards should be present
      expect(screen.getByText("Send me an email")).toBeInTheDocument();
      expect(screen.getByText("Follow me on Twitter")).toBeInTheDocument();
      expect(screen.getByText("Connect on LinkedIn")).toBeInTheDocument();
    });

    it("places GitHub avatar in right column", () => {
      render(<Contact />);

      expect(screen.getByTestId("next-image")).toBeInTheDocument();
      expect(screen.getByTestId("github-icon")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper semantic structure", () => {
      render(<Contact />);

      // Check for proper heading
      const heading = screen.getByRole("heading", { name: "Get in Touch" });
      expect(heading).toBeInTheDocument();
    });

    it("provides proper alt text for images", () => {
      render(<Contact />);

      const avatar = screen.getByAltText("GitHub Profile");
      expect(avatar).toBeInTheDocument();
    });

    it("has aria-label for GitHub profile link", () => {
      render(<Contact />);

      const githubLink = screen.getByLabelText("GitHub Profile");
      expect(githubLink).toBeInTheDocument();
    });

    it("all links are keyboard accessible", () => {
      render(<Contact />);

      const emailLink = screen.getByText("Send me an email").closest("a");
      const twitterLink = screen.getByText("Follow me on Twitter").closest("a");
      const linkedinLink = screen.getByText("Connect on LinkedIn").closest("a");
      const githubLink = screen.getByLabelText("GitHub Profile");

      expect(emailLink).toBeInTheDocument();
      expect(twitterLink).toBeInTheDocument();
      expect(linkedinLink).toBeInTheDocument();
      expect(githubLink).toBeInTheDocument();
    });
  });

  describe("External Link Security", () => {
    it("uses proper rel attributes for external links", () => {
      render(<Contact />);

      const twitterLink = screen.getByText("Follow me on Twitter").closest("a");
      const linkedinLink = screen.getByText("Connect on LinkedIn").closest("a");
      const githubLink = screen.getByLabelText("GitHub Profile");

      expect(twitterLink).toHaveAttribute("rel", "noopener noreferrer");
      expect(linkedinLink).toHaveAttribute("rel", "noopener noreferrer");
      expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("uses proper target attributes for external links", () => {
      render(<Contact />);

      const twitterLink = screen.getByText("Follow me on Twitter").closest("a");
      const linkedinLink = screen.getByText("Connect on LinkedIn").closest("a");
      const githubLink = screen.getByLabelText("GitHub Profile");

      expect(twitterLink).toHaveAttribute("target", "_blank");
      expect(linkedinLink).toHaveAttribute("target", "_blank");
      expect(githubLink).toHaveAttribute("target", "_blank");
    });

    it("email link does not have target or rel attributes", () => {
      render(<Contact />);

      const emailLink = screen.getByText("Send me an email").closest("a");

      expect(emailLink).not.toHaveAttribute("target");
      expect(emailLink).not.toHaveAttribute("rel");
    });
  });

  describe("Image Optimization", () => {
    it("GitHub avatar has proper optimization attributes", () => {
      render(<Contact />);

      const avatar = screen.getByTestId("next-image");

      expect(avatar).toHaveAttribute("priority");
      expect(avatar).toHaveAttribute("placeholder", "blur");
      expect(avatar).toHaveAttribute("blurDataURL");
    });

    it("avatar has proper dimensions", () => {
      render(<Contact />);

      const avatar = screen.getByTestId("next-image");

      expect(avatar).toHaveAttribute("width", "300");
      expect(avatar).toHaveAttribute("height", "300");
    });
  });

  describe("Interactive Elements", () => {
    it("contact cards are interactive", () => {
      render(<Contact />);

      // All contact method cards should be wrapped in links
      const emailCard = screen.getByText("Send me an email").closest("a");
      const twitterCard = screen.getByText("Follow me on Twitter").closest("a");
      const linkedinCard = screen.getByText("Connect on LinkedIn").closest("a");

      expect(emailCard).toBeInTheDocument();
      expect(twitterCard).toBeInTheDocument();
      expect(linkedinCard).toBeInTheDocument();
    });

    it("GitHub profile elements are interactive", () => {
      render(<Contact />);

      const githubButton = screen.getByLabelText("GitHub Profile");
      expect(githubButton).toBeInTheDocument();

      // Test click event (doesn't actually navigate in test)
      fireEvent.click(githubButton);
      expect(githubButton).toBeInTheDocument();
    });
  });

  describe("Styling and Colors", () => {
    it("applies contact-specific color schemes", () => {
      render(<Contact />);

      // Check for education style cards which should receive color props
      const educationCards = screen.getAllByTestId("education-style-card");
      expect(educationCards.length).toBeGreaterThan(0);

      // Cards should have glow color attributes
      educationCards.forEach((card) => {
        expect(card).toHaveAttribute("glowcolor");
      });
    });
  });

  describe("Content Validation", () => {
    it("displays correct contact information", () => {
      render(<Contact />);

      // Email
      expect(screen.getByText("contact@example.com")).toBeInTheDocument();

      // Social handles
      expect(screen.getByText("@username")).toBeInTheDocument();
      expect(screen.getByText("@RomainClaret")).toBeInTheDocument();
    });

    it("formats Twitter username correctly", () => {
      render(<Contact />);

      // Should extract username from URL and add @ prefix
      const twitterHandle = screen.getByText("@username");
      expect(twitterHandle).toBeInTheDocument();
    });
  });
});
