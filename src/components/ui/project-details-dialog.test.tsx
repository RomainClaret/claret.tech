import { describe, it, expect, vi, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { ProjectDetailsDialog, homepageHref } from "./project-details-dialog";
import {
  getSnapshot as getMotionGate,
  resetMotionGateForTests,
} from "@/lib/utils/motion-gate";
import type { Repository } from "@/contexts/projects-context";

/**
 * The details of one GitHub repository, in a dialog above the page: one for
 * the whole Projects section, rendered at the end of <body>, so nothing in
 * the grid paints over it or takes its clicks.
 */

const reduce = vi.hoisted(() => ({ value: false }));
vi.mock("@/lib/hooks/useSafari", () => ({
  useShouldReduceAnimations: () => reduce.value,
}));

const full: Repository = {
  id: "R_1",
  name: "neat-tool",
  description: "Evolves small networks.\nRuns on a laptop.",
  url: "https://github.com/user/neat-tool",
  homepageUrl: "https://neat.example",
  stargazerCount: 120,
  forkCount: 15,
  primaryLanguage: { name: "TypeScript", color: "#3178c6" },
  languages: {
    edges: [
      { node: { name: "TypeScript", color: "#3178c6" }, size: 800 },
      { node: { name: "CSS", color: "#563d7c" }, size: 200 },
    ],
  },
  topics: {
    edges: [
      { node: { topic: { name: "neuroevolution" } } },
      { node: { topic: { name: "jax" } } },
    ],
  },
  createdAt: "2023-01-10T00:00:00Z",
  updatedAt: "2023-12-01T00:00:00Z",
  // 19:00 on Dec 15 in Los Angeles: a local format names the wrong day.
  pushedAt: "2023-12-16T03:00:00Z",
  isPrivate: false,
  isArchived: false,
  diskUsage: 2048,
  isFork: false,
  parent: null,
};

/** What a pinned repository carries before the full list has loaded. */
const pinned: Repository = {
  ...full,
  id: "R_2",
  name: "bare-repo",
  description: null,
  homepageUrl: null,
  languages: undefined,
  topics: undefined,
  createdAt: "",
  updatedAt: "",
  pushedAt: "",
};

afterEach(() => {
  // Unmounted before the scrollTo spy goes: closing restores the page's
  // place, and jsdom's own scrollTo only reports "Not implemented".
  cleanup();
  reduce.value = false;
  resetMotionGateForTests();
  document.body.style.overflow = "";
  vi.restoreAllMocks();
});

const open = (project: Repository, onClose = vi.fn()) => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {}); // jsdom lacks it
  return render(<ProjectDetailsDialog project={project} onClose={onClose} />);
};

describe("ProjectDetailsDialog", () => {
  it("is a modal named by the repository, with the focus, outside its container", () => {
    const { container } = open(full);

    const dialog = screen.getByRole("dialog", { name: "neat-tool" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();
    expect(container).not.toContainElement(dialog);
    expect(document.body.lastElementChild).toContainElement(dialog);
  });

  it("writes its topics in the language's colour, deepened to read", () => {
    // Raw, the chips read at 1.35 to 3.9:1. GitHub gives the colour, so the
    // mix is the one that holds for any colour (accent-text.test.ts).
    open(full);

    for (const topic of ["neuroevolution", "jax"]) {
      const chip = screen.getByText(topic);
      expect(chip).toHaveClass("accent-text-any");
      expect(chip.style.getPropertyValue("--accent")).toBe("rgb(49, 120, 198)");
      expect(chip.style.color).toBe("");
    }
  });

  it("shows a repository's full record", () => {
    open(full);
    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveTextContent("Evolves small networks.");
    expect(within(dialog).getByText("neuroevolution")).toBeInTheDocument();
    expect(within(dialog).getByText("jax")).toBeInTheDocument();
    expect(within(dialog).getByText("80.0%")).toBeInTheDocument();
    expect(within(dialog).getByText("20.0%")).toBeInTheDocument();
    expect(within(dialog).getByText("Jan 2023")).toBeInTheDocument();
    const github = within(dialog).getByRole("link", { name: /View on GitHub/ });
    expect(github).toHaveAttribute("href", "https://github.com/user/neat-tool");
    expect(github).toHaveAttribute("target", "_blank");
    expect(github).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      within(dialog).getByRole("link", { name: /Live Demo/ }),
    ).toHaveAttribute("href", "https://neat.example");
  });

  it("dates the last push in UTC, whatever the visitor's time zone", () => {
    const zone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      open(full);
      expect(screen.getByText("Dec 16, 2023")).toBeInTheDocument();
    } finally {
      process.env.TZ = zone;
    }
  });

  it("shows no empty block for a repository with little data", () => {
    open(pinned);
    const dialog = screen.getByRole("dialog", { name: "bare-repo" });

    expect(dialog).toHaveTextContent("No detailed description available.");
    for (const name of ["Topics", "Languages", "Activity"]) {
      expect(within(dialog).queryByRole("heading", { name })).toBeNull();
    }
    expect(
      within(dialog).getByRole("heading", { name: "Primary language" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("TypeScript")).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("link", { name: /Live Demo/ }),
    ).toBeNull();
  });

  it("closes on Escape, its close button and a single click outside it", () => {
    const onClose = vi.fn();
    open(full, onClose);
    const backdrop = screen.getByTestId("project-details-backdrop");

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    fireEvent.click(backdrop, { detail: 1 });
    expect(onClose).toHaveBeenCalledTimes(3);

    // The second click of a double click on a card lands on the backdrop
    // that the first one opened, and a click inside is not a close.
    fireEvent.click(backdrop, { detail: 2 });
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("holds the page still while open and restores it, and the focus, after", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const { unmount } = render(
      <ProjectDetailsDialog
        project={full}
        onClose={() => {}}
        returnFocus={opener}
      />,
    );
    expect(document.body.style.overflow).toBe("hidden");
    expect(getMotionGate().suspended).toBe(true);

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("link", { name: /Live Demo/ })).toHaveFocus();

    unmount();
    expect(document.body.style.overflow).toBe("");
    expect(getMotionGate().suspended).toBe(false);
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("drops its entrance and the blur behind it when motion is reduced", () => {
    reduce.value = true;
    open(full);

    expect(screen.getByRole("dialog").className).not.toMatch(/animate-/);
    expect(
      screen.getByTestId("project-details-backdrop").className,
    ).not.toMatch(/backdrop-blur/);
  });
});

describe("homepageHref", () => {
  it("keeps http and https addresses", () => {
    expect(homepageHref("https://neat.example/a")).toBe(
      "https://neat.example/a",
    );
    expect(homepageHref("http://neat.example")).toBe("http://neat.example");
  });

  it("adds https to an address without a scheme", () => {
    // A relative link would point at this site instead.
    expect(homepageHref("neat.example")).toBe("https://neat.example");
  });

  it("drops any other scheme, and nothing at all", () => {
    expect(homepageHref("javascript:alert(1)")).toBeNull();
    expect(homepageHref("data:text/html,x")).toBeNull();
    expect(homepageHref("  ")).toBeNull();
    expect(homepageHref(null)).toBeNull();
  });
});
