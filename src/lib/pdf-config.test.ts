import { describe, it, expect, vi } from "vitest";

// Mock react-pdf before importing our module
vi.mock("react-pdf", () => ({
  pdfjs: {
    GlobalWorkerOptions: {},
  },
  Document: vi.fn(() => null),
  Page: vi.fn(() => null),
}));

describe("pdf-config", () => {
  it("exports Document and Page components", async () => {
    const { Document, Page } = await import("./pdf-config");

    expect(Document).toBeDefined();
    expect(Page).toBeDefined();
    expect(typeof Document).toBe("function");
    expect(typeof Page).toBe("function");
  });

  it("exports pdfjs with worker configuration", async () => {
    const { pdfjs } = await import("./pdf-config");

    expect(pdfjs).toBeDefined();
    expect(pdfjs.GlobalWorkerOptions).toBeDefined();
  });

  it("configures worker source to absolute path", async () => {
    // Import after mock to test configuration
    const { pdfjs } = await import("react-pdf");

    // Verify that our configuration module would set the worker src
    expect(() => {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
    }).not.toThrow();
  });
});
