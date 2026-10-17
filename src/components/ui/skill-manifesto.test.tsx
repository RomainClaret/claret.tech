import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkillManifesto } from "./skill-manifesto";

const skills = ["🧠 Evolving networks", "🐧 Penguin colonies", "Plain skill"];

// Presses a button the way a keyboard does: focused first, then activated.
function press(name: string) {
  const button = screen.getByRole("button", { name });
  button.focus();
  fireEvent.click(button);
}

describe("SkillManifesto", () => {
  // Each mode renders its own controls, so the button just pressed leaves the
  // page. Focus must land on the new mode's control, not fall back to <body>.
  describe("Focus on mode switches", () => {
    it("moves focus to Close list view on Show all, and back", () => {
      render(<SkillManifesto skills={skills} />);

      press("Show all");
      expect(
        screen.getByRole("button", { name: "Close list view" }),
      ).toHaveFocus();

      press("Close list view");
      expect(screen.getByRole("button", { name: "Show all" })).toHaveFocus();
    });

    it("moves focus from the expanded view's switches to the next mode's control", () => {
      render(<SkillManifesto skills={skills} />);
      fireEvent.click(screen.getByText("Evolving networks"));

      press("List view");
      expect(
        screen.getByRole("button", { name: "Close list view" }),
      ).toHaveFocus();

      press("Close list view");
      fireEvent.click(screen.getByText("Evolving networks"));
      press("Compact view");
      expect(screen.getByRole("button", { name: "Show all" })).toHaveFocus();
    });

    it("takes no focus on its first render, nor when the skill text is clicked", () => {
      render(<SkillManifesto skills={skills} />);
      expect(document.body).toHaveFocus();

      fireEvent.click(screen.getByText("Evolving networks"));

      expect(
        screen.getByRole("button", { name: "List view" }),
      ).toBeInTheDocument();
      expect(document.body).toHaveFocus();
    });
  });
});
