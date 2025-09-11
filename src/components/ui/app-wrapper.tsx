"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import { terminalConfig } from "@/data/portfolio";
import { useTerminal } from "@/lib/terminal/terminal-context";
import { ServiceWorkerRegister } from "./service-worker-register";
import { ProjectsProvider } from "@/contexts/projects-context";
import { BackgroundProvider } from "@/contexts/background-context";
import { AnimationProvider } from "@/contexts/animation-context";
import {
  PerformanceMonitorProvider,
  usePerformanceMonitorContext,
} from "@/contexts/performance-monitor-context";
import { GridBackground } from "./grid-background";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { logError } from "@/lib/utils/error-logger";
// Import performance logger to initialize it
import "@/lib/utils/performance-logger";

const SplashScreen = dynamic(
  () => import("./splash-screen").then((mod) => mod.SplashScreen),
  { ssr: false },
);

const Terminal = dynamic(
  () =>
    import("@/components/terminal/Terminal")
      .then((mod) => mod.Terminal)
      .catch((err) => {
        logError(err, {
          type: "dynamic_import_error",
          component: "Terminal",
          context: "app-wrapper",
        });
        // Return a fallback component
        const FallbackTerminal = () => (
          <div className="fixed bottom-0 right-0 w-full md:w-[800px] h-[600px] bg-black rounded-t-lg shadow-2xl border border-red-500/50 p-4">
            <p className="text-red-500 font-mono">
              Error loading terminal. Please refresh the page.
            </p>
          </div>
        );
        return FallbackTerminal;
      }),
  {
    ssr: false,
  },
);

const PerformanceMonitor = dynamic(
  () => import("./performance-monitor").then((mod) => mod.PerformanceMonitor),
  { ssr: false },
);

const PerformanceModal = dynamic(
  () =>
    import("@/components/performance/PerformanceModal").then(
      (mod) => mod.PerformanceModal,
    ),
  { ssr: false },
);

const PerformanceReportModal = dynamic(
  () =>
    import("@/components/performance/PerformanceReportModal").then(
      (mod) => mod.PerformanceReportModal,
    ),
  { ssr: false },
);

interface AppWrapperProps {
  children: React.ReactNode;
}

// Component to handle performance monitor rendering
function PerformanceMonitorRenderer() {
  const { isMonitorActive } = usePerformanceMonitorContext();

  if (!isMonitorActive) return null;

  return <PerformanceMonitor />;
}

// Component to handle performance dashboard modal rendering
function PerformanceDashboardRenderer() {
  const { isDashboardOpen, hideDashboard } = usePerformanceMonitorContext();

  if (!isDashboardOpen) return null;

  return <PerformanceModal isOpen={isDashboardOpen} onClose={hideDashboard} />;
}

// Component to handle performance report modal rendering
function PerformanceReportRenderer() {
  const { isReportModalOpen, hideReportModal } = usePerformanceMonitorContext();

  if (!isReportModalOpen) return null;

  return (
    <PerformanceReportModal
      isOpen={isReportModalOpen}
      onClose={hideReportModal}
    />
  );
}

export function AppWrapper({ children }: AppWrapperProps) {
  const shouldReduceAnimations = useShouldReduceAnimations();
  const { isOpen: isTerminalOpen, setIsOpen: setIsTerminalOpen } =
    useTerminal();
  const [splashScreenComplete, setSplashScreenComplete] = useState(false);

  const handleSplashComplete = useCallback(() => {
    setSplashScreenComplete(true);
  }, []);

  return (
    <ErrorBoundary>
      <BackgroundProvider>
        <AnimationProvider>
          <PerformanceMonitorProvider>
            <ProjectsProvider>
              <ServiceWorkerRegister />
              {/* Site-wide grid background with very low opacity - Disabled on Safari for performance */}
              {!shouldReduceAnimations && (
                <GridBackground className="fixed inset-0 z-0 opacity-30" />
              )}
              <SplashScreen onComplete={handleSplashComplete} />
              <div className="relative z-10">{children}</div>
              {/* Terminal Component - Only render after splash screen completes */}
              {terminalConfig.enabled && splashScreenComplete && (
                <Terminal
                  isOpen={isTerminalOpen}
                  onClose={() => setIsTerminalOpen(false)}
                />
              )}

              {/* Performance Monitor - Production ready, only loads when activated */}
              <PerformanceMonitorRenderer />

              {/* Performance Dashboard Modal - Terminal access only */}
              <PerformanceDashboardRenderer />

              {/* Performance Report Modal - Terminal triggered */}
              <PerformanceReportRenderer />
            </ProjectsProvider>
          </PerformanceMonitorProvider>
        </AnimationProvider>
      </BackgroundProvider>
    </ErrorBoundary>
  );
}
