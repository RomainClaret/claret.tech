import { useState, useCallback } from "react";
import { isSafePdfUrl } from "@/lib/utils/safe-pdf-url";

// Re-exported so existing consumers/tests keep their import path; the
// implementation lives in utils so the lazy pdf-viewer chunk can import it
// without depending on this page-bundled hook module.
export { isSafePdfUrl };

interface PDFViewerState {
  isOpen: boolean;
  pdfUrl: string;
  title?: string;
  downloadFileName?: string;
}

export function usePDFViewer() {
  const [state, setState] = useState<PDFViewerState>({
    isOpen: false,
    pdfUrl: "",
    title: undefined,
    downloadFileName: undefined,
  });

  const openPDF = useCallback(
    (url: string, title?: string, downloadFileName?: string) => {
      // Extract the actual PDF URL from Google Viewer URL if present
      const cleanUrl = url.includes("docs.google.com/gview")
        ? new URL(url).searchParams.get("url") || url
        : url;

      if (!isSafePdfUrl(cleanUrl)) {
        return;
      }

      setState({
        isOpen: true,
        pdfUrl: cleanUrl,
        title,
        downloadFileName,
      });
    },
    [],
  );

  const closePDF = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    ...state,
    openPDF,
    closePDF,
  };
}
