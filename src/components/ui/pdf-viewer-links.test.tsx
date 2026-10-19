import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React, { useEffect } from "react";

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

// Each page's props as last rendered: the tests hand a page's annotations
// and text over through its callbacks, as react-pdf does.
const pageProps = vi.hoisted(
  () => new Map<number, Record<string, unknown> & { pageNumber: number }>(),
);

// One page, whose annotation layer stays empty until the test adds links,
// as pdf.js does after react-pdf has reported the layer rendered. A new file
// or new options (the fallback fonts) load the document again.
vi.mock("@/lib/pdf-config", () => ({
  Document: ({
    children,
    file,
    options,
    onLoadSuccess,
  }: {
    children?: React.ReactNode;
    file?: string;
    options?: object;
    onLoadSuccess: (doc: unknown) => void;
  }) => {
    useEffect(() => {
      onLoadSuccess({
        numPages: 1,
        getPage: async () => ({
          getViewport: () => ({ width: 595, height: 842 }),
        }),
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file, options]);
    return <div>{children}</div>;
  },
  Page: (props: Record<string, unknown> & { pageNumber: number }) => {
    pageProps.set(props.pageNumber, props);
    return (
      <div
        className="annotationLayer"
        data-testid={`layer-${props.pageNumber}`}
      />
    );
  },
  pdfjs: { GlobalWorkerOptions: {} },
}));

import { PDFViewer } from "./pdf-viewer";
import type {
  LinkAnnotationData,
  LinkTextContent,
  LinkTextItem,
} from "@/lib/utils/pdf-link-names";

/** A link annotation as pdf.js 5.4 adds it to a layer already in place. */
function addLink(layer: HTMLElement, href: string, id = "1R") {
  const section = document.createElement("section");
  section.className = "linkAnnotation";
  section.dataset.annotationId = id;
  const link = document.createElement("a");
  link.setAttribute("href", href);
  section.append(link);
  layer.append(section);
  return section;
}

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

describe("PDFViewer's links", () => {
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

  it("names web links", async () => {
    // pdf.js leaves every link without a name: each was announced as "link".
    render(<PDFViewer url="/pdfs/CV_RomainClaret.pdf" title="CV" />);
    const layer = await screen.findByTestId("layer-1");

    let web!: HTMLElement;
    let internal!: HTMLElement;
    await act(async () => {
      web = addLink(layer, "https://doi.org/10.1000/1");
      internal = addLink(layer, "#");
    });

    expect(screen.getByRole("link", { name: "doi.org/10.1000/1" })).toBe(
      web.querySelector("a"),
    );
    expect(internal.querySelector("a")).not.toHaveAttribute("aria-label");
  });
});

// The GECCO paper's first citation, "ES-HyperNEAT [5]": its number printed
// as an item of its own, so the test does not hang on character widths
// (pdf-link-names.test.ts tests those).
const at = (str: string, x: number, width: number): LinkTextItem => ({
  str,
  transform: [9, 0, 0, 9, x, 500],
  width,
  height: 9,
  fontName: "f1",
});
const GECCO_TEXT: LinkTextContent = {
  items: [
    at("connection. ES-HyperNEAT [", 72, 117),
    at("5", 189, 5),
    at("] automatically", 194, 60),
  ],
  styles: { f1: { fontFamily: "serif" } },
};
const GECCO_LINKS: LinkAnnotationData[] = [
  {
    id: "98R",
    subtype: "Link",
    rect: [188.7, 498.2, 194.3, 506.75],
    dest: "cite.risi2012enhanced",
  },
];

/** Hands page 1's annotations or text to the viewer, as react-pdf does. */
async function deliver(
  callback: "onGetAnnotationsSuccess" | "onGetTextSuccess" | "onLoadSuccess",
  value: unknown,
) {
  await act(async () => {
    const handler = pageProps.get(1)?.[callback];
    expect(handler).toBeTypeOf("function");
    (handler as (value: unknown) => void)(value);
  });
}

describe("PDFViewer's links within the document", () => {
  beforeEach(() => {
    pageProps.clear();
    globalThis.IntersectionObserver =
      InertObserver as unknown as typeof IntersectionObserver;
    globalThis.ResizeObserver =
      InertObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = OriginalIntersectionObserver;
    globalThis.ResizeObserver = OriginalResizeObserver;
  });

  // pdf.js draws them as empty links, and a screen reader read each of the
  // 3,400 citations, cross-references and contents entries as "link".
  it("names a link by the text under it, read before the link is drawn", async () => {
    render(<PDFViewer url="/pdfs/claret2026emr.pdf" title="EMR" />);
    const layer = await screen.findByTestId("layer-1");

    await deliver("onGetTextSuccess", GECCO_TEXT);
    await deliver("onGetAnnotationsSuccess", GECCO_LINKS);
    await act(async () => {
      addLink(layer, "#", "98R");
    });

    expect(screen.getByRole("link", { name: "Reference 5" })).toBeVisible();
  });

  it("names a link already drawn when its page's text arrives", async () => {
    render(<PDFViewer url="/pdfs/claret2026emr.pdf" title="EMR" />);
    const layer = await screen.findByTestId("layer-1");
    let wrapper!: HTMLElement;
    await act(async () => {
      wrapper = addLink(layer, "#", "98R");
    });
    expect(wrapper.querySelector("a")).not.toHaveAttribute("aria-label");

    await deliver("onGetAnnotationsSuccess", GECCO_LINKS);
    await deliver("onGetTextSuccess", GECCO_TEXT);

    expect(wrapper.querySelector("a")).toHaveAttribute(
      "aria-label",
      "Reference 5",
    );
  });

  it("keeps the names when the fallback fonts reload the document", async () => {
    render(<PDFViewer url="/pdfs/claret2026emr.pdf" title="EMR" />);
    const layer = await screen.findByTestId("layer-1");
    await deliver("onGetAnnotationsSuccess", GECCO_LINKS);
    await deliver("onGetTextSuccess", GECCO_TEXT);

    act(() => console.warn("Warning: TT: undefined function: 32"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /fallback fonts/ }));
    });
    // pdf.js draws the annotation layer again for the new document.
    await act(async () => {
      layer.replaceChildren();
      addLink(layer, "#", "98R");
    });

    expect(screen.getByRole("link", { name: "Reference 5" })).toBeVisible();
  });

  it("reads a page's text itself when the fallback fonts turn the text layer off", async () => {
    // With the text layer off, react-pdf never reads the page's text.
    render(<PDFViewer url="/pdfs/claret2026emr.pdf" title="EMR" />);
    const layer = await screen.findByTestId("layer-1");
    act(() => console.warn("Warning: TT: undefined function: 32"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /fallback fonts/ }));
    });
    expect(pageProps.get(1)?.renderTextLayer).toBe(false);

    await act(async () => {
      addLink(layer, "#", "98R");
    });
    await deliver("onGetAnnotationsSuccess", GECCO_LINKS);
    await deliver("onLoadSuccess", { getTextContent: async () => GECCO_TEXT });

    expect(screen.getByRole("link", { name: "Reference 5" })).toBeVisible();
  });

  it("forgets the names of a document it has left", async () => {
    // pdf.js's annotation ids are the PDF's object numbers: "98R" in the
    // next document is another link.
    const { rerender } = render(
      <PDFViewer url="/pdfs/claret2026emr.pdf" title="EMR" />,
    );
    const layer = await screen.findByTestId("layer-1");
    await deliver("onGetAnnotationsSuccess", GECCO_LINKS);
    await deliver("onGetTextSuccess", GECCO_TEXT);

    await act(async () => {
      rerender(<PDFViewer url="/pdfs/phd-thesis.pdf" title="Thesis" />);
    });
    let wrapper!: HTMLElement;
    await act(async () => {
      layer.replaceChildren();
      wrapper = addLink(layer, "#", "98R");
    });

    expect(wrapper.querySelector("a")).not.toHaveAttribute("aria-label");
  });
});

describe("PDFViewer's pages", () => {
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

  it("are a Tab stop of their own, so the keyboard can scroll them", async () => {
    // A PDF without links (the posters, the slides, the MSc thesis) had
    // nothing inside its pages to take focus: fitted to the width, a poster
    // is 1,630 px tall in a 632 px box, and the keyboard could not scroll it.
    render(<PDFViewer url="/pdfs/poster.pdf" title="Poster" />);
    await screen.findByTestId("layer-1");

    const pages = screen.getByRole("region", { name: "Pages" });
    expect(pages).toHaveAttribute("tabindex", "0");
    expect(pages).toContainElement(screen.getByTestId("layer-1"));
  });
});
