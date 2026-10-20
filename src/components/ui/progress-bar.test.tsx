import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MultiPhaseProgress } from "./progress-bar";

/**
 * Each phase's colours come from its state alone. An error used to be
 * added on top of the phase's own colours, which only tailwind-merge
 * settled (the later class won); cn() no longer runs it.
 */

const phase = (
  name: string,
  status: "pending" | "active" | "completed" | "error",
) => ({ name, status, progress: 50 });

describe("MultiPhaseProgress", () => {
  it("colours the done, current and next phases", () => {
    render(
      <MultiPhaseProgress
        phases={[
          phase("Collect", "completed"),
          phase("Measure", "active"),
          phase("Report", "pending"),
        ]}
        currentPhase={1}
      />,
    );

    expect(screen.getByText("✓")).toHaveClass("bg-green-700", "text-white");
    expect(screen.getByText("2")).toHaveClass(
      "bg-primary",
      "text-primary-foreground",
    );
    expect(screen.getByText("3")).toHaveClass(
      "bg-muted",
      "text-muted-foreground",
    );
    expect(screen.getByText("Measure")).toHaveClass("text-foreground");
    expect(screen.getByText("Report")).toHaveClass("text-muted-foreground");
  });

  it("colours a failed phase red, whether done or current", () => {
    render(
      <MultiPhaseProgress
        phases={[phase("Collect", "error"), phase("Measure", "error")]}
        currentPhase={1}
      />,
    );

    const done = screen.getByText("✓");
    expect(done).toHaveClass("bg-red-700", "text-white");
    expect(done).not.toHaveClass("bg-green-700");
    const current = screen.getByText("2");
    expect(current).toHaveClass("bg-red-700");
    expect(current).not.toHaveClass("bg-primary");
    const name = screen.getByText("Measure");
    expect(name).toHaveClass("text-red-700");
    expect(name).not.toHaveClass("text-foreground");
  });
});
