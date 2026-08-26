import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Deep per-icon imports, mocked the same way pdf-modal.test.tsx does. The
// component cannot use the lucide barrel: it is lazily loaded, and the barrel
// optimization crashes that chunk in webpack dev. Spelled out one by one
// because vi.mock is hoisted above the file body, so a loop variable does not
// exist yet when these run.
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

import { PDFViewer } from "./pdf-viewer";

/**
 * The share control copies the document's own /pdf/<slug> page. It exists so a
 * reader open on a paper, or on the CV, can hand out a link to it; before this
 * the reader knew only the file URL.
 */

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  // jsdom's navigator.clipboard is getter-only, so this redefines rather than
  // assigns. It must stay writable: the global setup re-establishes its own
  // clipboard with Object.assign on every test, and a read-only property makes
  // that throw for every file that runs after this one.
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(() => {
  // Hand back a working stub rather than leaving this file's spy installed.
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

const SHARE = "Copy link to this document";

describe("PDFViewer share control", () => {
  it("copies the document's page, not the raw file URL", async () => {
    // fireEvent throughout, never userEvent: userEvent.setup() installs its own
    // navigator.clipboard, which replaces the spy these assertions are on.
    render(
      <PDFViewer
        url="/pdfs/CV_RomainClaret.pdf"
        title="Resume"
        shareSlug="cv"
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: SHARE }));
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/pdf/cv`);
  });

  it("is absent for a document with no page of its own", () => {
    // A publication fetched at runtime has no local route, and a share button
    // there would hand out a link that 404s.
    render(<PDFViewer url="https://example.com/elsewhere.pdf" title="Paper" />);

    expect(screen.queryByRole("button", { name: SHARE })).toBeNull();
    // The reader is otherwise intact.
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeTruthy();
  });

  it("confirms the copy, then goes back", async () => {
    // fireEvent rather than userEvent: userEvent's own async waiting deadlocks
    // against fake timers here, and the point of the fake clock is only to
    // reach the 2s reset without the test sleeping for it.
    vi.useFakeTimers();
    render(<PDFViewer url="/pdfs/CV_RomainClaret.pdf" shareSlug="cv" />);
    const title = () =>
      screen.getByRole("button", { name: SHARE }).getAttribute("title");

    expect(title()).toBe(SHARE);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: SHARE }));
    });
    expect(title()).toBe("Link copied");

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(title()).toBe(SHARE);
  });

  it("stays quiet when the clipboard is refused", async () => {
    // Denied permission, or plain http. Showing a confirmation for a copy that
    // did not happen is worse than showing nothing.
    writeText.mockRejectedValue(new Error("denied"));
    render(<PDFViewer url="/pdfs/CV_RomainClaret.pdf" shareSlug="cv" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: SHARE }));
    });

    expect(
      screen.getByRole("button", { name: SHARE }).getAttribute("title"),
    ).toBe(SHARE);
  });
});
