import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import React from "react";

/**
 * The cards' code is a chunk of its own (ProjectsContent.tsx), out of the
 * page's first JavaScript. It has to come with the repositories, not after
 * them: its import starts as the section mounts, beside their fetch, so the
 * section waits for the slower of the two only.
 */

const contentImports = vi.hoisted(() => ({ count: 0 }));
vi.mock("./ProjectsContent", () => {
  contentImports.count++;
  return { ProjectsContent: () => <p>The cards</p> };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("The projects' cards", () => {
  it("start loading before the repositories arrive", async () => {
    let answer: (response: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          }),
      ),
    );
    const { Projects } = await import("./Projects");

    render(<Projects />);

    await waitFor(() => expect(contentImports.count).toBe(1));
    expect(screen.getByText("Loading projects...")).toBeInTheDocument();

    await act(async () => {
      answer(
        new Response(
          JSON.stringify({
            success: true,
            data: { pinnedItems: { edges: [] } },
          }),
        ),
      );
    });
    expect(await screen.findByText("The cards")).toBeInTheDocument();
    expect(contentImports.count).toBe(1);
  });
});
