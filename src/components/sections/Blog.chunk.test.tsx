import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import React from "react";

/**
 * The blog's cards are a chunk of their own (BlogCards.tsx), out of the
 * page's first JavaScript. They have to come with the articles, not after
 * them: their import starts as the section mounts, beside the articles'
 * fetch, so the section waits for the slower of the two only.
 */

const cardImports = vi.hoisted(() => ({ count: 0 }));
vi.mock("./BlogCards", () => {
  cardImports.count++;
  return { BlogCards: () => <p>The cards</p> };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("The blog's cards", () => {
  it("start loading before the articles arrive", async () => {
    const answers: Array<(response: Response) => void> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            answers.push(resolve);
          }),
      ),
    );
    const { Blog } = await import("./Blog");

    const { container } = render(<Blog />);

    await waitFor(() => expect(cardImports.count).toBe(1));
    // Still the skeleton: no answer yet.
    expect(container.querySelectorAll(".h-64")).toHaveLength(3);

    await act(async () => {
      for (const answer of answers) {
        answer(new Response(JSON.stringify({ items: [], articles: [] })));
      }
    });
    expect(await screen.findByText("The cards")).toBeInTheDocument();
    expect(cardImports.count).toBe(1);
  });
});
