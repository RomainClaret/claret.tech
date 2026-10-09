"use client";

import { usePathname } from "next/navigation";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, useRef } from "react";
import { terminalConfig } from "@/data/portfolio";
import { useTerminalToggle } from "@/lib/terminal/terminal-context";
import {
  loadTerminal,
  loadedTerminal,
} from "@/components/terminal/load-terminal";
import { TerminalUnavailable } from "@/components/terminal/TerminalUnavailable";
import { withLoadFallback } from "@/lib/utils/load-fallback";
import { ServiceWorkerRegister } from "./service-worker-register";
import { ProjectsProvider } from "@/contexts/projects-context";
import {
  PerformanceMonitorProvider,
  usePerformanceMonitorContext,
} from "@/contexts/performance-monitor-context";
import { GridBackground } from "./grid-background";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { useShouldReduceAnimations } from "@/lib/hooks/useSafari";
import { logError } from "@/lib/utils/dev-logger";
import { PenguinConsole } from "./penguin-console";
import { useKonamiCode } from "@/lib/hooks/useKonamiCode";
import { showToast } from "@/components/ui/toast";

const SplashScreen = dynamic(
  () => import("./splash-screen").then((mod) => mod.SplashScreen),
  { ssr: false },
);

// Fetched on intent and first mounted on the first open (load-terminal.ts).
// After a failed load, TerminalUnavailable tries again on Retry and on every
// reopen.
const Terminal = dynamic(
  withLoadFallback(
    () => loadTerminal().then((mod) => mod.Terminal),
    TerminalUnavailable,
    // dev-logger: error-logger's logError returns at once in a browser, so
    // this failure was never logged at all.
    {
      onError: (error) => logError(error, "Terminal chunk"),
      peek: () => loadedTerminal()?.Terminal,
    },
  ),
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
    useTerminalToggle();
  const [splashScreenComplete, setSplashScreenComplete] = useState(false);
  // The splash's backdrop is in the HTML (the splash itself loads with
  // ssr: false), so the page's first paint is the splash's rather than a
  // glimpse of the page it is about to cover. The page is generated once
  // for every visitor and hydrates with defaults; the visitor's theme,
  // browser, quality and animation choice are settled under it, unseen.
  const [splashShown, setSplashShown] = useState(false);
  const splashShownRef = useRef(false);
  const handleSplashShow = useCallback(() => {
    splashShownRef.current = true;
    setSplashShown(true);
  }, []);
  // On a slow connection the page can reach the screen before the splash
  // does: the timer below, or the stylesheet's fallback, uncovers it first.
  // Playing the splash then covered a page the visitor was already reading
  // and locked its scroll, so it is told to skip itself. It still does its
  // work (browser detection, the background, the projects) unseen.
  const [skipSplash, setSkipSplash] = useState(false);
  const showPageWithoutSplash = useCallback(() => {
    if (!splashShownRef.current) setSkipSplash(true);
  }, []);
  // Whatever happens to the splash's chunk, the page shows.
  useEffect(() => {
    const timer = setTimeout(showPageWithoutSplash, 4000);
    return () => clearTimeout(timer);
  }, [showPageWithoutSplash]);
  // If nothing removed the backdrop, globals.css hides it 6 s after the
  // first paint, with the animation splash-backdrop-timeout: before
  // hydration (its computed visibility, read on mount) or after it (its
  // animationend). A native listener: React's onAnimationEnd may listen
  // under a vendor-prefixed name.
  const backdropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const backdrop = backdropRef.current;
    if (!backdrop) return;
    if (getComputedStyle(backdrop).visibility === "hidden") {
      showPageWithoutSplash();
      return;
    }
    const onEnd = (event: AnimationEvent) => {
      if (event.animationName === "splash-backdrop-timeout") {
        showPageWithoutSplash();
      }
    };
    backdrop.addEventListener("animationend", onEnd);
    return () => backdrop.removeEventListener("animationend", onEnd);
  }, [showPageWithoutSplash]);
  const pathname = usePathname();

  // The terminal mounts on its first open and then stays mounted, as it did
  // from the end of the splash before: until a visitor opens it, neither its
  // code nor xterm is fetched. Set during render, React's pattern for state
  // derived from a previous render.
  const [terminalWanted, setTerminalWanted] = useState(isTerminalOpen);
  if (isTerminalOpen && !terminalWanted) setTerminalWanted(true);

  // /pdf/<slug> exists so a document can be opened directly. Playing the site
  // intro over it defeats the point, so skip the splash there and treat it as
  // already finished, which is also what gates the terminal.
  const isDirectDocument = pathname?.startsWith("/pdf/") ?? false;

  const handleSplashComplete = useCallback(() => {
    setSplashScreenComplete(true);
  }, []);

  // Easter egg: Konami code waddles a penguin toast.
  const handleKonami = useCallback(() => {
    showToast("🐧 Waddle mode unlocked: adaptation over accuracy.", "info");
  }, []);
  useKonamiCode(handleKonami);

  return (
    <ErrorBoundary>
      {/* The background comes from the root layout's BackgroundProvider. A
          second one here only shadowed it, as a separate copy of the same
          state for everything below. */}
      {/* AnimationProvider was mounted here with nothing under it consuming
          useAnimation - the context module was imported by this file alone.
          The module and its tests are kept; only the unused mount is gone. */}
      <PerformanceMonitorProvider>
        <ProjectsProvider>
          <ServiceWorkerRegister />
          <PenguinConsole />
          {/* Site-wide grid background with very low opacity - Disabled on Safari for performance */}
          {!shouldReduceAnimations && (
            <GridBackground
              className="fixed inset-0 z-0 opacity-30"
              restUnderCover
            />
          )}
          {/* Unmounted once it has played, which releases the Lottie player,
                its parsed animation and its SVG; while it stayed mounted,
                a theme toggle also re-fetched and replayed the other JSON. */}
          {!isDirectDocument &&
            !splashScreenComplete &&
            !splashShown &&
            !skipSplash && (
              // Hidden when scripts are off (a <noscript> rule in the layout),
              // and after 6 s if the bundle never runs (globals.css).
              <div
                ref={backdropRef}
                aria-hidden="true"
                data-splash-backdrop=""
                className="fixed inset-0 z-[10000] bg-background"
              />
            )}
          {!isDirectDocument && !splashScreenComplete && (
            <SplashScreen
              onShow={handleSplashShow}
              onComplete={handleSplashComplete}
              skip={skipSplash}
            />
          )}
          <div className="relative z-10">{children}</div>
          {/* Terminal Component - Only render after splash screen completes,
                and once it has been opened */}
          {terminalConfig.enabled &&
            terminalWanted &&
            (splashScreenComplete || isDirectDocument) && (
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
    </ErrorBoundary>
  );
}
