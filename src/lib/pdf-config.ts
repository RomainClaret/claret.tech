/**
 * PDF.js configuration module
 *
 * This module configures PDF.js worker BEFORE importing react-pdf components.
 * This is critical because react-pdf sets workerSrc at module import time.
 */

// Configure PDF.js worker BEFORE importing react-pdf
import { pdfjs } from "react-pdf";

// Set absolute path for Next.js. The version in the URL lets the browser keep
// the worker for good (next.config.mjs): a pdf.js bump is a new URL, and
// pdf.js refuses a worker of another version than its API.
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs?v=${pdfjs.version}`;

// Re-export react-pdf components with pre-configured worker
export { Document, Page, pdfjs } from "react-pdf";

// Import CSS for react-pdf
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
