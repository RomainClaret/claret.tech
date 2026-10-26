import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CertificationTimeline } from "./certification-timeline";

const badges = [
  { name: "Later", issuer: "Somewhere", year: "2022-present" },
  { name: "Earlier", issuer: "Elsewhere", year: "2015-2017" },
];

describe("CertificationTimeline", () => {
  it("draws each badge once, oldest first, its year on the issuer line below md", () => {
    // It drew a desktop, a tablet and a phone copy of every badge, two of
    // them hidden by CSS: 524 elements where 200 showed (2026-10-26).
    const { container } = render(
      <CertificationTimeline certifications={badges} />,
    );

    expect(screen.getAllByText("Earlier")).toHaveLength(1);
    expect(screen.getAllByText("Later")).toHaveLength(1);
    expect(container.querySelectorAll("svg")).toHaveLength(2);
    const names = [...container.querySelectorAll(".font-medium.text-sm")];
    expect(names.map((name) => name.textContent)).toEqual(["Earlier", "Later"]);
    // The year twice, one of them hidden at every width.
    const years = screen.getAllByText(/2015-2017/);
    expect(years.map((year) => year.closest(".md\\:hidden, .hidden"))).toEqual([
      expect.anything(),
      expect.anything(),
    ]);
  });

  it("lights a badge for a mouse, not for a finger", () => {
    render(<CertificationTimeline certifications={badges} />);
    const badge = screen.getByText("Earlier").closest(".rounded-lg")!;
    const wrapper = badge.parentElement!;
    const lit = () => (badge as HTMLElement).style.backgroundColor;
    const unlit = lit();

    fireEvent.pointerEnter(wrapper, { pointerType: "touch" });
    expect(lit()).toBe(unlit);
    fireEvent.pointerEnter(wrapper, { pointerType: "mouse" });
    expect(lit()).not.toBe(unlit);
    fireEvent.pointerLeave(wrapper, { pointerType: "mouse" });
    expect(lit()).toBe(unlit);
  });
});
