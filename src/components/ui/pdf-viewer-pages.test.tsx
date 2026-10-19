import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React, { useEffect, useRef, useState } from "react";

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
// fail, as an old proxy's do once a reload destroys it. A reloaded document
// arrives when the test lets it (nextLoad): on a timer, React's async act
// around the click already ran it, and no test saw the pages away. With
// `failNext`, the next load fails instead, as a refused PDF request does.
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
  return {
    loads,
    open,
    latest: () => loads[loads.length - 1],
    failNext: false,
    arrival: null as (() => void) | null,
  };
});
vi.mock("@/lib/pdf-config", () => ({
  Document: ({
    children,
    file,
    onLoadSuccess,
    onLoadError,
    options,
  }: {
    children?: React.ReactNode;
    file?: string;
    onLoadSuccess: (doc: unknown) => void;
    onLoadError: (error: Error) => void;
    options?: object;
  }) => {
    const [failed, setFailed] = useState(false);
    const [reloading, setReloading] = useState(false);
    const loaded = useRef(false);
    // Once per load, as react-pdf calls it (the viewer passes a new callback
    // on every render). New options load the same document again, a new
    // file another one. In react-pdf's order, a reload destroys the current
    // proxy at once, so its getPage calls reject, and the new document
    // arrives later, after a round trip to the worker (nextLoad). Meanwhile
    // react-pdf 10.5 shows its `loading` in place of the pages: every page
    // box unmounts, and new ones mount with the new document.
    useEffect(() => {
      const deliver = () => {
        setReloading(false);
        if (pdf.failNext) {
          pdf.failNext = false;
          setFailed(true);
          onLoadError(new Error("Failed to fetch"));
          return;
        }
        setFailed(false);
        onLoadSuccess(pdf.open());
      };
      if (!loaded.current) {
        loaded.current = true;
        deliver();
        return;
      }
      pdf.latest()?.fail();
      setReloading(true);
      pdf.arrival = deliver;
      return () => {
        if (pdf.arrival === deliver) pdf.arrival = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file, options]);
    // A failed load shows react-pdf's error in place of the pages.
    return <div>{failed || reloading ? null : children}</div>;
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
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
const originalClientHeight = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "clientHeight",
)!;
const OriginalIntersectionObserver = globalThis.IntersectionObserver;
const OriginalResizeObserver = globalThis.ResizeObserver;

// jsdom lays nothing out, so the browser's view is modeled: one page fills
// the viewer and the others are out of it. Tests move it as a browser would,
// with a scroll event (scrollIntoView, a scroll) or without one (a layout
// that changes under the same scroll offset).
const VIEWER_HEIGHT = 800;
const view = { page: 1 };
function modeledRect(this: Element): DOMRect {
  const page = Number((this as HTMLElement).dataset?.page);
  // A detached box, as a browser reports it: all zeros.
  if (!page || !this.isConnected)
    return originalGetBoundingClientRect.call(this);
  const top = page === view.page ? 0 : VIEWER_HEIGHT;
  return { top, bottom: top + VIEWER_HEIGHT } as DOMRect;
}
const viewer = () =>
  document.querySelector("[data-page]")!.closest(".overflow-auto")!;
/** The reader scrolls page `page` into view; the browser sends a scroll event. */
const scrollTo = (page: number) => {
  view.page = page;
  act(() => {
    viewer().dispatchEvent(new Event("scroll"));
  });
};

// The ResizeObservers the viewer creates, so a test can lay the pages out
// again: a browser reports to each one after a layout that resized what it
// watches.
type Resizer = { callback: ResizeObserverCallback; live: boolean };
let resizers: Resizer[] = [];
class LayoutObserver {
  private resizer: Resizer;
  constructor(callback: ResizeObserverCallback) {
    this.resizer = { callback, live: true };
    resizers.push(this.resizer);
  }
  observe() {}
  unobserve() {}
  disconnect() {
    this.resizer.live = false;
  }
}
/** A reloaded document arrives, a worker round trip after the reload. */
const nextLoad = () =>
  act(async () => {
    const arrive = pdf.arrival;
    pdf.arrival = null;
    arrive?.();
  });

/** The browser lays the pages out again, with no scroll event. */
const relayout = () =>
  act(() => {
    for (const resizer of resizers.filter((r) => r.live)) {
      resizer.callback([], resizer as unknown as ResizeObserver);
    }
  });

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
/** The browser reports the live observer's boxes that left the page (react-pdf
 *  unmounted them) as out of view, as it does for any removed target. */
const reportGone = () => {
  const watcher = watchers.filter((w) => w.live).at(-1)!;
  act(() =>
    watcher.callback(
      watcher.targets
        .filter((target) => !target.isConnected)
        .map(
          (target) =>
            ({
              target,
              isIntersecting: false,
            }) as unknown as IntersectionObserverEntry,
        ),
      watcher as unknown as IntersectionObserver,
    ),
  );
};
const mode = (page: number) =>
  screen.getAllByTestId("page")[page - 1].dataset.mode;
/** The reader's scroll box, which stays while the page boxes come and go. */
const pagesRegion = () => screen.getByRole("region", { name: "Pages" });
const reloadWithFallbackFonts = async () => {
  act(() => console.warn("Warning: TT: undefined function: 32"));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /fallback fonts/ }));
  });
};

beforeEach(() => {
  // jsdom does not scroll or lay out, and the setup file's observers are
  // vi.fns that mockReset empties.
  view.page = 1;
  Element.prototype.scrollIntoView = function (this: Element) {
    view.page = Number((this as HTMLElement).dataset.page);
    this.closest(".overflow-auto")?.dispatchEvent(new Event("scroll"));
  };
  Element.prototype.getBoundingClientRect = modeledRect;
  Object.defineProperty(Element.prototype, "clientHeight", {
    configurable: true,
    get: () => VIEWER_HEIGHT,
  });
  watchers = [];
  resizers = [];
  pdf.loads.length = 0;
  pdf.failNext = false;
  pdf.arrival = null;
  globalThis.IntersectionObserver =
    PageObserver as unknown as typeof IntersectionObserver;
  globalThis.ResizeObserver =
    LayoutObserver as unknown as typeof ResizeObserver;
});

afterEach(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  Object.defineProperty(
    Element.prototype,
    "clientHeight",
    originalClientHeight,
  );
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

  it("keeps the reader's pages when the fallback fonts reload it", async () => {
    // react-pdf 10.5 unmounts the page boxes while it loads the document
    // again, and mounts new ones for it: they keep the sizes and the pages
    // that were drawn. A reset to the first screen dropped every box past it
    // until the sizes were measured again, and WebKit clamped a reader on
    // page 200 to page 1.
    await act(async () => {
      render(<PDFViewer url="/pdfs/phd-thesis.pdf" title="Thesis" />);
    });
    await act(async () => pdf.latest().measure());
    reportNear([200, 201, 202]); // the reader is at page 200
    expect(mode(200)).toBe("canvas");
    expect(mode(1)).toBe("none");

    // A font warning, then the switch: the document reloads and measuring
    // starts over. The boxes go, and the browser reports them out of view:
    // taken, that left page 200 undrawn until every size was measured again.
    await reloadWithFallbackFonts();
    expect(screen.queryAllByTestId("page")).toHaveLength(0);
    reportGone();
    await nextLoad();

    // Before the sizes are measured again: every box, page 200 drawn.
    expect(pdf.loads).toHaveLength(2);
    expect(screen.getAllByTestId("page")).toHaveLength(368);
    expect(mode(200)).toBe("canvas");
    expect(mode(1)).toBe("none");

    await act(async () => pdf.latest().measure());
    expect(screen.getAllByTestId("page")).toHaveLength(368);
    expect(mode(200)).toBe("canvas");
  });

  it("holds the column's size while the fallback fonts reload it", async () => {
    // With the boxes unmounted, the column collapsed and the browser clamped
    // the scroll to the top: a reader on page 200 was on page 1 when the
    // boxes came back, in Chromium and WebKit.
    await act(async () => {
      render(<PDFViewer url="/pdfs/phd-thesis.pdf" title="Thesis" />);
    });
    await act(async () => pdf.latest().measure());
    const column = pagesRegion().firstElementChild as HTMLElement;
    // jsdom lays nothing out: the column's size as a browser measures it.
    Object.defineProperty(column, "offsetHeight", { value: 315_000 });
    Object.defineProperty(column, "offsetWidth", { value: 1_200 });

    await reloadWithFallbackFonts();
    expect(screen.queryAllByTestId("page")).toHaveLength(0);
    expect(column.style.minHeight).toBe("315000px");
    expect(column.style.minWidth).toBe("1200px");

    // The new boxes are back at their sizes: the column lets go.
    await nextLoad();
    expect(screen.getAllByTestId("page")).toHaveLength(368);
    expect(column.style.minHeight).toBe("");
    expect(column.style.minWidth).toBe("");
  });

  it("watches the new page boxes after the fallback fonts reload it", async () => {
    // The page observer watched the unmounted boxes until every size was
    // measured again: a page the reader scrolled to meanwhile stayed
    // undrawn.
    await act(async () => {
      render(<PDFViewer url="/pdfs/phd-thesis.pdf" title="Thesis" />);
    });
    await act(async () => pdf.latest().measure());

    await reloadWithFallbackFonts();
    await nextLoad();

    const live = watchers.filter((w) => w.live).at(-1)!;
    expect(live.targets).toHaveLength(368);
    expect(live.targets.every((target) => target.isConnected)).toBe(true);
    reportNear([250]);
    expect(mode(250)).toBe("canvas");
  });

  it("keeps the counter on the reader's page through a scroll during the reload", async () => {
    // The unmounted boxes each measure zero: a scroll meanwhile counted
    // none of them in view and named page 1.
    await act(async () => {
      render(<PDFViewer url="/pdfs/phd-thesis.pdf" title="Thesis" />);
    });
    await act(async () => pdf.latest().measure());
    scrollTo(200);
    expect(screen.getByText("Page 200 of 368")).toBeInTheDocument();

    await reloadWithFallbackFonts();
    expect(screen.queryAllByTestId("page")).toHaveLength(0);
    act(() => {
      pagesRegion().dispatchEvent(new Event("scroll"));
    });

    expect(screen.getByText("Page 200 of 368")).toBeInTheDocument();
  });

  it("keeps the counter on the reader's page when the fallback fonts reload it", async () => {
    await act(async () => {
      render(<PDFViewer url="/pdfs/phd-thesis.pdf" title="Thesis" />);
    });
    await act(async () => pdf.latest().measure());
    scrollTo(200);
    expect(screen.getByText("Page 200 of 368")).toBeInTheDocument();

    act(() => console.warn("Warning: TT: undefined function: 32"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /fallback fonts/ }));
    });
    await nextLoad();
    relayout();

    expect(screen.getByText("Page 200 of 368")).toBeInTheDocument();
  });

  it("starts over with the first screen for a different document", async () => {
    // Only a reload of the same document keeps the page boxes: another
    // document's pages have sizes of their own.
    const { rerender } = await act(async () =>
      render(<PDFViewer url="/pdfs/phd-thesis.pdf" title="Thesis" />),
    );
    await act(async () => pdf.latest().measure());
    reportNear([200, 201, 202]);
    expect(screen.getAllByTestId("page")).toHaveLength(368);

    await act(async () => {
      rerender(<PDFViewer url="/pdfs/CV_RomainClaret.pdf" title="CV" />);
    });
    await nextLoad();

    expect(pdf.loads).toHaveLength(2);
    expect(screen.getAllByTestId("page")).toHaveLength(2);
    expect(mode(1)).toBe("canvas");
  });

  it("keeps the page in view when the fallback fonts reload it", async () => {
    // A reader within the first screen does not move: the column holds its
    // size while the boxes are away, the scroll offset stays valid, and
    // nothing scrolls (measured on page 2 of the thesis in Chromium and
    // WebKit). Counting from 1 on every reload named page 1 under page 2.
    await act(async () => {
      render(<PDFViewer url="/pdfs/phd-thesis.pdf" title="Thesis" />);
    });
    await act(async () => pdf.latest().measure());
    scrollTo(2);
    expect(screen.getByText("Page 2 of 368")).toBeInTheDocument();

    act(() => console.warn("Warning: TT: undefined function: 32"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /fallback fonts/ }));
    });
    await nextLoad();
    relayout();

    expect(screen.getByText("Page 2 of 368")).toBeInTheDocument();
  });

  it("follows the page in view when a relayout moves it", async () => {
    // A layout that moves the pages under the same scroll offset sends no
    // scroll event: a zoom did, before it kept the reader's place, and
    // showed page 120 under a counter still at 100. Here the browser moves
    // the view as the zoom lays the pages out again.
    await act(async () => {
      render(<PDFViewer url="/pdfs/phd-thesis.pdf" title="Thesis" />);
    });
    await act(async () => pdf.latest().measure());
    scrollTo(100);
    expect(screen.getByText("Page 100 of 368")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    view.page = 120;
    relayout();

    expect(screen.getByText("Page 120 of 368")).toBeInTheDocument();
  });

  it("drops the old document's pages from the counter when a reload fails", async () => {
    // A failed reload leaves no pages on screen, as a failed first load
    // does. The counter kept the old document's page count, and "next"
    // counted up over boxes no longer in the page (seen in Chromium with
    // the PDF request refused on the fallback-fonts reload).
    await act(async () => {
      render(<PDFViewer url="/pdfs/phd-thesis.pdf" title="Thesis" />);
    });
    await act(async () => pdf.latest().measure());
    fireEvent.click(screen.getByRole("button", NEXT));
    fireEvent.click(screen.getByRole("button", NEXT));
    expect(screen.getByText("Page 3 of 368")).toBeInTheDocument();

    pdf.failNext = true;
    act(() => console.warn("Warning: TT: undefined function: 32"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /fallback fonts/ }));
    });
    await nextLoad();
    relayout();

    expect(screen.getByText("Page 1 of ...")).toBeInTheDocument();
    expect(screen.getByRole("button", NEXT)).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();
  });

  it("ignores sizes measured for a load that has been replaced", async () => {
    await act(async () => {
      render(<PDFViewer url="/pdfs/phd-thesis.pdf" title="Thesis" />);
    });
    // The fallback fonts reload the document while it is still measuring.
    // react-pdf destroys the first proxy at once: its getPage calls reject,
    // pageSizes turns them into zero sizes for all 368 pages, and those land
    // before the new document does. Taken, they collapsed every page box.
    act(() => console.warn("Warning: TT: undefined function: 32"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /fallback fonts/ }));
    });
    await nextLoad();
    expect(pdf.loads).toHaveLength(2);
    expect(screen.getAllByTestId("page")).toHaveLength(2); // still the first screen

    await act(async () => pdf.latest().measure());
    expect(screen.getAllByTestId("page")).toHaveLength(368);
  });
});

describe("PDFViewer place through a change of scale", () => {
  // A zoom rescales every page box under the same scroll offset: zooming
  // out on page 100 of the thesis showed page 115. Here the pages are laid
  // out as a browser would: each box as tall as its inline height, stacked
  // with their 16 px margins under the column's 16 px padding, and the
  // viewer scrolled by its scrollTop.
  let scrollTop = 0;
  const MARGIN = 16;
  beforeEach(() => {
    scrollTop = 0;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this.classList?.contains("overflow-auto")) {
        return {
          top: 0,
          bottom: VIEWER_HEIGHT,
          height: VIEWER_HEIGHT,
        } as DOMRect;
      }
      const page = Number((this as HTMLElement).dataset?.page);
      if (!page || !this.isConnected) {
        return originalGetBoundingClientRect.call(this);
      }
      // Every page of the mock document has the same size.
      const box = this.firstElementChild as HTMLElement;
      const height = parseFloat(box.style.height);
      const top = MARGIN + (page - 1) * (height + MARGIN) - scrollTop;
      return { top, bottom: top + height, height } as DOMRect;
    };
  });

  /** The reader, open and measured, scrolled by the modeled scrollTop. */
  async function open() {
    await act(async () => {
      render(<PDFViewer url="/pdfs/phd-thesis.pdf" title="Thesis" />);
    });
    await act(async () => pdf.latest().measure());
    Object.defineProperty(viewer(), "scrollTop", {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
      },
    });
  }

  async function openAtPage(page: number) {
    await open();
    const top = viewer()
      .querySelector(`[data-page="${page}"]`)!
      .getBoundingClientRect().top;
    scrollTop += top;
    act(() => {
      viewer().dispatchEvent(new Event("scroll"));
    });
  }
  const topOf = (page: number) =>
    viewer().querySelector(`[data-page="${page}"]`)!.getBoundingClientRect()
      .top;

  it("keeps the page at the top of the view through a zoom", async () => {
    await openAtPage(100);
    expect(screen.getByText("Page 100 of 368")).toBeInTheDocument();
    expect(topOf(100)).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    relayout();

    expect(topOf(100)).toBeCloseTo(0);
    expect(screen.getByText("Page 100 of 368")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    relayout();

    expect(topOf(100)).toBeCloseTo(0);
    expect(screen.getByText("Page 100 of 368")).toBeInTheDocument();
  });

  it("leaves a reader at the very top at the top", async () => {
    // The first fit at open anchored page 1 from above the column's 16 px
    // padding, and left the view 16(1 - s) px down the first page.
    await open();
    expect(scrollTop).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));

    expect(scrollTop).toBe(0);
  });

  it("keeps how far into the page the reader was", async () => {
    await openAtPage(100);
    // A third of the way down page 100.
    const height = viewer()
      .querySelector('[data-page="100"]')!
      .getBoundingClientRect().height;
    scrollTop += height / 3;

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));

    const zoomed = viewer()
      .querySelector('[data-page="100"]')!
      .getBoundingClientRect();
    expect(zoomed.height).toBeGreaterThan(height);
    expect(-zoomed.top / zoomed.height).toBeCloseTo(1 / 3, 2);
  });
});
