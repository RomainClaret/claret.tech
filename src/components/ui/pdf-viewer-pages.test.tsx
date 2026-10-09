import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React, { useEffect } from "react";

// Deep per-icon imports, mocked as in pdf-viewer-share.test.tsx (vi.mock is
// hoisted, so each is spelled out).
const icon = vi.hoisted(() => () => (props: Record<string, unknown>) => (
  <span {...props} />
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

/**
 * The reader draws the first screen's pages at once and the rest when every
 * page's size is known, which takes a getPage per page (368 for the thesis).
 * Meanwhile "next" from page 2 scrolled to a page that did not exist yet and
 * did nothing, while the counter read "of 368".
 */

// A 368-page document, opened afresh by each load (react-pdf makes a new
// proxy per load). A load's page sizes arrive when the test measures it, or
// fail, as an old proxy's do once a reload destroys it.
const pdf = vi.hoisted(() => {
  const loads: { measure: () => void; fail: () => void }[] = [];
  const open = () => {
    let measure = () => {};
    let fail = () => {};
    const ready = new Promise<void>((resolve, reject) => {
      measure = resolve;
      fail = () => reject(new Error("Transport destroyed"));
    });
    ready.catch(() => {}); // a failed load is the test's doing
    loads.push({ measure, fail });
    return {
      numPages: 368,
      getPage: async () => {
        await ready;
        return { getViewport: () => ({ width: 595, height: 842 }) };
      },
    };
  };
  return { loads, open, latest: () => loads[loads.length - 1] };
});
vi.mock("@/lib/pdf-config", () => ({
  Document: ({
    children,
    onLoadSuccess,
    options,
  }: {
    children?: React.ReactNode;
    onLoadSuccess: (doc: unknown) => void;
    options?: object;
  }) => {
    // Once per load, as react-pdf calls it (the viewer passes a new callback
    // on every render). New options reload the document, and react-pdf
    // remounts every page meanwhile: hence the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => onLoadSuccess(pdf.open()), [options]);
    return <div key={JSON.stringify(options)}>{children}</div>;
  },
  Page: ({
    pageNumber,
    renderMode,
  }: {
    pageNumber: number;
    renderMode?: string;
  }) => (
    <div data-testid="page" data-mode={renderMode}>
      {pageNumber}
    </div>
  ),
  pdfjs: { GlobalWorkerOptions: {} },
}));

import { PDFViewer } from "./pdf-viewer";

const NEXT = { name: "Next page" };
const originalScrollIntoView = Element.prototype.scrollIntoView;
const OriginalIntersectionObserver = globalThis.IntersectionObserver;
const OriginalResizeObserver = globalThis.ResizeObserver;

/** An observer that observes nothing (the setup file's are emptied). */
class InertObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

// The page observers the viewer creates, with what each watches, so a test
// can report which pages are near.
type Watcher = {
  callback: IntersectionObserverCallback;
  targets: Element[];
  live: boolean;
};
let watchers: Watcher[] = [];
class PageObserver {
  private watcher: Watcher;
  constructor(callback: IntersectionObserverCallback) {
    this.watcher = { callback, targets: [], live: true };
    watchers.push(this.watcher);
  }
  observe(target: Element) {
    this.watcher.targets.push(target);
  }
  unobserve() {}
  disconnect() {
    this.watcher.live = false;
  }
  takeRecords() {
    return [];
  }
}
/** The live observer reports `pages` as near and every other page as not. */
const reportNear = (pages: number[]) => {
  const watcher = watchers.filter((w) => w.live).at(-1)!;
  act(() =>
    watcher.callback(
      watcher.targets.map(
        (target) =>
          ({
            target,
            isIntersecting: pages.includes(
              Number((target as HTMLElement).dataset.page),
            ),
          }) as unknown as IntersectionObserverEntry,
      ),
      watcher as unknown as IntersectionObserver,
    ),
  );
};
const mode = (page: number) =>
  screen.getAllByTestId("page")[page - 1].dataset.mode;

beforeEach(() => {
  // jsdom does not scroll, and the setup file's observers are vi.fns that
  // mockReset empties.
  Element.prototype.scrollIntoView = () => {};
  watchers = [];
  pdf.loads.length = 0;
  globalThis.IntersectionObserver =
    PageObserver as unknown as typeof IntersectionObserver;
  globalThis.ResizeObserver = InertObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
  globalThis.IntersectionObserver = OriginalIntersectionObserver;
  globalThis.ResizeObserver = OriginalResizeObserver;
});

describe("PDFViewer page navigation", () => {
  it("stops at the last page in place until every size is known", async () => {
    await act(async () => {
      render(<PDFViewer url="/pdfs/phd-thesis.pdf" title="Thesis" />);
    });
    expect(screen.getByText("Page 1 of 368")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", NEXT));
    expect(screen.getByText("Page 2 of 368")).toBeInTheDocument();
    // Page 3 has no box yet: next would do nothing, so it is disabled.
    expect(screen.getByRole("button", NEXT)).toBeDisabled();

    await act(async () => pdf.latest().measure());
    expect(screen.getAllByTestId("page")).toHaveLength(368);
    fireEvent.click(screen.getByRole("button", NEXT));

    expect(screen.getByText("Page 3 of 368")).toBeInTheDocument();
  });

  it("draws the first pages again when the fallback fonts reload it", async () => {
    await act(async () => {
      render(<PDFViewer url="/pdfs/phd-thesis.pdf" title="Thesis" />);
    });
    await act(async () => pdf.latest().measure());
    reportNear([200, 201, 202]); // the reader is at page 200
    expect(mode(200)).toBe("canvas");
    expect(mode(1)).toBe("none");

    // A font warning, then the switch: the document reloads, its pages
    // remount at the top, and measuring starts over.
    act(() => console.warn("Warning: TT: undefined function: 32"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /fallback fonts/ }));
    });

    // Before the sizes are back: the first screen, drawn, not page 200.
    expect(screen.getAllByTestId("page")).toHaveLength(2);
    expect(mode(1)).toBe("canvas");

    await act(async () => pdf.latest().measure());
    reportNear([1, 2, 3]);
    expect(mode(1)).toBe("canvas");
    expect(mode(200)).toBe("none");
  });

  it("counts from page 1 again when the fallback fonts reload it", async () => {
    // The pages remount at the top, so the counter must say so without
    // waiting for a scroll event (jsdom sends none, and a browser's is not
    // guaranteed).
    await act(async () => {
      render(<PDFViewer url="/pdfs/phd-thesis.pdf" title="Thesis" />);
    });
    await act(async () => pdf.latest().measure());
    fireEvent.click(screen.getByRole("button", NEXT));
    fireEvent.click(screen.getByRole("button", NEXT));
    expect(screen.getByText("Page 3 of 368")).toBeInTheDocument();

    act(() => console.warn("Warning: TT: undefined function: 32"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /fallback fonts/ }));
    });

    expect(screen.getByText("Page 1 of 368")).toBeInTheDocument();
  });

  it("ignores sizes measured for a load that has been replaced", async () => {
    await act(async () => {
      render(<PDFViewer url="/pdfs/phd-thesis.pdf" title="Thesis" />);
    });
    // The fallback fonts reload the document while it is still measuring.
    act(() => console.warn("Warning: TT: undefined function: 32"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /fallback fonts/ }));
    });
    expect(pdf.loads).toHaveLength(2);

    // The first proxy is destroyed: its getPage calls reject, which
    // pageSizes turns into zero sizes for all 368 pages.
    await act(async () => pdf.loads[0].fail());
    expect(screen.getAllByTestId("page")).toHaveLength(2); // still the first screen

    await act(async () => pdf.latest().measure());
    expect(screen.getAllByTestId("page")).toHaveLength(368);
  });
});
