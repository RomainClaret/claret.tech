import { describe, it, expect, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { useHydrated } from "./useHydrated";

function Probe() {
  return <p>{useHydrated() ? "client" : "server"}</p>;
}

describe("useHydrated", () => {
  it("is false in the server's HTML and while hydrating, true after", async () => {
    const html = renderToString(<Probe />);
    expect(html).toContain("server");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await act(async () => {
        hydrateRoot(container, <Probe />);
      });

      expect(errors).not.toHaveBeenCalled(); // no hydration mismatch
      expect(container.textContent).toBe("client");
    } finally {
      errors.mockRestore();
      container.remove();
    }
  });

  it("is true from the first render of a component mounted on the client", () => {
    const renders: string[] = [];
    function Recorder() {
      renders.push(useHydrated() ? "client" : "server");
      return null;
    }
    render(<Recorder />);

    expect(renders).toEqual(["client"]);
  });
});
