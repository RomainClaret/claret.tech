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
    // Once each: the timeline drew three copies of every badge, for
    // computers, tablets and phones, two of them hidden by CSS.
    for (const membership of educationInfo.memberships) {
      expect(screen.getAllByText(membership.name)).toHaveLength(1);
    }
    expect(container.querySelectorAll("svg.lucide-users")).toHaveLength(
      educationInfo.memberships.length,
    );
  });

  it("folds both badge grids on a phone behind a Show all of its own", () => {
    render(
      <AnimationStateProvider>
        <Education />
      </AnimationStateProvider>,
    );

    expect(
      screen.getByRole("button", {
        name: `Show all ${educationInfo.certifications.length} certifications`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: `Show all ${educationInfo.memberships.length} memberships`,
      }),
    ).toBeInTheDocument();
    // 3 and 4 of them show on a phone, the newest.
    expect(document.querySelectorAll("[data-fold]")).toHaveLength(
      educationInfo.certifications.length -
        3 +
        educationInfo.memberships.length -
        4,
    );
  });
});
