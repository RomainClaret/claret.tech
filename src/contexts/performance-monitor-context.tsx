"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import type { MonitoringOptions } from "@/lib/hooks/usePerformanceMonitor";

interface PerformanceMonitorContextType {
  isMonitorActive: boolean;
  showPerformanceMonitor: () => void;
  hidePerformanceMonitor: () => void;
  togglePerformanceMonitor: () => void;
  // Monitoring options control
  monitoringOptions: MonitoringOptions;
  updateMonitoringOptions: (options: Partial<MonitoringOptions>) => void;
  toggleMonitoringOption: (option: keyof MonitoringOptions) => void;
  enableAllMonitoring: () => void;
  disableAllMonitoring: () => void;
  // Dashboard modal state
  isDashboardOpen: boolean;
  showDashboard: () => void;
  hideDashboard: () => void;
  toggleDashboard: () => void;
  // Report generation state
  isGeneratingReport: boolean;
  reportProgress: { phase: string; progress: number };
  generateReport: () => void;
  isReportModalOpen: boolean;
  showReportModal: () => void;
  hideReportModal: () => void;
}

const PerformanceMonitorContext = createContext<
  PerformanceMonitorContextType | undefined
>(undefined);

export function PerformanceMonitorProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isMonitorActive, setIsMonitorActive] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportProgress, setReportProgress] = useState({
    phase: "",
    progress: 0,
  });
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Default monitoring options - only FPS enabled for performance
  const [monitoringOptions, setMonitoringOptions] = useState<MonitoringOptions>(
    {
      fps: true,
      webVitals: false,
      cpu: false,
      gpu: false,
      memory: false,
      network: false,
      resources: false,
      longTasks: false,
      hardware: false,
    },
  );

  const showPerformanceMonitor = useCallback(() => {
    setIsMonitorActive(true);
  }, []);

  const hidePerformanceMonitor = useCallback(() => {
    setIsMonitorActive(false);
  }, []);

  const togglePerformanceMonitor = useCallback(() => {
    setIsMonitorActive((prev) => !prev);
  }, []);

  const updateMonitoringOptions = useCallback(
    (options: Partial<MonitoringOptions>) => {
      setMonitoringOptions((prev) => ({ ...prev, ...options }));
    },
    [],
  );

  const toggleMonitoringOption = useCallback(
    (option: keyof MonitoringOptions) => {
      setMonitoringOptions((prev) => ({
        ...prev,
        [option]: !prev[option],
      }));
    },
    [],
  );

  const enableAllMonitoring = useCallback(() => {
    setMonitoringOptions({
      fps: true,
      webVitals: true,
      cpu: true,
      gpu: true,
      memory: true,
      network: true,
      resources: true,
      longTasks: true,
      hardware: true,
    });
  }, []);

  const disableAllMonitoring = useCallback(() => {
    setMonitoringOptions({
      fps: true, // Keep FPS as it's the basic monitor
      webVitals: false,
      cpu: false,
      gpu: false,
      memory: false,
      network: false,
      resources: false,
      longTasks: false,
      hardware: false,
    });
  }, []);

  const showDashboard = useCallback(() => {
    setIsDashboardOpen(true);
  }, []);

  const hideDashboard = useCallback(() => {
    setIsDashboardOpen(false);
  }, []);

  const toggleDashboard = useCallback(() => {
    setIsDashboardOpen((prev) => !prev);
  }, []);

  const showReportModal = useCallback(() => {
    setIsReportModalOpen(true);
  }, []);

  const hideReportModal = useCallback(() => {
    setIsReportModalOpen(false);
    setIsGeneratingReport(false);
    setReportProgress({ phase: "", progress: 0 });
  }, []);

  const generateReport = useCallback(() => {
    setIsGeneratingReport(true);
    setIsReportModalOpen(true);
    // Trigger report generation event
    window.dispatchEvent(
      new CustomEvent("terminal-generate-performance-report"),
    );
  }, []);

  // Global keyboard shortcut - Development mode only
  useEffect(() => {
    // Only enable keyboard shortcut in development mode
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === "P") {
        event.preventDefault();
        togglePerformanceMonitor();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePerformanceMonitor]);

  // Listen for terminal fps command events
  useEffect(() => {
    const handleFpsCommand = () => {
      showPerformanceMonitor();
    };

    const handleFullMonitoring = () => {
      enableAllMonitoring();
    };

    window.addEventListener("terminal-fps-command", handleFpsCommand);
    window.addEventListener(
      "terminal-enable-full-monitoring",
      handleFullMonitoring,
    );
    return () => {
      window.removeEventListener("terminal-fps-command", handleFpsCommand);
      window.removeEventListener(
        "terminal-enable-full-monitoring",
        handleFullMonitoring,
      );
    };
  }, [showPerformanceMonitor, enableAllMonitoring]);

  // Listen for terminal performance dashboard commands
  useEffect(() => {
    const handleDashboardCommand = (event: CustomEvent) => {
      // Validate token for security (basic implementation)
      const { token, timestamp } = event.detail || {};
      const now = Date.now();

      // Token should be recent (within 10 seconds) and exist
      if (token && timestamp && now - timestamp < 10000) {
        showDashboard();
      }
    };

    const handleDashboardClose = () => {
      hideDashboard();
    };

    const handleDashboardReport = () => {
      // Generate actual performance report
      generateReport();
    };

    window.addEventListener(
      "terminal-performance-dashboard",
      handleDashboardCommand as EventListener,
    );
    window.addEventListener("terminal-performance-close", handleDashboardClose);
    window.addEventListener(
      "terminal-performance-report",
      handleDashboardReport,
    );

    return () => {
      window.removeEventListener(
        "terminal-performance-dashboard",
        handleDashboardCommand as EventListener,
      );
      window.removeEventListener(
        "terminal-performance-close",
        handleDashboardClose,
      );
      window.removeEventListener(
        "terminal-performance-report",
        handleDashboardReport,
      );
    };
  }, [showDashboard, hideDashboard, generateReport]);

  // Listen for report progress updates
  useEffect(() => {
    const handleReportProgress = (event: CustomEvent) => {
      const { phase, progress } = event.detail || {};
      setReportProgress({ phase: phase || "", progress: progress || 0 });
    };

    const handleReportComplete = () => {
      setIsGeneratingReport(false);
    };

    const handleReportError = () => {
      setIsGeneratingReport(false);
    };

    window.addEventListener(
      "performance-report-progress",
      handleReportProgress as EventListener,
    );
    window.addEventListener(
      "performance-report-complete",
      handleReportComplete,
    );
    window.addEventListener("performance-report-error", handleReportError);

    return () => {
      window.removeEventListener(
        "performance-report-progress",
        handleReportProgress as EventListener,
      );
      window.removeEventListener(
        "performance-report-complete",
        handleReportComplete,
      );
      window.removeEventListener("performance-report-error", handleReportError);
    };
  }, []);

  // Listen for ESC key to close monitor when active
  useEffect(() => {
    if (!isMonitorActive) return;

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        hidePerformanceMonitor();
      }
    };

    window.addEventListener("keydown", handleEscKey);
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [isMonitorActive, hidePerformanceMonitor]);

  return (
    <PerformanceMonitorContext.Provider
      value={{
        isMonitorActive,
        showPerformanceMonitor,
        hidePerformanceMonitor,
        togglePerformanceMonitor,
        monitoringOptions,
        updateMonitoringOptions,
        toggleMonitoringOption,
        enableAllMonitoring,
        disableAllMonitoring,
        isDashboardOpen,
        showDashboard,
        hideDashboard,
        toggleDashboard,
        isGeneratingReport,
        reportProgress,
        generateReport,
        isReportModalOpen,
        showReportModal,
        hideReportModal,
      }}
    >
      {children}
    </PerformanceMonitorContext.Provider>
  );
}

export function usePerformanceMonitorContext() {
  const context = useContext(PerformanceMonitorContext);
  if (context === undefined) {
    throw new Error(
      "usePerformanceMonitorContext must be used within a PerformanceMonitorProvider",
    );
  }
  return context;
}
