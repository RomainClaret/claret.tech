import { describe, it, expect } from "vitest";
import { useLayoutEffect } from "react";
import { render } from "@testing-library/react";
import { AnimatePresence } from "./animate-presence";

/**
 * The site's stand-in for framer's AnimatePresence. It has no exit
 * animation, so its children show and leave in the commit that adds or
 * removes them; it copied them into state after each commit, one commit
 * late, which kept the terminal window on screen a commit after closing.
 */
describe("AnimatePresence", () => {
  it("shows and removes its children in the same commit", () => {
    // What the page holds at each commit, read after its DOM changes.
    const commits: boolean[] = [];
    function Witness() {
      useLayoutEffect(() => {
        commits.push(document.querySelector("[data-testid=panel]") !== null);
      });
      return null;
    }
    const page = (open: boolean) => (
      <>
        <AnimatePresence>
          {open && <p data-testid="panel">panel</p>}
        </AnimatePresence>
        <Witness />
      </>
    );

    const { rerender } = render(page(false));
    commits.length = 0;
    rerender(page(true));
    expect(commits[0]).toBe(true);

    commits.length = 0;
    rerender(page(false));
    expect(commits[0]).toBe(false);
  });

  it("shows only the first child in wait mode", () => {
    const { container } = render(
      <AnimatePresence mode="wait">
        <p key="a">a</p>
        <p key="b">b</p>
      </AnimatePresence>,
    );

    expect(container.textContent).toBe("a");
  });
});
