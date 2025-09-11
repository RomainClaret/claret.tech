"use client";

import { logWarning } from "@/lib/utils/dev-logger";

interface NetworkInformation {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface HardwareInfo {
  cpu: {
    cores: number;
    architecture: string | null;
    vendor: string | null;
  };
  memory: {
    deviceMemory: number | null; // GB
    jsHeapSizeLimit: number | null; // bytes
  };
  gpu: {
    vendor: string | null;
    renderer: string | null;
    tier: "low" | "medium" | "high" | "unknown";
  };
  display: {
    colorDepth: number;
    pixelRatio: number;
    screenResolution: string;
    maxTouchPoints: number;
  };
  platform: {
    userAgent: string;
    platform: string;
    language: string;
    timeZone: string;
  };
  capabilities: {
    webgl: boolean;
    webgl2: boolean;
    webgpu: boolean;
    webassembly: boolean;
    serviceWorker: boolean;
    indexedDB: boolean;
    localStorage: boolean;
    sessionStorage: boolean;
  };
  battery: {
    supported: boolean;
    charging: boolean | null;
    level: number | null;
  };
  connection: {
    effectiveType: string | null;
    downlink: number | null;
    rtt: number | null;
    saveData: boolean;
  };
}

export class HardwareDetector {
  private static instance: HardwareDetector;
  private hardwareInfo: HardwareInfo | null = null;

  private constructor() {}

  public static getInstance(): HardwareDetector {
    if (!HardwareDetector.instance) {
      HardwareDetector.instance = new HardwareDetector();
    }
    return HardwareDetector.instance;
  }

  public async detectHardware(): Promise<HardwareInfo> {
    if (this.hardwareInfo) {
      return this.hardwareInfo;
    }

    this.hardwareInfo = {
      cpu: await this.detectCpuInfo(),
      memory: this.detectMemoryInfo(),
      gpu: this.detectGpuInfo(),
      display: this.detectDisplayInfo(),
      platform: this.detectPlatformInfo(),
      capabilities: this.detectCapabilities(),
      battery: await this.detectBatteryInfo(),
      connection: this.detectConnectionInfo(),
    };

    return this.hardwareInfo;
  }

  private async detectCpuInfo(): Promise<HardwareInfo["cpu"]> {
    const cores = navigator.hardwareConcurrency || 4;

    // Try to detect CPU architecture from user agent
    let architecture: string | null = null;
    let vendor: string | null = null;

    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes("arm64") || userAgent.includes("aarch64")) {
      architecture = "ARM64";
    } else if (userAgent.includes("arm")) {
      architecture = "ARM";
    } else if (userAgent.includes("x86_64") || userAgent.includes("amd64")) {
      architecture = "x86_64";
    } else if (
      userAgent.includes("x86") ||
      userAgent.includes("i386") ||
      userAgent.includes("i686")
    ) {
      architecture = "x86";
    }

    // Try to detect CPU vendor (limited info available)
    if (userAgent.includes("intel")) {
      vendor = "Intel";
    } else if (userAgent.includes("amd")) {
      vendor = "AMD";
    } else if (userAgent.includes("apple") && architecture === "ARM64") {
      vendor = "Apple Silicon";
    } else if (architecture?.includes("ARM")) {
      vendor = "ARM";
    }

    return {
      cores,
      architecture,
      vendor,
    };
  }

  private detectMemoryInfo(): HardwareInfo["memory"] {
    let deviceMemory: number | null = null;
    let jsHeapSizeLimit: number | null = null;

    // Device Memory API (experimental)
    if ("deviceMemory" in navigator) {
      deviceMemory = (navigator as unknown as { deviceMemory: number })
        .deviceMemory;
    }

    // JavaScript memory info (Chrome-specific)
    if ("memory" in performance) {
      const memoryInfo = (
        performance as unknown as { memory: { jsHeapSizeLimit: number } }
      ).memory;
      jsHeapSizeLimit = memoryInfo.jsHeapSizeLimit;
    }

    return {
      deviceMemory,
      jsHeapSizeLimit,
    };
  }

  private detectGpuInfo(): HardwareInfo["gpu"] {
    let vendor: string | null = null;
    let renderer: string | null = null;
    let tier: "low" | "medium" | "high" | "unknown" = "unknown";

    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

      if (gl && "getExtension" in gl) {
        // Try to get unmasked GPU info
        const debugInfo = (gl as WebGLRenderingContext).getExtension(
          "WEBGL_debug_renderer_info",
        );

        const glContext = gl as WebGLRenderingContext;
        if (debugInfo) {
          vendor = glContext.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          renderer = glContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        } else {
          vendor = glContext.getParameter(glContext.VENDOR);
          renderer = glContext.getParameter(glContext.RENDERER);
        }

        // Determine GPU tier based on renderer string
        if (renderer) {
          const rendererLower = renderer.toLowerCase();

          // High-end GPUs
          if (
            rendererLower.includes("rtx") ||
            rendererLower.includes("gtx 1080") ||
            rendererLower.includes("gtx 1070") ||
            rendererLower.includes("rx 6") ||
            rendererLower.includes("rx 7") ||
            rendererLower.includes("m1 pro") ||
            rendererLower.includes("m1 max") ||
            rendererLower.includes("m2") ||
            rendererLower.includes("quadro")
          ) {
            tier = "high";
          }
          // Medium-end GPUs
          else if (
            rendererLower.includes("gtx") ||
            rendererLower.includes("rx ") ||
            rendererLower.includes("radeon") ||
            rendererLower.includes("m1") ||
            rendererLower.includes("iris")
          ) {
            tier = "medium";
          }
          // Low-end or integrated GPUs
          else if (
            rendererLower.includes("intel") ||
            rendererLower.includes("uhd") ||
            rendererLower.includes("hd graphics") ||
            rendererLower.includes("integrated")
          ) {
            tier = "low";
          }
        }
      }
    } catch {
      // Only log in non-test environments to avoid test stderr pollution
      if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
        logWarning("Failed to detect GPU info", "Hardware Detector");
      }
    }

    return {
      vendor,
      renderer,
      tier,
    };
  }

  private detectDisplayInfo(): HardwareInfo["display"] {
    return {
      colorDepth: screen.colorDepth || 24,
      pixelRatio: window.devicePixelRatio || 1,
      screenResolution: `${screen.width}x${screen.height}`,
      maxTouchPoints: navigator.maxTouchPoints || 0,
    };
  }

  private detectPlatformInfo(): HardwareInfo["platform"] {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform || "unknown",
      language: navigator.language || "unknown",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
    };
  }

  private detectCapabilities(): HardwareInfo["capabilities"] {
    const testWebGL = (): boolean => {
      try {
        const canvas = document.createElement("canvas");
        return !!(
          canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
        );
      } catch {
        return false;
      }
    };

    const testWebGL2 = (): boolean => {
      try {
        const canvas = document.createElement("canvas");
        return !!canvas.getContext("webgl2");
      } catch {
        return false;
      }
    };

    return {
      webgl: testWebGL(),
      webgl2: testWebGL2(),
      webgpu: "gpu" in navigator,
      webassembly: typeof WebAssembly !== "undefined",
      serviceWorker: "serviceWorker" in navigator,
      indexedDB: "indexedDB" in window,
      localStorage: typeof Storage !== "undefined" && !!window.localStorage,
      sessionStorage: typeof Storage !== "undefined" && !!window.sessionStorage,
    };
  }

  private async detectBatteryInfo(): Promise<HardwareInfo["battery"]> {
    try {
      // Battery Status API (deprecated but still available in some browsers)
      if (
        "getBattery" in navigator &&
        typeof (
          navigator as Navigator & {
            getBattery?: () => Promise<{ charging: boolean; level: number }>;
          }
        ).getBattery === "function"
      ) {
        const battery = await (
          navigator as unknown as {
            getBattery: () => Promise<{ charging: boolean; level: number }>;
          }
        ).getBattery();
        return {
          supported: true,
          charging: battery.charging,
          level: battery.level,
        };
      }
    } catch {
      // Only log in non-test environments to avoid test stderr pollution
      if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
        logWarning("Battery API not available", "Hardware Detector");
      }
    }

    return {
      supported: false,
      charging: null,
      level: null,
    };
  }

  private detectConnectionInfo(): HardwareInfo["connection"] {
    try {
      const connection =
        (navigator as unknown as { connection?: NetworkInformation })
          .connection ||
        (navigator as unknown as { mozConnection?: NetworkInformation })
          .mozConnection ||
        (navigator as unknown as { webkitConnection?: NetworkInformation })
          .webkitConnection;

      if (connection) {
        return {
          effectiveType: connection.effectiveType || null,
          downlink: connection.downlink || null,
          rtt: connection.rtt || null,
          saveData: connection.saveData || false,
        };
      }
    } catch {
      logWarning("Network Information API not available", "Hardware Detector");
    }

    return {
      effectiveType: null,
      downlink: null,
      rtt: null,
      saveData: false,
    };
  }

  public getCpuCores(): number {
    return navigator.hardwareConcurrency || 4;
  }

  public getDeviceMemory(): number | null {
    if ("deviceMemory" in navigator) {
      return (navigator as unknown as { deviceMemory: number }).deviceMemory;
    }
    return null;
  }

  public getGpuTier(): "low" | "medium" | "high" | "unknown" {
    if (this.hardwareInfo) {
      return this.hardwareInfo.gpu.tier;
    }

    // Quick detection without full initialization
    const gpuInfo = this.detectGpuInfo();
    return gpuInfo.tier;
  }

  public isHighPerformanceDevice(): boolean {
    const cores = this.getCpuCores();
    const gpuTier = this.getGpuTier();
    const deviceMemory = this.getDeviceMemory();

    return (
      cores >= 8 ||
      gpuTier === "high" ||
      (deviceMemory !== null && deviceMemory >= 8)
    );
  }

  public isMobileDevice(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    return (
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent,
      ) || navigator.maxTouchPoints > 0
    );
  }

  public refresh(): void {
    this.hardwareInfo = null;
  }
}
