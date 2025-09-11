"use client";

import { SlideInLeft, SlideInRight } from "@/components/ui/animated";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { TypeWriter } from "@/components/ui/TypeWriter";
import { SocialLinks } from "@/components/ui/SocialLinks";
import { greeting } from "@/data/portfolio";
import { FileText, Mail } from "lucide-react";
import { ProtectedLucideIcon } from "@/components/ui/protected-lucide-icon";
import { usePDFViewer } from "@/lib/hooks/usePDFViewer";
import { useIntersectionObserver } from "@/lib/hooks/useIntersectionObserver";
import { ShootingStars } from "@/components/ui/shooting-stars";
import { GridBackground } from "@/components/ui/grid-background";
import { NeuralBackground } from "@/components/ui/neural-background";
import { useBackground } from "@/contexts/background-context";
import { InterestConstellation } from "@/components/ui/interest-constellation";
import { SkillsNeuralCloud } from "@/components/ui/skills-neural-cloud";
import { useShouldReduceAnimations, useIsSafari } from "@/lib/hooks/useSafari";
import { ConditionalMotion } from "@/components/ui/conditional-motion";

const DualBrainAnimation = dynamic(
  () =>
    import("@/components/ui/dual-brain-animation").then(
      (mod) => mod.DualBrainAnimation,
    ),
  {
    ssr: false,
    loading: () => {
      return (
        <div className="w-full max-w-lg mx-auto aspect-square bg-transparent" />
      );
    },
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
    threshold: 0.3, // Trigger when 30% of the section is visible
  });
  const { generateBackgroundData } = useBackground();
  const isSafari = useIsSafari();
  const [brainNodes, setBrainNodes] = useState<
    { x: number; y: number; id: string }[]
  >([]);
  const [screenDimensions, setScreenDimensions] = useState({
    width: 1152,
    height: 768,
  });

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

  // Extract role strings from the titleGreetingTitleList
  // The array alternates between role strings and delays (700ms)
  const roles = greeting.titleGreetingTitleList
    .filter((_, index) => index % 2 === 0)
    .map((role) => role as string);

  return (
    <section
      ref={sectionRef}
      className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 md:px-16 py-16 relative overflow-hidden"
    >
      <GridBackground className="absolute inset-0 z-0" />
      <NeuralBackground className="absolute inset-0 z-5" />
      {/* Skills Neural Cloud integrated with neural grid - Desktop/Tablet only, animations controlled by state */}
      <SkillsNeuralCloud
        concepts={greeting.neuralCloudConcepts}
        isVisible={isVisible}
        className="hidden md:block absolute inset-0 z-7"
        brainCenterX={
          screenDimensions.width >= 1024
            ? screenDimensions.width * 0.75
            : screenDimensions.width * 0.5
        }
        brainCenterY={screenDimensions.height * 0.5}
        exclusionRadius={screenDimensions.width >= 1024 ? 250 : 200}
      />
      <ShootingStars
        minDelay={isSafari ? 30 : 10}
        maxDelay={isSafari ? 120 : 30}
        className="absolute inset-0 z-10"
      />
      <div className="container mx-auto max-w-7xl relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Text Content */}
          <SlideInLeft className="text-center lg:text-left lg:pl-8">
            {/* Neural glow effect container */}
            <ConditionalMotion
              className="relative"
              fallbackClassName="relative"
              priority="low"
            >
              {/* Animated glow background */}
              <ConditionalMotion
                className="absolute -inset-2 rounded-2xl blur-2xl"
                fallbackClassName="absolute -inset-2 rounded-2xl blur-2xl opacity-20"
                style={{
                  background:
                    "linear-gradient(135deg, rgb(59, 130, 246), rgb(139, 92, 246))",
                }}
                initial={{ opacity: 0.1 }}
                animate={{ opacity: [0.1, 0.3, 0.1] }}
                transition={{
                  duration: 3.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5,
                }}
                priority="low"
              />

              {/* Optimized Container for Text Content - Safari Performance Fix */}
              <div className="relative rounded-2xl p-6 md:p-8 border-2 border-blue-200/20 dark:border-blue-800/20 bg-blue-50/85 dark:bg-slate-900/85">
                {/* Greeting */}
                <h1
                  className={cn(
                    "text-5xl md:text-6xl font-bold mb-4",
                    !shouldReduceAnimations && "animate-slide-in-up",
                  )}
                  style={
                    !shouldReduceAnimations ? { animationDelay: "200ms" } : {}
                  }
                >
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                    {greeting.titleGreeting}
                  </span>
                </h1>

                {/* TypeWriter */}
                <div
                  className={cn(
                    "text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-semibold mb-4 min-h-[6rem] sm:min-h-[7rem] md:min-h-[8rem] lg:min-h-[9rem] xl:min-h-[10rem]",
                    !shouldReduceAnimations && "animate-fade-in",
                  )}
                  style={
                    !shouldReduceAnimations ? { animationDelay: "400ms" } : {}
                  }
                >
                  <div className="text-center lg:text-left mb-2">
                    <span className="text-gray-700 dark:text-gray-200">
                      {greeting.titleGreetingNewline}
                    </span>
                  </div>
                  <TypeWriter
                    strings={roles}
                    className="text-blue-600 dark:text-blue-400 text-center lg:text-left"
                    isPaused={!isVisible}
                  />
                </div>

                {/* Subtitle */}
                <p
                  className={cn(
                    "text-lg text-gray-700 dark:text-gray-300 mb-8 max-w-2xl mx-auto lg:mx-0",
                    !shouldReduceAnimations && "animate-fade-in",
                  )}
                  style={
                    !shouldReduceAnimations ? { animationDelay: "600ms" } : {}
                  }
                >
                  {greeting.subTitle}
                </p>

                {/* Resume & Contact Buttons */}
                <div
                  className={cn(
                    "mb-8",
                    !shouldReduceAnimations && "animate-slide-in-up",
                  )}
                  style={
                    !shouldReduceAnimations ? { animationDelay: "800ms" } : {}
                  }
                >
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
                    <button
                      onClick={() =>
                        openPDF(
                          greeting.resumeLink,
                          "Romain Claret - CV",
                          "RomainClaret_CV.pdf",
                        )
                      }
                      aria-label="View Resume"
                      className="inline-flex w-full sm:w-auto max-w-xs items-center justify-center gap-2 px-6 py-3 text-lg font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                    >
                      <ProtectedLucideIcon
                        Icon={FileText}
                        className="w-5 h-5"
                        aria-hidden="true"
                      />
                      View Resume
                    </button>

                    {/* Contact Button - Only visible on mobile/tablet */}
                    <button
                      onClick={() => {
                        const contactSection =
                          document.getElementById("contact");
                        contactSection?.scrollIntoView({ behavior: "smooth" });
                      }}
                      aria-label="Contact me"
                      className="flex lg:hidden w-full sm:w-auto max-w-xs items-center justify-center gap-2 px-6 py-3 text-lg font-medium text-primary bg-transparent border-2 border-primary rounded-lg hover:bg-primary/10 transition-all duration-200 transform hover:-translate-y-0.5"
                    >
                      <Mail className="w-5 h-5" aria-hidden="true" />
                      Contact me
                    </button>
                  </div>
                </div>

                {/* Social Links */}
                <div
                  className={cn(!shouldReduceAnimations && "animate-fade-in")}
                  style={
                    !shouldReduceAnimations ? { animationDelay: "1000ms" } : {}
                  }
                >
                  <SocialLinks />
                </div>
              </div>
            </ConditionalMotion>

            {/* Interests - Mobile only (outside blur container) */}
            <div className="md:hidden mt-8">
              <InterestConstellation
                interests={greeting.interests}
                isVisible={isVisible}
                usePartialArc={true}
                brainNodes={brainNodes}
              />
            </div>
          </SlideInLeft>

          {/* Animation */}
          <SlideInRight
            delay={300}
            className="relative lg:pr-8 -mt-8 sm:-mt-12"
          >
            <div className="relative">
              <DualBrainAnimation
                isVisible={isVisible}
                className="w-full"
                onBrainNodesReady={setBrainNodes}
              />

              {/* Skills Neural Cloud - Desktop and Tablet (integrated with neural grid) */}
              {/* Note: Skills are now positioned on the neural background grid nodes */}

              {/* Interest Constellation - Desktop and Tablet overlay */}
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
        onClose={closePDF}
        pdfUrl={pdfUrl}
        title={title}
        downloadFileName={downloadFileName}
      />
    </section>
  );
}
