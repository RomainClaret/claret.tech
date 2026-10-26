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

  it("folds a phone's list to the newest, the rest a tap away", () => {
    // 15 badges stacked 1,350 px on a phone (2026-10-26). The folded ones
    // stay in the HTML, hidden below sm, for layout.tsx's <noscript> style
    // to show when scripts are off.
    const three = [
      { name: "Oldest", issuer: "A", year: "2015" },
      { name: "Newest", issuer: "C", year: "2022" },
      { name: "Middle", issuer: "B", year: "2020" },
    ];
    const { container } = render(
      <CertificationTimeline
        certifications={three}
        phoneCount={1}
        itemsLabel="badges"
      />,
    );
    const item = (name: string) =>
      screen.getByText(name).closest("[style*='--rank']") as HTMLElement;
    const folded = () =>
      ["Oldest", "Middle", "Newest"].filter((name) =>
        item(name).classList.contains("max-sm:hidden"),
      );

    // Oldest first in the HTML, newest first on a phone (CSS order).
    expect(
      ["Oldest", "Middle", "Newest"].map((n) =>
        item(n).style.getPropertyValue("--rank"),
      ),
    ).toEqual(["2", "1", "0"]);
    expect(folded()).toEqual(["Oldest", "Middle"]);
    expect(item("Oldest").hasAttribute("data-fold")).toBe(true);
    expect(item("Newest").hasAttribute("data-fold")).toBe(false);

    const button = screen.getByRole("button", { name: "Show all 3 badges" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button.getAttribute("aria-controls")).toBe(
      container.querySelector(".grid")!.id,
    );
    // Phones alone: from sm the button's row is hidden.
    expect(button.closest("[data-fold-toggle]")).toHaveClass("sm:hidden");

    fireEvent.click(button);
    expect(button).toHaveAccessibleName("Show fewer badges");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(folded()).toEqual([]);

    fireEvent.click(button);
    expect(folded()).toEqual(["Oldest", "Middle"]);
  });

  it("folds nothing without a phone count, or when it covers every badge", () => {
    const { rerender } = render(
      <CertificationTimeline certifications={badges} />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<CertificationTimeline certifications={badges} phoneCount={2} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector("[data-fold]")).toBeNull();
  });
});
