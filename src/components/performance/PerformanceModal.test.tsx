import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLayoutEffect, type ReactNode } from "react";
import { PerformanceModal } from "./PerformanceModal";
import { useModalDialog } from "@/lib/hooks/useModalDialog";

vi.mock("framer-motion", () => {
  // Forwards what reaches the DOM (role, tabIndex, aria-*), drops motion
  // props, as framer does.
  const div = ({
    children,
    className,
    onClick,
    role,
    tabIndex,
    ...rest
  }: {
    children?: ReactNode;
    className?: string;
    onClick?: () => void;
    role?: string;
    tabIndex?: number;
    [prop: string]: unknown;
  }) => (
    <div
      className={className}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      {...Object.fromEntries(
        Object.entries(rest).filter(([prop]) => prop.startsWith("aria-")),
      )}
    >
      {children}
    </div>
  );
  const passThrough = ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  );
  return {
    m: { div },
    AnimatePresence: passThrough,
    LazyMotion: passThrough,
    domMax: {},
  };
});

vi.mock("./PerformanceDashboard", () => ({
  PerformanceDashboard: () => <div data-testid="dashboard" />,
}));

// vi.mock is hoisted, so each path is written out.
vi.mock("lucide-react/dist/esm/icons/x", () => ({
  default: () => <svg aria-hidden="true" />,
}));
vi.mock("lucide-react/dist/esm/icons/minimize-2", () => ({
  default: () => <svg aria-hidden="true" />,
}));
vi.mock("lucide-react/dist/esm/icons/maximize-2", () => ({
  default: () => <svg aria-hidden="true" />,
}));

describe("PerformanceModal", () => {
  it("listens for Escape from the moment it is on the page, before it paints", () => {
    // Loaded lazily, its passive effects ran after the browser had painted
    // it: an Escape pressed in between reached the performance monitor's
    // listener on window and closed the monitor instead. A later sibling's
    // layout effect runs after this one's and before any passive effect.
    const onClose = vi.fn();
    const closedAtMount: boolean[] = [];
    function Probe() {
      useLayoutEffect(() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        closedAtMount.push(onClose.mock.calls.length > 0);
      }, []);
      return null;
    }

    render(
      <>
        <PerformanceModal isOpen={true} onClose={onClose} />
        <Probe />
      </>,
    );

    expect(closedAtMount[0]).toBe(true);
  });

  it("closes on Escape, and marks the key as used", () => {
    // The performance monitor listens on window, after this document
    // listener: one Escape closed the dashboard and hid the monitor.
    const onClose = vi.fn();
    render(<PerformanceModal isOpen={true} onClose={onClose} />);
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();

    expect(fireEvent.keyDown(document, { key: "Escape" })).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("opens at the end of the page's body, above a dialog already open", () => {
    // Rendered in place at the same z-index, it painted under a PDF reader
    // already open, which a portal puts at the end of <body>.
    const { container } = render(
      <PerformanceModal isOpen={true} onClose={vi.fn()} />,
    );

    const dialog = screen.getByRole("dialog", {
      name: "Performance dashboard",
    });
    expect(container).not.toContainElement(dialog);
    expect(document.body.lastElementChild).toContainElement(dialog);
  });

  it("leaves an Escape typed in a modal dialog to that dialog", () => {
    // Open first, it listens first: the reader's Escape closed it too.
    const onClose = vi.fn();
    render(<PerformanceModal isOpen={true} onClose={onClose} />);
    const reader = document.createElement("div");
    reader.setAttribute("aria-modal", "true");
    const button = document.createElement("button");
    reader.append(button);
    document.body.append(reader);

    expect(fireEvent.keyDown(button, { key: "Escape" })).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    // From the terminal, or the page, it is still the panel's.
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    reader.remove();
  });

  it("leaves Escape alone while closed", () => {
    const onClose = vi.fn();
    render(<PerformanceModal isOpen={false} onClose={onClose} />);

    expect(fireEvent.keyDown(document, { key: "Escape" })).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("is a named dialog, not a modal one", () => {
    // Opened from the terminal, which stays usable above it: a modal dialog
    // would hide a terminal that is still there.
    render(<PerformanceModal isOpen={true} onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", {
      name: "Performance dashboard",
    });
    expect(dialog).not.toHaveAttribute("aria-modal");
    expect(
      within(dialog).getByRole("heading", { name: "Performance Dashboard" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".backdrop-blur-sm")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("names its buttons by what they do", () => {
    render(<PerformanceModal isOpen={true} onClose={vi.fn()} />);

    const close = screen.getByRole("button", {
      name: "Close performance dashboard",
    });
    expect(close).toHaveAttribute("type", "button");
    expect(close).toHaveAttribute("title", "Close (ESC)");
    const minimize = screen.getByRole("button", {
      name: "Minimize performance dashboard",
    });
    expect(minimize).toHaveAttribute("type", "button");

    fireEvent.click(minimize);

    expect(
      screen.getByRole("button", { name: "Maximize performance dashboard" }),
    ).toBeInTheDocument();
  });

  it("says how to close it in its header, beside its buttons", () => {
    // Floated at the window's top right, the hint lay over the header's
    // buttons below 1920 px wide, and at 1280 it took a click at the close
    // button's centre.
    render(<PerformanceModal isOpen={true} onClose={vi.fn()} />);

    const close = screen.getByRole("button", {
      name: "Close performance dashboard",
    });
    const hint = screen.getByText(/to close/);
    expect(screen.getByRole("dialog")).toContainElement(hint);
    expect(hint.parentElement).toBe(close.parentElement);

    fireEvent.click(
      screen.getByRole("button", { name: "Minimize performance dashboard" }),
    );
    expect(screen.queryByText(/to close/)).not.toBeInTheDocument();
  });

  it("lets the keyboard reach its metrics, to scroll them", () => {
    // Nothing in the dashboard takes focus, so without a stop of its own
    // the keyboard could not scroll it.
    render(<PerformanceModal isOpen={true} onClose={vi.fn()} />);

    const metrics = screen.getByRole("region", { name: "Dashboard metrics" });
    expect(metrics).toHaveAttribute("tabindex", "0");
    expect(metrics).toContainElement(screen.getByTestId("dashboard"));
    expect(screen.getByRole("dialog")).toContainElement(metrics);
  });
});

/** A dialog that locks the page's scroll, as the PDF reader does. */
function Reader() {
  const ref = useModalDialog<HTMLDivElement>(true, () => {}, {
    lockScroll: true,
  });
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Reader"
      tabIndex={-1}
    />
  );
}

describe("PerformanceModal and the page's scroll", () => {
  // The dashboard opens from the terminal, also over the PDF reader. It
  // wrote "unset" as it closed, and the page scrolled under the reader.
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.overflow = "";
  });

  it("keeps the page locked when it closes over a reader", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const reader = render(<Reader />);
    const dashboard = render(
      <PerformanceModal isOpen={true} onClose={vi.fn()} />,
    );

    dashboard.unmount();
    expect(document.body.style.overflow).toBe("hidden");

    reader.unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps the page locked when a reader closes under it", () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const dashboard = render(
      <PerformanceModal isOpen={true} onClose={vi.fn()} />,
    );
    const reader = render(<Reader />);

    reader.unmount();
    expect(document.body.style.overflow).toBe("hidden");

    dashboard.unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
