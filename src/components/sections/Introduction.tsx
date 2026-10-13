"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePDFViewer } from "@/lib/hooks/usePDFViewer";
import { loadPdfModal } from "@/components/ui/pdf-modal-loader";
import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";
import { useBackground } from "@/contexts/background-context";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { ConditionalMotion } from "@/components/ui/conditional-motion";
import { IntroductionContent } from "./IntroductionContent";
import { IntroductionAnimations } from "./IntroductionAnimations";
import { InterestConstellation } from "@/components/ui/interest-constellation";
import { greeting } from "@/data/portfolio";
import { withLoadFallback } from "@/lib/utils/load-fallback";
import { logError } from "@/lib/utils/dev-logger";

// The component's own height: its primary brain's (200, 250 or 300 px by
// breakpoint). A square up to 512 px stood in for it, so the hero's brain
// column shrank when the component arrived and the content around it
// re-centred, a layout shift on every load.
const BrainsPlaceholder = () => (
  <div className="w-full h-[200px] sm:h-[250px] lg:h-[300px]" />
);

// Dynamic imports for performance. When the brains' chunk cannot be fetched,
// their box keeps its placeholder: React.lazy threw while rendering, and the
// page's error boundary (error.tsx) replaced everything under the navigation.
const DualBrainAnimation = dynamic(
  withLoadFallback(
    () =>
      import("@/components/ui/dual-brain-animation").then(
        (mod) => mod.DualBrainAnimation,
      ),
    BrainsPlaceholder,
    { onError: (error) => logError(error, "Hero brains chunk") },
  ),
  { ssr: false, loading: BrainsPlaceholder },
);

// Fetched on intent and mounted only while open (pdf-reader-preload.ts).
const PDFModal = dynamic(loadPdfModal, {
  ssr: false,
  loading: () => null,
});

export function Introduction() {
  const shouldReduceAnimations = useShouldReduceAnimations();
  const {
    isOpen,
    pdfUrl,
    title,
    downloadFileName,
    shareSlug,
    openPDF,
    closePDF,
  } = usePDFViewer();
  const [sectionRef, isVisible] = useIntersectionObserver({
    threshold: 0.3,
  });
  const { generateBackgroundData } = useBackground();
  const [brainNodes, setBrainNodes] = useState<
    { x: number; y: number; id: string }[]
  >([]);
  const [screenDimensions, setScreenDimensions] = useState({
    width: 1152,
    height: 768,
  });

  // Brain nodes state (removed debug logging for cleaner console)

  // Generate background data on mount and track screen dimensions.
  //
  // Resize fires continuously while a window is dragged, and on phones every
  // time the URL bar shows or hides during a scroll. Each event used to draw
  // a new random background, re-rendering every background layer and visibly
  // reshuffling it mid-scroll. Now the dimensions settle 150 ms after the last
  // event, and the background is redrawn only when the grid itself changes: a
  // different number of 64 px columns, or a height change beyond
  // max(150 px, 20%), which the URL bar never reaches.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const CELL = 64;
    let generatedFor = { width: 0, height: 0 };
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const update = (force: boolean) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setScreenDimensions({ width, height });
      const columnsChanged =
        Math.ceil(width / CELL) !== Math.ceil(generatedFor.width / CELL);
      const heightChanged =
        Math.abs(height - generatedFor.height) >
        Math.max(150, generatedFor.height * 0.2);
      if (force || columnsChanged || heightChanged) {
        generatedFor = { width, height };
        generateBackgroundData(width, height, CELL);
      }
    };

    const onResize = () => {
      if (settleTimer !== undefined) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => update(false), 150);
    };

    update(true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (settleTimer !== undefined) clearTimeout(settleTimer);
    };
  }, [generateBackgroundData]);

  const handleResumeClick = () => {
    // greeting.resumeLink rather than the path spelled out again: pdf-registry
    // builds the /pdf/cv route from that same field, and the reader resolves
    // its share link by matching the URL, so the two have to be one string.
    openPDF(
      greeting.resumeLink,
      "Resume - Romain Claret",
      "Romain_Claret_Resume.pdf",
    );
  };

  const handleContactClick = () => {
    const contactSection = document.getElementById("contact");
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section
      ref={sectionRef}
      className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 md:px-16 py-16 relative overflow-hidden"
    >
      {/* Background animations - only render when animations are enabled */}
      <ConditionalMotion>
        <IntroductionAnimations
          isVisible={isVisible && !shouldReduceAnimations}
          screenDimensions={screenDimensions}
        />
      </ConditionalMotion>

      {/* Main content */}
      <div className="container mx-auto max-w-7xl relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Text Content Panel */}
          <div className="text-center lg:text-left">
            <IntroductionContent
              onResumeClick={handleResumeClick}
              onContactClick={handleContactClick}
              className="relative"
            />
          </div>

          {/* Brain Animation Panel */}
          <div className="relative lg:pr-8">
            <div className="relative">
              <DualBrainAnimation
                isVisible={isVisible}
                className="w-full"
                onBrainNodesReady={setBrainNodes}
              />

              {/* Interest Constellation overlay - exactly like original */}
              <div className="hidden md:block absolute inset-0 pointer-events-none z-20">
                <div className="absolute inset-0 flex items-center justify-center">
                  <InterestConstellation
                    interests={greeting.interests}
                    isVisible={isVisible}
                    className="pointer-events-auto"
                    brainNodes={brainNodes}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Modal */}
      {isOpen && (
        <PDFModal
          isOpen={isOpen}
          pdfUrl={pdfUrl}
          title={title}
          downloadFileName={downloadFileName}
          shareSlug={shareSlug}
          onClose={closePDF}
        />
      )}
    </section>
  );
}
