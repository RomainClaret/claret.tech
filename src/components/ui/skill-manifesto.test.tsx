import { describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { SkillManifesto } from "./skill-manifesto";

// The visitor's reduced-motion setting (useReducedMotion).
const motion = vi.hoisted(() => ({ reduce: false }));
vi.mock("@/lib/hooks/useReducedMotion", () => ({
  useReducedMotion: () => motion.reduce,
}));

const skills = ["🧠 Evolving networks", "🐧 Penguin colonies", "Plain skill"];
// The sentence button is named by its text (and its emoji).
const SENTENCE = /Evolving networks/;

// Presses a button the way a keyboard does: focused first, then activated.
function press(name: string | RegExp) {
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
      expect(screen.getByRole("button", { name: SENTENCE })).toHaveFocus();
    });

    it("takes no focus on its first render", () => {
      render(<SkillManifesto skills={skills} />);

      expect(document.body).toHaveFocus();
    });
  });

  // The sentence and the list's rows were divs that only a click reached,
  // so a keyboard could neither open the card view nor pick a skill.
  describe("Keyboard", () => {
    it("opens the card view from the sentence, and goes back to it", () => {
      render(<SkillManifesto skills={skills} />);

      expect(
        screen.getByRole("button", { name: SENTENCE }),
      ).toHaveAccessibleDescription("Opens the card view");
      press(SENTENCE);
      expect(
        screen.getByRole("button", { name: "Compact view" }),
      ).toHaveFocus();
      expect(screen.getByText("Evolving networks")).toBeInTheDocument();

      press("Compact view");
      expect(screen.getByRole("button", { name: SENTENCE })).toHaveFocus();
    });

    it("picks a skill from the list", () => {
      render(<SkillManifesto skills={skills} />);

      press("Show all");
      press("Plain skill");

      expect(
        screen.getByRole("button", { name: "Compact view" }),
      ).toHaveFocus();
      expect(screen.getByText("Skill 3 of 3")).toBeInTheDocument();
      expect(screen.getByText("Plain skill")).toBeInTheDocument();
    });

    // The sentence is a button now: rotating it under the keyboard would
    // change what Enter opens.
    it("holds the rotation while focus is inside, and resumes after", () => {
      vi.useFakeTimers();
      try {
        render(
          <>
            <button>Before</button>
            <SkillManifesto skills={skills} autoPlayDelay={1000} />
          </>,
        );
        act(() => vi.advanceTimersByTime(1000));
        expect(screen.getByText("Skill 2 of 3")).toBeInTheDocument();

        act(() => screen.getByRole("button", { name: "Next skill" }).focus());
        // Two steps, not three: three wrap around to the same skill.
        act(() => vi.advanceTimersByTime(2000));
        expect(screen.getByText("Skill 2 of 3")).toBeInTheDocument();

        act(() => screen.getByRole("button", { name: "Before" }).focus());
        act(() => vi.advanceTimersByTime(1000));
        expect(screen.getByText("Skill 3 of 3")).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // framer keeps opacity animations under reduced motion, so for a visitor
  // who asked for less motion the sentence still faded out and in every few
  // seconds. It waits for them now (Romain, 2026-10-22).
  describe("Reduced motion", () => {
    it("holds the first sentence until the visitor presses Play", () => {
      vi.useFakeTimers();
      motion.reduce = true;
      try {
        render(<SkillManifesto skills={skills} autoPlayDelay={1000} />);
        act(() => vi.advanceTimersByTime(3000));
        expect(screen.getByText("Skill 1 of 3")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Play" }));
        act(() => vi.advanceTimersByTime(1000));
        expect(screen.getByText("Skill 2 of 3")).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "Pause" }),
        ).toBeInTheDocument();
      } finally {
        motion.reduce = false;
        vi.useRealTimers();
      }
    });
  });

  // The dots were the controls: one button per skill, 6 by 6 px, where WCAG
  // 2.2 asks for a 24 px target (Lighthouse 13 failed target-size on them).
  describe("Controls", () => {
    it("steps through the skills with Previous and Next, wrapping around", async () => {
      render(<SkillManifesto skills={skills} />);

      fireEvent.click(screen.getByRole("button", { name: "Next skill" }));
      expect(await screen.findByText("Penguin colonies")).toBeInTheDocument();
      expect(screen.getByText("Skill 2 of 3")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Previous skill" }));
      fireEvent.click(screen.getByRole("button", { name: "Previous skill" }));
      expect(await screen.findByText("Plain skill")).toBeInTheDocument();
      expect(screen.getByText("Skill 3 of 3")).toBeInTheDocument();
    });

    it("shows its progress without a button per skill", () => {
      render(<SkillManifesto skills={skills} />);

      // Four controls and the sentence, whatever the number of skills.
      expect(
        screen
          .getAllByRole("button")
          .map((button) => button.getAttribute("aria-label")),
      ).toEqual(["Previous skill", "Next skill", "Pause", "Show all", null]);
      expect(screen.getByRole("button", { name: SENTENCE })).toBeVisible();
    });

    it("gives every button a 24 px target, in each mode", () => {
      render(<SkillManifesto skills={skills} />);
      // Icon controls are 24 by 24; the sentence and the list's rows are
      // wider than that, and at least 24 tall.
      const expectTargets = () => {
        for (const button of screen.getAllByRole("button")) {
          expect(
            button.classList.contains("size-6") ||
              button.classList.contains("min-h-6"),
          ).toBe(true);
        }
      };
      expectTargets();

      fireEvent.click(screen.getByText("Evolving networks"));
      expect(
        screen.getByRole("button", { name: "List view" }),
      ).toBeInTheDocument();
      expectTargets();

      press("List view");
      expect(screen.getAllByRole("button")).toHaveLength(skills.length + 1);
      expectTargets();
    });
  });
});
