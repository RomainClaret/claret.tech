// Browser API type extensions
// Provides proper typing for browser APIs that aren't fully covered by standard TypeScript libs

// Network Information API (experimental)
export interface NavigatorConnection {
  readonly effectiveType?: "2g" | "3g" | "4g" | "slow-2g";
  readonly downlink?: number;
  readonly rtt?: number;
  readonly saveData?: boolean;
  readonly type?:
    | "bluetooth"
    | "cellular"
    | "ethernet"
    | "mixed"
    | "none"
    | "other"
    | "unknown"
    | "wifi"
    | "wimax";
  onchange?: ((this: NavigatorConnection, ev: Event) => void) | null;
  addEventListener(type: "change", listener: (ev: Event) => void): void;
  removeEventListener(type: "change", listener: (ev: Event) => void): void;
}

// Extended Navigator interface with connection API
export interface NavigatorWithConnection extends Navigator {
  readonly connection?: NavigatorConnection;
  readonly mozConnection?: NavigatorConnection;
  readonly webkitConnection?: NavigatorConnection;
}

// Performance API extensions
export interface PerformanceEntryWithTransferSize extends PerformanceEntry {
  transferSize?: number;
  encodedBodySize?: number;
  decodedBodySize?: number;
}

// Memory API (Chrome specific)
export interface PerformanceMemoryInfo {
  readonly usedJSHeapSize: number;
  readonly totalJSHeapSize: number;
  readonly jsHeapSizeLimit: number;
}

export interface PerformanceWithMemory extends Performance {
  readonly memory?: PerformanceMemoryInfo;
}

// Screen API extensions
export interface ScreenWithOrientation extends Screen {
  readonly orientation?: {
    readonly angle: number;
    readonly type:
      | "portrait-primary"
      | "portrait-secondary"
      | "landscape-primary"
      | "landscape-secondary";
    onchange?: ((this: ScreenOrientation, ev: Event) => void) | null;
  };
}

// Global declarations for use throughout the application
declare global {
  interface Window {
    webkitRequestAnimationFrame?: (callback: FrameRequestCallback) => number;
    mozRequestAnimationFrame?: (callback: FrameRequestCallback) => number;
    msRequestAnimationFrame?: (callback: FrameRequestCallback) => number;
    webkitCancelAnimationFrame?: (handle: number) => void;
    mozCancelAnimationFrame?: (handle: number) => void;
    msCancelAnimationFrame?: (handle: number) => void;
  }

  interface Navigator {
    deviceMemory?: number;
    hardwareConcurrency?: number;
    connection?: NavigatorConnection;
    mozConnection?: NavigatorConnection;
    webkitConnection?: NavigatorConnection;
  }

  interface Performance {
    memory?: PerformanceMemoryInfo;
  }

  interface Screen {
    orientation?: {
      readonly angle: number;
      readonly type: string;
      onchange?: ((this: ScreenOrientation, ev: Event) => void) | null;
    };
  }
}

// Export empty object to make this a module
export {};
