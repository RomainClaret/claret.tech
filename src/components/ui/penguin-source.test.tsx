import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PenguinSource } from "./penguin-source";

describe("PenguinSource (view-source easter egg)", () => {
  it("embeds a hidden penguin comment in the rendered HTML", () => {
    const { container } = render(<PenguinSource />);
    const html = container.innerHTML;

    // The comment is present in the source (this is the View-Source surface).
    expect(html).toContain("<!--");
    expect(html).toContain("-->");
    // Breadcrumb to the terminal easter egg + colony voice.
    expect(html).toContain("penguin");
    expect(html).toContain("The colony respects the curious");
  });

  it("renders nothing visible on the page", () => {
    const { container } = render(<PenguinSource />);
    const div = container.querySelector("div");
    expect(div).toHaveAttribute("hidden");
    // A comment node contributes no textContent, so nothing shows.
    expect(container.textContent).toBe("");
  });

  it("uses a comment-safe penguin: no bare -- inside the comment body", () => {
    const { container } = render(<PenguinSource />);
    // Drop the opening and closing comment delimiters, then ensure the payload
    // holds no stray "--" (which is invalid inside an HTML comment).
    const inner = container.innerHTML.replace("<!--", "").replace("-->", "");
    expect(inner).not.toContain("--");
  });
});
