import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePDFViewer } from "./usePDFViewer";

describe("usePDFViewer", () => {
  describe("Initial State", () => {
    it("initializes with closed state", () => {
      const { result } = renderHook(() => usePDFViewer());

      expect(result.current.isOpen).toBe(false);
      expect(result.current.pdfUrl).toBe("");
      expect(result.current.title).toBeUndefined();
      expect(result.current.downloadFileName).toBeUndefined();
    });

    it("provides openPDF function", () => {
      const { result } = renderHook(() => usePDFViewer());

      expect(result.current.openPDF).toBeDefined();
      expect(typeof result.current.openPDF).toBe("function");
    });

    it("provides closePDF function", () => {
      const { result } = renderHook(() => usePDFViewer());

      expect(result.current.closePDF).toBeDefined();
      expect(typeof result.current.closePDF).toBe("function");
    });
  });

  describe("Opening PDF", () => {
    it("opens PDF with URL only", () => {
      const { result } = renderHook(() => usePDFViewer());

      act(() => {
        result.current.openPDF("/test.pdf");
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.pdfUrl).toBe("/test.pdf");
      expect(result.current.title).toBeUndefined();
      expect(result.current.downloadFileName).toBeUndefined();
    });

    it("opens PDF with all parameters", () => {
      const { result } = renderHook(() => usePDFViewer());

      act(() => {
        result.current.openPDF("/test.pdf", "Test Document", "test-doc.pdf");
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.pdfUrl).toBe("/test.pdf");
      expect(result.current.title).toBe("Test Document");
      expect(result.current.downloadFileName).toBe("test-doc.pdf");
    });

    it("extracts URL from Google Docs viewer", () => {
      const { result } = renderHook(() => usePDFViewer());

      const googleViewerUrl =
        "https://docs.google.com/gview?url=https://example.com/document.pdf&embedded=true";

      act(() => {
        result.current.openPDF(googleViewerUrl);
      });

      expect(result.current.pdfUrl).toBe("https://example.com/document.pdf");
    });

    it("handles Google Docs viewer URL without embedded parameter", () => {
      const { result } = renderHook(() => usePDFViewer());

      const googleViewerUrl =
        "https://docs.google.com/gview?url=https://example.com/document.pdf";

      act(() => {
        result.current.openPDF(googleViewerUrl);
      });

      expect(result.current.pdfUrl).toBe("https://example.com/document.pdf");
    });

    it("handles malformed Google Docs viewer URL", () => {
      const { result } = renderHook(() => usePDFViewer());

      const malformedUrl = "https://docs.google.com/gview?embedded=true";

      act(() => {
        result.current.openPDF(malformedUrl);
      });

      // Should use the original URL if extraction fails
      expect(result.current.pdfUrl).toBe(malformedUrl);
    });

    it("handles regular URLs without modification", () => {
      const { result } = renderHook(() => usePDFViewer());

      const regularUrl = "https://example.com/document.pdf";

      act(() => {
        result.current.openPDF(regularUrl);
      });

      expect(result.current.pdfUrl).toBe(regularUrl);
    });

    it("handles relative URLs", () => {
      const { result } = renderHook(() => usePDFViewer());

      act(() => {
        result.current.openPDF("/documents/file.pdf");
      });

      expect(result.current.pdfUrl).toBe("/documents/file.pdf");
    });

    it("handles data URLs", () => {
      const { result } = renderHook(() => usePDFViewer());

      const dataUrl = "data:application/pdf;base64,JVBERi0xLjQK...";

      act(() => {
        result.current.openPDF(dataUrl);
      });

      expect(result.current.pdfUrl).toBe(dataUrl);
    });
  });

  describe("Closing PDF", () => {
    it("closes PDF viewer", () => {
      const { result } = renderHook(() => usePDFViewer());

      // Open first
      act(() => {
        result.current.openPDF("/test.pdf", "Test Document");
      });

      expect(result.current.isOpen).toBe(true);

      // Then close
      act(() => {
        result.current.closePDF();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it("preserves other state when closing", () => {
      const { result } = renderHook(() => usePDFViewer());

      act(() => {
        result.current.openPDF("/test.pdf", "Test Document", "test.pdf");
      });

      act(() => {
        result.current.closePDF();
      });

      // URL and other data should be preserved
      expect(result.current.pdfUrl).toBe("/test.pdf");
      expect(result.current.title).toBe("Test Document");
      expect(result.current.downloadFileName).toBe("test.pdf");
    });
  });

  describe("Multiple Operations", () => {
    it("handles opening different PDFs", () => {
      const { result } = renderHook(() => usePDFViewer());

      act(() => {
        result.current.openPDF("/first.pdf", "First Document");
      });

      expect(result.current.pdfUrl).toBe("/first.pdf");
      expect(result.current.title).toBe("First Document");

      act(() => {
        result.current.openPDF("/second.pdf", "Second Document");
      });

      expect(result.current.pdfUrl).toBe("/second.pdf");
      expect(result.current.title).toBe("Second Document");
    });

    it("handles open-close-open cycle", () => {
      const { result } = renderHook(() => usePDFViewer());

      act(() => {
        result.current.openPDF("/test.pdf");
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.closePDF();
      });
      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.openPDF("/test.pdf");
      });
      expect(result.current.isOpen).toBe(true);
    });

    it("handles rapid open calls", () => {
      const { result } = renderHook(() => usePDFViewer());

      act(() => {
        result.current.openPDF("/pdf1.pdf");
        result.current.openPDF("/pdf2.pdf");
        result.current.openPDF("/pdf3.pdf");
      });

      // Should have the last PDF
      expect(result.current.pdfUrl).toBe("/pdf3.pdf");
      expect(result.current.isOpen).toBe(true);
    });

    it("handles rapid close calls", () => {
      const { result } = renderHook(() => usePDFViewer());

      act(() => {
        result.current.openPDF("/test.pdf");
      });

      act(() => {
        result.current.closePDF();
        result.current.closePDF();
        result.current.closePDF();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe("Function Stability", () => {
    it("maintains stable openPDF reference", () => {
      const { result, rerender } = renderHook(() => usePDFViewer());

      const firstOpenPDF = result.current.openPDF;

      rerender();

      expect(result.current.openPDF).toBe(firstOpenPDF);
    });

    it("maintains stable closePDF reference", () => {
      const { result, rerender } = renderHook(() => usePDFViewer());

      const firstClosePDF = result.current.closePDF;

      rerender();

      expect(result.current.closePDF).toBe(firstClosePDF);
    });
  });

  describe("Edge Cases", () => {
    it("handles empty string URL", () => {
      const { result } = renderHook(() => usePDFViewer());

      act(() => {
        result.current.openPDF("");
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.pdfUrl).toBe("");
    });

    it("handles undefined title and filename", () => {
      const { result } = renderHook(() => usePDFViewer());

      act(() => {
        result.current.openPDF("/test.pdf", undefined, undefined);
      });

      expect(result.current.title).toBeUndefined();
      expect(result.current.downloadFileName).toBeUndefined();
    });

    it("handles null values gracefully", () => {
      const { result } = renderHook(() => usePDFViewer());

      act(() => {
        result.current.openPDF("/test.pdf", undefined, undefined);
      });

      expect(result.current.pdfUrl).toBe("/test.pdf");
      expect(result.current.title).toBeUndefined();
      expect(result.current.downloadFileName).toBeUndefined();
    });

    it("handles special characters in URL", () => {
      const { result } = renderHook(() => usePDFViewer());

      const specialUrl =
        "/documents/file%20with%20spaces.pdf?param=value#page=2";

      act(() => {
        result.current.openPDF(specialUrl);
      });

      expect(result.current.pdfUrl).toBe(specialUrl);
    });

    it("handles Google Docs URL with special characters", () => {
      const { result } = renderHook(() => usePDFViewer());

      const encodedUrl =
        "https://docs.google.com/gview?url=https%3A%2F%2Fexample.com%2Ffile%20with%20spaces.pdf";

      act(() => {
        result.current.openPDF(encodedUrl);
      });

      expect(result.current.pdfUrl).toBe(
        "https://example.com/file with spaces.pdf",
      );
    });
  });

  describe("State Persistence", () => {
    it("maintains state across re-renders", () => {
      const { result, rerender } = renderHook(() => usePDFViewer());

      act(() => {
        result.current.openPDF("/test.pdf", "Test Document");
      });

      rerender();

      expect(result.current.isOpen).toBe(true);
      expect(result.current.pdfUrl).toBe("/test.pdf");
      expect(result.current.title).toBe("Test Document");
    });

    it("updates only necessary state", () => {
      const { result } = renderHook(() => usePDFViewer());

      act(() => {
        result.current.openPDF("/test.pdf", "Original Title");
      });

      const firstState = { ...result.current };

      act(() => {
        result.current.closePDF();
      });

      // Only isOpen should change
      expect(result.current.isOpen).not.toBe(firstState.isOpen);
      expect(result.current.pdfUrl).toBe(firstState.pdfUrl);
      expect(result.current.title).toBe(firstState.title);
    });
  });

  describe("URL Processing", () => {
    it("handles various Google Docs viewer formats", () => {
      const { result } = renderHook(() => usePDFViewer());

      const testCases = [
        {
          input:
            "https://docs.google.com/gview?url=https://example.com/file.pdf",
          expected: "https://example.com/file.pdf",
        },
        {
          input:
            "https://docs.google.com/gview?url=https://example.com/file.pdf&embedded=true",
          expected: "https://example.com/file.pdf",
        },
        {
          input:
            "https://docs.google.com/gview?embedded=true&url=https://example.com/file.pdf",
          expected: "https://example.com/file.pdf",
        },
        {
          input: "https://example.com/file.pdf",
          expected: "https://example.com/file.pdf",
        },
      ];

      testCases.forEach(({ input, expected }) => {
        act(() => {
          result.current.openPDF(input);
        });

        expect(result.current.pdfUrl).toBe(expected);
      });
    });

    it("handles URL with multiple query parameters", () => {
      const { result } = renderHook(() => usePDFViewer());

      const complexUrl =
        "https://docs.google.com/gview?url=https://example.com/file.pdf&embedded=true&a=1&b=2";

      act(() => {
        result.current.openPDF(complexUrl);
      });

      expect(result.current.pdfUrl).toBe("https://example.com/file.pdf");
    });
  });
});
