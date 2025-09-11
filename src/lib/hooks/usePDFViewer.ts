import { useState, useCallback } from "react";

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
