import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

/**
 * /pdf/<slug> is the reader alone, and the reader loads in a chunk of its
 * own. When that cannot be fetched, the page says so and offers a retry, a
 * reload and the PDF itself. React.lazy threw while rendering, and the error
 * page (error.tsx) replaced the reader with "Something went wrong", whose
 * "Try Again" could not load it again.
 */

type Props = { url: string; title?: string };
type Loader = () => Promise<React.ComponentType<Props>>;

// next/dynamic's loader, to run it as next/dynamic would.
const loaders = vi.hoisted(() => [] as Loader[]);
vi.mock("next/dynamic", () => ({
  default: (load: Loader) => {
    loaders.push(load);
    return () => null;
  },
}));

// The reader's chunk cannot be fetched while `failing`.
const network = vi.hoisted(() => ({ failing: true, imports: 0 }));
vi.mock("@/components/ui/pdf-viewer", () => {
  network.imports++;
  if (network.failing) throw new Error("Loading chunk 8693 failed.");
  return { PDFViewer: ({ url }: Props) => <p>Reader for {url}</p> };
});

vi.mock("@/lib/utils/reload-page", () => ({ reloadPage: vi.fn() }));

import "./pdf-page-client";
import { reloadPage } from "@/lib/utils/reload-page";

describe("The PDF page, when the reader's chunk cannot be fetched", () => {
  it("says so and offers a retry, a reload and the PDF, then loads on retry", async () => {
    const [load] = loaders;

    // Resolves: a rejection here is what reached the error page.
    const Reader = await load();
    await act(async () => {
      render(<Reader url="/pdfs/CV_RomainClaret.pdf" title="Resume" />);
    });

    // Its own try, as it mounted, has failed too.
    expect(network.imports).toBe(2);
    expect(
      screen.getByText(/Could not load the PDF reader/),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the PDF" })).toHaveAttribute(
      "href",
      "/pdfs/CV_RomainClaret.pdf",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reload page" }));
    expect(reloadPage).toHaveBeenCalledTimes(1);

    // The connection is back.
    network.failing = false;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });

    expect(
      screen.getByText("Reader for /pdfs/CV_RomainClaret.pdf"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Could not load/)).not.toBeInTheDocument();
  });
});
