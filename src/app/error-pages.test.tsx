import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { useErrorReport } from "@/lib/hooks/useErrorReport";
import ErrorPage from "./error";
import GlobalError from "./global-error";

/**
 * Next's two error pages report their error (useErrorReport) and say a
 * report was sent only once it is on record. global-error renders its own
 * <html>, so it is checked as markup rather than mounted into a <div>.
 */

vi.mock("@/lib/hooks/useErrorReport", () => ({
  useErrorReport: vi.fn(() => false),
}));

const error = new Error("boom");
const reset = () => {};

describe("the error pages", () => {
  beforeEach(() => {
    vi.mocked(useErrorReport).mockClear();
  });

  it("error.tsx reports its error and says so only once it is on record", () => {
    const { rerender } = render(<ErrorPage error={error} reset={reset} />);

    expect(useErrorReport).toHaveBeenCalledWith(error);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    vi.mocked(useErrorReport).mockReturnValue(true);
    rerender(<ErrorPage error={error} reset={reset} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "A report of it was sent.",
    );
    vi.mocked(useErrorReport).mockReturnValue(false);
  });

  it("global-error.tsx reports its error, in a page with a language", () => {
    const unreported = renderToStaticMarkup(
      <GlobalError error={error} reset={reset} />,
    );
    expect(useErrorReport).toHaveBeenCalledWith(error);
    expect(unreported).toMatch(/^<html lang="en">/);
    expect(unreported).toContain(
      '<p role="status" class="mb-6 min-h-5 text-sm text-gray-500"></p>',
    );

    // After a deploy, only fresh code from the server recovers.
    expect(unreported).toContain(">Reload page</button>");

    vi.mocked(useErrorReport).mockReturnValueOnce(true);
    expect(
      renderToStaticMarkup(<GlobalError error={error} reset={reset} />),
    ).toContain(">A report of it was sent.</p>");
  });
});
