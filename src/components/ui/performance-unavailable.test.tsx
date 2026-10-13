import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  PerformanceDashboardUnavailable,
  PerformanceMonitorUnavailable,
  PerformanceReportUnavailable,
} from "./performance-unavailable";

const mocks = vi.hoisted(() => ({
  hidePerformanceMonitor: vi.fn(),
  reloadPage: vi.fn(),
}));
vi.mock("@/contexts/performance-monitor-context", () => ({
  usePerformanceMonitorContext: () => ({
    hidePerformanceMonitor: mocks.hidePerformanceMonitor,
  }),
}));
vi.mock("@/lib/utils/reload-page", () => ({
  reloadPage: mocks.reloadPage,
}));

/**
 * What the terminal's performance tools show while their code cannot be
 * fetched. Each stand-in has tried once more as it mounted (`retrying`);
 * when that failed too, a reload is the way out, since a deploy may have
 * replaced the chunk.
 */
describe("PerformanceMonitorUnavailable", () => {
  it("says what failed, and tries again on request", () => {
    const retry = vi.fn();
    render(<PerformanceMonitorUnavailable retry={retry} retrying={false} />);

    expect(
      screen.getByText("Could not load the performance monitor."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("waits while a retry is in flight, then offers a reload", () => {
    const { rerender } = render(
      <PerformanceMonitorUnavailable retry={vi.fn()} retrying />,
    );
    expect(
      screen.getByRole("button", { name: "Trying again..." }),
    ).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Reload page" })).toBeNull();

    rerender(
      <PerformanceMonitorUnavailable retry={vi.fn()} retrying={false} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reload page" }));
    expect(mocks.reloadPage).toHaveBeenCalledTimes(1);
  });

  it("closes as the monitor does", () => {
    render(<PerformanceMonitorUnavailable retry={vi.fn()} retrying={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(mocks.hidePerformanceMonitor).toHaveBeenCalledTimes(1);
  });

  it("shows at the end of the page's body, above a dialog already open", () => {
    // In place at the PDF reader's z-index, it painted under a reader already
    // open, which a portal puts at the end of <body>.
    const { container } = render(
      <PerformanceMonitorUnavailable retry={vi.fn()} retrying={false} />,
    );

    const status = screen.getByRole("status");
    expect(container).not.toContainElement(status);
    expect(document.body.lastElementChild).toContainElement(status);
  });
});

describe("PerformanceDashboardUnavailable", () => {
  it("is a dialog that says what failed, and takes the focus", () => {
    render(
      <PerformanceDashboardUnavailable
        isOpen
        onClose={vi.fn()}
        retry={vi.fn()}
        retrying={false}
      />,
    );

    const dialog = screen.getByRole("dialog", {
      name: "Performance dashboard",
    });
    expect(dialog).toHaveTextContent(
      "Could not load the performance dashboard.",
    );
    expect(dialog).toHaveFocus();
  });

  it("closes on Escape and on Close", () => {
    const onClose = vi.fn();
    render(
      <PerformanceDashboardUnavailable
        isOpen
        onClose={onClose}
        retry={vi.fn()}
        retrying={false}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps Tab inside the dialog", () => {
    render(
      <PerformanceDashboardUnavailable
        isOpen
        onClose={vi.fn()}
        retry={vi.fn()}
        retrying={false}
      />,
    );
    const close = screen.getByRole("button", { name: "Close" });
    close.focus();

    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(close).toHaveFocus();
  });

  it("moves Tab on from a control in the middle", () => {
    // The trap only wrapped at its ends and left the rest to the browser,
    // and WebKit's own Tab skips links: from a link in between, Safari's
    // Tab walked out of the dialog. jsdom moves nothing by itself either.
    render(
      <PerformanceDashboardUnavailable
        isOpen
        onClose={vi.fn()}
        retry={vi.fn()}
        retrying={false}
      />,
    );
    screen.getByRole("button", { name: "Reload page" }).focus();

    fireEvent.keyDown(document, { key: "Tab" });

    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("opens at the end of the page's body, above a dialog already open", () => {
    const { container } = render(
      <PerformanceDashboardUnavailable
        isOpen
        onClose={vi.fn()}
        retry={vi.fn()}
        retrying={false}
      />,
    );

    const dialog = screen.getByRole("dialog", {
      name: "Performance dashboard",
    });
    expect(container).not.toContainElement(dialog);
    expect(document.body.lastElementChild).toContainElement(dialog);
  });

  it("renders nothing while closed", () => {
    render(
      <PerformanceDashboardUnavailable
        isOpen={false}
        onClose={vi.fn()}
        retry={vi.fn()}
        retrying={false}
      />,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("PerformanceReportUnavailable", () => {
  it("names the report", () => {
    render(
      <PerformanceReportUnavailable
        isOpen
        onClose={vi.fn()}
        retry={vi.fn()}
        retrying={false}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Performance report" }),
    ).toHaveTextContent("Could not load the performance report.");
  });
});
