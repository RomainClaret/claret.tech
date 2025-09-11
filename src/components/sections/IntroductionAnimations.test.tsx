import { describe, it, expect, vi } from "vitest";

// Tests now enabled in CI with increased memory limits
import { render, screen } from "@testing-library/react";
import { IntroductionAnimations } from "./IntroductionAnimations";

// Mock all animation components
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
  SkillsNeuralCloud: ({ className }: { className?: string }) => (
    <div
      data-testid="skills-neural-cloud"
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className || ""}`}
    >
      Skills Neural Cloud
    </div>
  ),
}));

// Mock dynamic import for brain animation
vi.mock("next/dynamic", () => ({
  default: (
    importFn: () => Promise<unknown>,
    options: { loading?: () => React.ReactElement },
  ) => {
    const MockComponent = () => {
      // Always return the loading state since that's what actually renders
      if (options && options.loading) {
        const LoadingComponent = options.loading();
        // Add testid to the loading component for testing
        if (LoadingComponent && LoadingComponent.props) {
          return {
            ...LoadingComponent,
            props: {
              ...LoadingComponent.props,
              "data-testid": "dual-brain-animation",
            },
          };
        }
        return (
          <div
            data-testid="dual-brain-animation"
            className="w-full max-w-lg mx-auto aspect-square bg-transparent"
          />
        );
      }
      return <div data-testid="dual-brain-animation">Brain Animation</div>;
    };
    MockComponent.displayName = "DynamicBrainAnimation";
    return MockComponent;
  },
}));

describe("IntroductionAnimations", () => {
  it("renders all background animation components when visible", () => {
    render(<IntroductionAnimations isVisible={true} />);

    expect(screen.getByTestId("shooting-stars")).toBeInTheDocument();
    expect(screen.getByTestId("grid-background")).toBeInTheDocument();
    expect(screen.getByTestId("neural-background")).toBeInTheDocument();
    expect(screen.getByTestId("skills-neural-cloud")).toBeInTheDocument();
  });

  it("renders background animation components without brain animations", () => {
    render(<IntroductionAnimations isVisible={true} />);

    // Should not have brain animations (they're now handled in Introduction.tsx)
    expect(
      screen.queryByTestId("dual-brain-animation"),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when not visible", () => {
    const { container } = render(<IntroductionAnimations isVisible={false} />);

    expect(container.firstChild).toBeNull();
  });

  it("defaults to visible when no isVisible prop provided", () => {
    render(<IntroductionAnimations />);

    expect(screen.getByTestId("shooting-stars")).toBeInTheDocument();
    expect(screen.getByTestId("grid-background")).toBeInTheDocument();
  });

  it("has proper layering structure", () => {
    render(<IntroductionAnimations isVisible={true} />);

    // Check that background effects container exists
    const backgroundContainer =
      screen.getByTestId("shooting-stars").parentElement;
    expect(backgroundContainer).toHaveClass(
      "absolute",
      "inset-0",
      "overflow-hidden",
    );

    // Check that skills cloud exists and has correct classes
    const skillsCloud = screen.getByTestId("skills-neural-cloud");
    expect(skillsCloud).toHaveClass(
      "absolute",
      "inset-0",
      "pointer-events-none",
      "overflow-hidden",
      "hidden",
      "md:block",
      "z-7",
    );
  });

  it("focuses only on background effects without brain animations", () => {
    render(<IntroductionAnimations isVisible={true} />);

    // Confirm this component only handles background effects
    expect(screen.getByTestId("shooting-stars")).toBeInTheDocument();
    expect(screen.getByTestId("grid-background")).toBeInTheDocument();
    expect(screen.getByTestId("neural-background")).toBeInTheDocument();
    expect(screen.getByTestId("skills-neural-cloud")).toBeInTheDocument();

    // Brain animations should not exist in this component
    expect(
      screen.queryByTestId("dual-brain-animation"),
    ).not.toBeInTheDocument();
  });

  it("applies correct positioning and styling", () => {
    render(<IntroductionAnimations isVisible={true} />);

    // Skills neural cloud positioning and classes
    const skillsCloud = screen.getByTestId("skills-neural-cloud");
    expect(skillsCloud).toHaveClass(
      "absolute",
      "inset-0",
      "pointer-events-none",
      "overflow-hidden",
      "hidden",
      "md:block",
      "z-7",
    );
  });
});
