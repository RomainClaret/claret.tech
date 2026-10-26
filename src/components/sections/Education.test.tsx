import { describe, it, expect } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Education } from "./Education";
import { educationInfo } from "@/data/portfolio";
import { AnimationStateProvider } from "@/contexts/animation-state-context";

describe("Education", () => {
  // A school's thesis row was a div with a click handler: no Tab stop, no
  // state, so its bullets were out of a keyboard's reach. It is a native
  // disclosure now, which opens from the keyboard and works without scripts.
  it("opens a thesis from its summary, a native disclosure", () => {
    render(
      <AnimationStateProvider>
        <Education />
      </AnimationStateProvider>,
    );
    const school = educationInfo.schools.find(
      (entry) => entry.descBullets.length > 0,
    )!;

    const summary = screen.getByText(school.desc).closest("summary");
    expect(summary).not.toBeNull();
    const details = summary!.closest("details")!;
    expect(details.open).toBe(false);
    // In the page while closed, for find-in-page and readers without
    // scripts; the closed disclosure hides them.
    expect(
      within(details).getByText(school.descBullets[0]),
    ).toBeInTheDocument();

    fireEvent.click(summary!);

    expect(details.open).toBe(true);
  });

  it("lists the memberships under their own heading, as group badges", () => {
    const { container } = render(
      <AnimationStateProvider>
        <Education />
      </AnimationStateProvider>,
    );

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: educationInfo.membershipSection.title,
      }),
    ).toBeInTheDocument();
    // The timeline draws every badge three times, for computers, tablets and
    // phones, and CSS shows one of them.
    for (const membership of educationInfo.memberships) {
      expect(screen.getAllByText(membership.name)).toHaveLength(3);
    }
    expect(container.querySelectorAll("svg.lucide-users")).toHaveLength(
      educationInfo.memberships.length * 3,
    );
  });
});
