import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import React, { useEffect } from "react";

const icon = vi.hoisted(() => () => (props: Record<string, unknown>) => (
  <span data-testid="icon" {...props} />
));
vi.mock("lucide-react/dist/esm/icons/chevron-left", () => ({
  default: icon(),
}));
vi.mock("lucide-react/dist/esm/icons/chevron-right", () => ({
  default: icon(),
}));
vi.mock("lucide-react/dist/esm/icons/download", () => ({ default: icon() }));
vi.mock("lucide-react/dist/esm/icons/zoom-in", () => ({ default: icon() }));
vi.mock("lucide-react/dist/esm/icons/zoom-out", () => ({ default: icon() }));
vi.mock("lucide-react/dist/esm/icons/loader-circle", () => ({
  default: icon(),
}));
vi.mock("lucide-react/dist/esm/icons/circle-alert", () => ({
  default: icon(),
}));
vi.mock("lucide-react/dist/esm/icons/share-2", () => ({ default: icon() }));
vi.mock("lucide-react/dist/esm/icons/check", () => ({ default: icon() }));

// A one-page document that arrives when the test hands it over.
const load = vi.hoisted(() => ({ deliver: () => {} }));
vi.mock("@/lib/pdf-config", () => ({
  Document: ({
    children,
    onLoadSuccess,
  }: {
    children?: React.ReactNode;
    onLoadSuccess: (doc: unknown) => void;
  }) => {
    useEffect(() => {
      load.deliver = () =>
        onLoadSuccess({
          numPages: 1,
          getPage: async () => ({
            getViewport: () => ({ width: 595, height: 842 }),
          }),
        });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div>{children}</div>;
  },
  Page: () => <div />,
  pdfjs: { GlobalWorkerOptions: {} },
}));

import { PDFViewer } from "./pdf-viewer";

// The viewer measures through both observers; the global mocks are reset
// between tests, so this file brings inert ones of its own.
class InertObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
const OriginalIntersectionObserver = globalThis.IntersectionObserver;
const OriginalResizeObserver = globalThis.ResizeObserver;

describe("PDFViewer while the PDF loads", () => {
  beforeEach(() => {
    globalThis.IntersectionObserver =
      InertObserver as unknown as typeof IntersectionObserver;
    globalThis.ResizeObserver =
      InertObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = OriginalIntersectionObserver;
    globalThis.ResizeObserver = OriginalResizeObserver;
  });

  it("says so in words, and stops once the PDF is in", async () => {
    // A spinning icon alone said nothing to a screen reader, and in Safari
    // or with motion off it stood still: the load looked like a hang.
    render(<PDFViewer url="/pdfs/poster.pdf" title="Poster" />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading the PDF...");
    expect(status.querySelector('[data-testid="icon"]')).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    await act(async () => load.deliver());

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
