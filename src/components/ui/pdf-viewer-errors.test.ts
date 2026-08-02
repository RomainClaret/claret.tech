import { describe, it, expect, vi, beforeEach } from "vitest";

const logError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/utils/dev-logger", () => ({ logError }));

// Imported after the mock so the handler picks it up. The module pulls in
// react-pdf, which is why the assertions target the exported handler rather
// than the component.
vi.mock("@/lib/pdf-config", () => ({ Document: () => null, Page: () => null }));

const { handleTextLayerError } = await import("./pdf-viewer");

describe("handleTextLayerError", () => {
  beforeEach(() => vi.clearAllMocks());

  it("swallows the cancellation pdf.js raises on every re-render", () => {
    // TextLayer.cancel() rejects with this whenever a render is superseded,
    // which auto-fit triggers once per page. It is a control signal, and
    // surfacing it puts an error overlay over a document that rendered fine.
    const abort = new Error("TextLayer task cancelled.");
    abort.name = "AbortException";

    handleTextLayerError(abort);

    expect(logError).not.toHaveBeenCalled();
  });

  it("still reports a text layer that genuinely failed", () => {
    const real = new Error("could not build text layer");

    handleTextLayerError(real);

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0][0]).toBe(real);
  });

  it("reports non-Error throwables rather than dropping them", () => {
    handleTextLayerError("something odd");

    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(logError.mock.calls[0][0].message).toContain("something odd");
  });
});
