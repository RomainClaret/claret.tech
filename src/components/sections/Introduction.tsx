"use client";

import { SlideInLeft, SlideInRight } from "@/components/ui/animated";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePDFViewer } from "@/lib/hooks/usePDFViewer";
import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";
import { useBackground } from "@/contexts/background-context";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { ConditionalMotion } from "@/components/ui/conditional-motion";
import { IntroductionContent } from "./IntroductionContent";
import { IntroductionAnimations } from "./IntroductionAnimations";
import { InterestConstellation } from "@/components/ui/interest-constellation";
import { greeting } from "@/data/portfolio";

// Dynamic imports for performance
const DualBrainAnimation = dynamic(
  () =>
    import("@/components/ui/dual-brain-animation").then(
      (mod) => mod.DualBrainAnimation,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full max-w-lg mx-auto aspect-square bg-transparent" />
    ),
  },
);

const PDFModal = dynamic(
  () => import("@/components/ui/pdf-modal").then((mod) => mod.PDFModal),
  {
    ssr: false,
    loading: () => null,
  },
);

export function Introduction() {
  const shouldReduceAnimations = useShouldReduceAnimations();
  const { isOpen, pdfUrl, title, downloadFileName, openPDF, closePDF } =
    usePDFViewer();
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

  // Generate background data on mount and track screen dimensions
  useEffect(() => {
    if (typeof window !== "undefined") {
      const updateDimensions = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        setScreenDimensions({ width, height });
        generateBackgroundData(width, height, 64);
      };

      updateDimensions();
      window.addEventListener("resize", updateDimensions);
      return () => window.removeEventListener("resize", updateDimensions);
    }
  }, [generateBackgroundData]);

  const handleResumeClick = () => {
    openPDF(
      "/pdfs/RomainClaret_CV.pdf",
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
          <SlideInLeft className="text-center lg:text-left">
            <IntroductionContent
              onResumeClick={handleResumeClick}
              onContactClick={handleContactClick}
              className="relative"
            />
          </SlideInLeft>

          {/* Brain Animation Panel */}
          <SlideInRight delay={300} className="relative lg:pr-8">
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
          </SlideInRight>
        </div>
      </div>

      {/* PDF Modal */}
      <PDFModal
        isOpen={isOpen}
        pdfUrl={pdfUrl}
        title={title}
        downloadFileName={downloadFileName}
        onClose={closePDF}
      />
    </section>
  );
}
