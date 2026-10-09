let installed = false;

// Suppress known PDF.js font warnings in production. Installed once: every
// reader mount used to wrap console.warn and console.error again, so after N
// documents each console call went through N filters.
export function setupPDFConsoleFilter() {
  if (installed) return;
  if (process.env.NODE_ENV === "production") {
    installed = true;
    const originalWarn = console.warn;
    const originalError = console.error;

    const suppressedWarnings = [
      "Warning: Indexing all PDF objects",
      "Warning: TT:",
      "Warning: Unknown/unsupported post table",
      "Warning: FormatError:",
      "Warning: Could not find a preferred cmap table",
      "Warning: Found EOI marker",
      "OTS parsing error:",
      "Failed to load font",
    ];

    console.warn = (...args) => {
      const message = args.join(" ");
      const shouldSuppress = suppressedWarnings.some((warning) =>
        message.includes(warning),
      );

      if (!shouldSuppress) {
        originalWarn.apply(console, args);
      }
    };

    console.error = (...args) => {
      const message = args.join(" ");
      const shouldSuppress = suppressedWarnings.some((warning) =>
        message.includes(warning),
      );

      if (!shouldSuppress) {
        originalError.apply(console, args);
      }
    };
  }
}
