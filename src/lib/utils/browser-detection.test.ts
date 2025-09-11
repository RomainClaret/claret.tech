import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { detectBrowser, shouldReduceAnimations } from "./browser-detection";
import {
  detectSafari,
  storeSafariDetection,
  parseSafariFromCookieString,
  getSafariFromNextCookies,
  getAnimationPreference,
  storeAnimationPreference,
  clearAnimationPreference,
  shouldResetAnimationPreference,
} from "./safari-detection";
import { HardwareDetector } from "./hardware-detector";

// Mock DOM APIs with proper types
interface MockBatteryManager {
  charging: boolean;
  level: number;
}

interface MockNetworkInformation {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

interface MockNavigator {
  userAgent: string;
  hardwareConcurrency: number;
  platform: string;
  language: string;
  maxTouchPoints: number;
  connection: MockNetworkInformation | undefined;
  getBattery: (() => Promise<MockBatteryManager>) | null;
  memory: unknown;
  deviceMemory: number | undefined;
}

interface MockScreen extends Partial<Screen> {
  width: number;
  height: number;
  colorDepth: number;
}

interface MockWindow {
  devicePixelRatio: number;
  navigator: MockNavigator;
  screen: MockScreen;
}

interface MockDocument extends Partial<Document> {
  cookie: string;
  createElement: ReturnType<typeof vi.fn>;
}

interface MockLocalStorage extends Partial<Storage> {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
}

interface MockPerformance extends Partial<Performance> {
  memory: {
    jsHeapSizeLimit: number;
    usedJSHeapSize: number;
    totalJSHeapSize: number;
  };
}

const mockNavigator: MockNavigator = {
  userAgent: "",
  hardwareConcurrency: 4,
  platform: "MacIntel",
  language: "en-US",
  maxTouchPoints: 0,
  connection: undefined,
  getBattery: null,
  memory: null,
  deviceMemory: undefined,
};

const mockScreen: MockScreen = {
  width: 1920,
  height: 1080,
  colorDepth: 24,
};

const mockWindow: MockWindow = {
  devicePixelRatio: 2,
  navigator: mockNavigator,
  screen: mockScreen,
};

const mockDocument: MockDocument = {
  cookie: "",
  createElement: vi.fn(),
};

const mockLocalStorage: MockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

const mockPerformance: MockPerformance = {
  memory: {
    jsHeapSizeLimit: 4294967296, // 4GB
    usedJSHeapSize: 1073741824, // 1GB
    totalJSHeapSize: 2147483648, // 2GB
  },
};

describe("Browser and Hardware Detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup global mocks
    Object.defineProperty(global, "window", {
      value: mockWindow,
      writable: true,
    });

    Object.defineProperty(global, "screen", {
      value: mockScreen,
      writable: true,
    });

    Object.defineProperty(global, "document", {
      value: mockDocument,
      writable: true,
    });

    Object.defineProperty(global, "localStorage", {
      value: mockLocalStorage,
      writable: true,
    });

    Object.defineProperty(global, "performance", {
      value: mockPerformance,
      writable: true,
    });

    Object.defineProperty(global, "navigator", {
      value: mockNavigator,
      writable: true,
    });

    // Mock canvas creation for GPU detection
    const mockCanvas = {
      getContext: vi.fn(),
    };
    mockDocument.createElement.mockReturnValue(mockCanvas);

    // Reset navigator properties
    mockNavigator.userAgent =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
    mockNavigator.hardwareConcurrency = 4;
    mockNavigator.connection = undefined;
    mockNavigator.getBattery = null;
    mockDocument.cookie = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("detectBrowser", () => {
    it("detects Safari correctly", () => {
      mockNavigator.userAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/14.1.1 Safari/537.36";

      const result = detectBrowser();

      expect(result.isSafari).toBe(true);
      expect(result.isChrome).toBe(false);
      expect(result.isFirefox).toBe(false);
      expect(result.isEdge).toBe(false);
      expect(result.shouldReduceAnimations).toBe(true);
    });

    it("detects Chrome correctly", () => {
      mockNavigator.userAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

      const result = detectBrowser();

      expect(result.isSafari).toBe(false);
      expect(result.isChrome).toBe(true);
      expect(result.isFirefox).toBe(false);
      expect(result.isEdge).toBe(false);
      expect(result.shouldReduceAnimations).toBe(false);
    });

    it("detects Firefox correctly", () => {
      mockNavigator.userAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0";

      const result = detectBrowser();

      expect(result.isSafari).toBe(false);
      expect(result.isChrome).toBe(false);
      expect(result.isFirefox).toBe(true);
      expect(result.isEdge).toBe(false);
    });

    it("detects Edge correctly", () => {
      mockNavigator.userAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.64";

      const result = detectBrowser();

      expect(result.isSafari).toBe(false);
      expect(result.isChrome).toBe(false);
      expect(result.isFirefox).toBe(false);
      expect(result.isEdge).toBe(true);
    });

    it("uses Safari from cookie when available", () => {
      mockDocument.cookie = "safari-detected=true; other=value";
      mockNavigator.userAgent = "Mozilla/5.0 Chrome"; // Non-Safari UA

      const result = detectBrowser();

      expect(result.isSafari).toBe(true); // Should use cookie value
    });

    it("handles server-side rendering", () => {
      Object.defineProperty(global, "window", {
        value: undefined,
        writable: true,
      });

      const result = detectBrowser();

      expect(result.isSafari).toBe(false);
      expect(result.isChrome).toBe(false);
      expect(result.isFirefox).toBe(false);
      expect(result.isEdge).toBe(false);
      expect(result.userAgent).toBe("");
    });
  });

  describe("Safari Detection", () => {
    it("detects Safari from localStorage", () => {
      const safariDetection = {
        isSafari: true,
        source: "localStorage",
        timestamp: Date.now(),
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(safariDetection));

      const result = detectSafari();

      expect(result.isSafari).toBe(true);
      expect(result.source).toBe("localStorage");
    });

    it("ignores expired localStorage detection", () => {
      const expiredDetection = {
        isSafari: true,
        source: "localStorage",
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours old
      };
      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify(expiredDetection),
      );
      mockDocument.cookie = "safari-detected=false";

      const result = detectSafari();

      expect(result.source).toBe("cookie"); // Should fallback to cookie
      expect(result.isSafari).toBe(false);
    });

    it("falls back to cookie detection", () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      mockDocument.cookie = "safari-detected=true; other=value";

      const result = detectSafari();

      expect(result.isSafari).toBe(true);
      expect(result.source).toBe("cookie");
    });

    it("falls back to user agent detection", () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      mockDocument.cookie = "";
      mockNavigator.userAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/14.1.1 Safari/537.36";

      const result = detectSafari();

      expect(result.isSafari).toBe(true);
      expect(result.source).toBe("userAgent");
    });

    it("stores Safari detection in localStorage", () => {
      storeSafariDetection(true, "userAgent");

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "browser-detection",
        expect.stringContaining('"isSafari":true'),
      );
    });

    it("parses Safari from cookie string correctly", () => {
      expect(
        parseSafariFromCookieString("safari-detected=true; other=value"),
      ).toBe(true);
      expect(
        parseSafariFromCookieString("safari-detected=false; other=value"),
      ).toBe(false);
      expect(parseSafariFromCookieString("other=value")).toBe(false);
      expect(parseSafariFromCookieString("")).toBe(false);
    });

    it("handles Next.js cookies correctly", () => {
      const mockCookieStore = {
        get: vi.fn((key: string) =>
          key === "safari-detected" ? { value: "true" } : undefined,
        ),
      };

      expect(getSafariFromNextCookies(mockCookieStore)).toBe(true);

      mockCookieStore.get.mockReturnValue(undefined);
      expect(getSafariFromNextCookies(mockCookieStore)).toBe(true); // Fallback to safe mode
    });

    it("distinguishes Safari from Chrome on macOS", () => {
      // Chrome includes Safari in user agent but should not be detected as Safari
      mockNavigator.userAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
      mockLocalStorage.getItem.mockReturnValue(null);
      mockDocument.cookie = "";

      const result = detectSafari();

      expect(result.isSafari).toBe(false);
    });
  });

  describe("Animation Preferences", () => {
    it("stores and retrieves animation preferences", () => {
      storeAnimationPreference(false, true, true);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "background-animations-state",
        expect.stringContaining('"browser":"safari"'),
      );
    });

    it("handles legacy boolean animation preferences", () => {
      mockLocalStorage.getItem.mockReturnValue("true");

      const result = getAnimationPreference();

      expect(result?.value).toBe(true);
      expect(result?.browser).toBe("other");
      expect(result?.isUserPreference).toBe(true);
    });

    it("detects browser changes requiring preference reset", () => {
      const safariPreference = {
        value: false,
        browser: "safari",
        isUserPreference: true,
        timestamp: Date.now(),
      };
      mockLocalStorage.getItem.mockReturnValue(
        JSON.stringify(safariPreference),
      );

      // Now on Chrome, should reset
      expect(shouldResetAnimationPreference(false)).toBe(true);
      // Still on Safari, should not reset
      expect(shouldResetAnimationPreference(true)).toBe(false);
    });

    it("clears animation preference", () => {
      clearAnimationPreference();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        "background-animations-state",
      );
    });
  });

  describe("shouldReduceAnimations", () => {
    it("returns true for Safari", () => {
      mockNavigator.userAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Version/14.1.1 Safari/537.36";

      expect(shouldReduceAnimations()).toBe(true);
    });

    it("returns false for non-Safari browsers", () => {
      mockNavigator.userAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

      expect(shouldReduceAnimations()).toBe(false);
    });
  });

  describe("HardwareDetector", () => {
    let detector: HardwareDetector;

    beforeEach(() => {
      detector = HardwareDetector.getInstance();
      detector.refresh(); // Clear cached data
    });

    it("implements singleton pattern", () => {
      const detector1 = HardwareDetector.getInstance();
      const detector2 = HardwareDetector.getInstance();

      expect(detector1).toBe(detector2);
    });

    it("detects CPU information", async () => {
      mockNavigator.hardwareConcurrency = 8;
      mockNavigator.userAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; ARM64) AppleWebKit/537.36";

      const hardware = await detector.detectHardware();

      expect(hardware.cpu.cores).toBe(8);
      expect(hardware.cpu.architecture).toBe("ARM64");
    });

    it("detects memory information", async () => {
      mockNavigator.deviceMemory = 16;

      const hardware = await detector.detectHardware();

      expect(hardware.memory.deviceMemory).toBe(16);
      expect(hardware.memory.jsHeapSizeLimit).toBe(4294967296);
    });

    it("detects GPU information and tier", async () => {
      const mockGLContext = {
        getExtension: vi.fn().mockReturnValue({
          UNMASKED_VENDOR_WEBGL: 37445,
          UNMASKED_RENDERER_WEBGL: 37446,
        }),
        getParameter: vi
          .fn()
          .mockReturnValueOnce("Apple")
          .mockReturnValueOnce("Apple M1 Pro"),
        VENDOR: 7936,
        RENDERER: 7937,
      };

      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(mockGLContext),
      };
      mockDocument.createElement.mockReturnValue(mockCanvas);

      const hardware = await detector.detectHardware();

      expect(hardware.gpu.vendor).toBe("Apple");
      expect(hardware.gpu.renderer).toBe("Apple M1 Pro");
      expect(hardware.gpu.tier).toBe("high"); // M1 Pro should be high tier
    });

    it("classifies GPU tiers correctly", async () => {
      const testCases = [
        { renderer: "NVIDIA GeForce RTX 3080", expected: "high" },
        { renderer: "AMD Radeon RX 6800 XT", expected: "high" },
        { renderer: "NVIDIA GeForce GTX 1060", expected: "medium" },
        { renderer: "Intel HD Graphics 620", expected: "low" },
        { renderer: "Unknown GPU", expected: "unknown" },
      ];

      for (const testCase of testCases) {
        const mockGLContext = {
          getExtension: vi.fn().mockReturnValue(null),
          getParameter: vi
            .fn()
            .mockReturnValueOnce("Test Vendor")
            .mockReturnValueOnce(testCase.renderer),
          VENDOR: 7936,
          RENDERER: 7937,
        };

        const mockCanvas = {
          getContext: vi.fn().mockReturnValue(mockGLContext),
        };
        mockDocument.createElement.mockReturnValue(mockCanvas);

        detector.refresh(); // Clear cache
        const hardware = await detector.detectHardware();

        expect(hardware.gpu.tier).toBe(testCase.expected);
      }
    });

    it("detects display information", async () => {
      const hardware = await detector.detectHardware();

      expect(hardware.display.colorDepth).toBe(24);
      expect(hardware.display.pixelRatio).toBe(2);
      expect(hardware.display.screenResolution).toBe("1920x1080");
      expect(hardware.display.maxTouchPoints).toBe(0);
    });

    it("detects platform information", async () => {
      const hardware = await detector.detectHardware();

      expect(hardware.platform.userAgent).toContain("Mozilla");
      expect(hardware.platform.platform).toBe("MacIntel");
      expect(hardware.platform.language).toBe("en-US");
    });

    it("detects capabilities", async () => {
      const mockCanvas = {
        getContext: vi.fn().mockReturnValue({}), // Mock WebGL context exists
      };
      mockDocument.createElement.mockReturnValue(mockCanvas);

      Object.defineProperty(global, "WebAssembly", {
        value: {},
        writable: true,
      });

      const hardware = await detector.detectHardware();

      expect(hardware.capabilities.webgl).toBe(true);
      expect(hardware.capabilities.webassembly).toBe(true);
      expect(hardware.capabilities.serviceWorker).toBe(false); // Not mocked
    });

    it("detects battery information when available", async () => {
      const mockBattery: MockBatteryManager = {
        charging: true,
        level: 0.8,
      };
      mockNavigator.getBattery = vi.fn().mockResolvedValue(mockBattery);

      const hardware = await detector.detectHardware();

      expect(hardware.battery.supported).toBe(true);
      expect(hardware.battery.charging).toBe(true);
      expect(hardware.battery.level).toBe(0.8);
    });

    it("handles missing battery API gracefully", async () => {
      mockNavigator.getBattery = null;

      const hardware = await detector.detectHardware();

      expect(hardware.battery.supported).toBe(false);
      expect(hardware.battery.charging).toBe(null);
      expect(hardware.battery.level).toBe(null);
    });

    it("detects network connection information", async () => {
      const mockConnection: MockNetworkInformation = {
        effectiveType: "4g",
        downlink: 10,
        rtt: 100,
        saveData: false,
      };
      mockNavigator.connection = mockConnection;

      const hardware = await detector.detectHardware();

      expect(hardware.connection.effectiveType).toBe("4g");
      expect(hardware.connection.downlink).toBe(10);
      expect(hardware.connection.rtt).toBe(100);
      expect(hardware.connection.saveData).toBe(false);
    });

    it("provides quick access methods", () => {
      mockNavigator.hardwareConcurrency = 8;
      mockNavigator.deviceMemory = 16;

      expect(detector.getCpuCores()).toBe(8);
      expect(detector.getDeviceMemory()).toBe(16);
    });

    it("determines if device is high performance", () => {
      mockNavigator.hardwareConcurrency = 8;
      mockNavigator.deviceMemory = 16;

      expect(detector.isHighPerformanceDevice()).toBe(true);

      mockNavigator.hardwareConcurrency = 2;
      mockNavigator.deviceMemory = 4;
      detector.refresh();

      expect(detector.isHighPerformanceDevice()).toBe(false);
    });

    it("detects mobile devices", () => {
      mockNavigator.userAgent =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15";

      expect(detector.isMobileDevice()).toBe(true);

      mockNavigator.userAgent =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
      expect(detector.isMobileDevice()).toBe(false);
    });

    it("caches hardware detection results", async () => {
      const hardware1 = await detector.detectHardware();
      const hardware2 = await detector.detectHardware();

      expect(hardware1).toBe(hardware2); // Should return same instance
    });

    it("refreshes cached data when requested", async () => {
      await detector.detectHardware();

      mockNavigator.hardwareConcurrency = 16; // Change value
      detector.refresh();

      const newHardware = await detector.detectHardware();
      expect(newHardware.cpu.cores).toBe(16);
    });

    it("handles WebGL detection errors gracefully", async () => {
      const mockCanvas = {
        getContext: vi.fn().mockImplementation(() => {
          throw new Error("WebGL not supported");
        }),
      };
      mockDocument.createElement.mockReturnValue(mockCanvas);

      const hardware = await detector.detectHardware();

      expect(hardware.gpu.vendor).toBe(null);
      expect(hardware.gpu.renderer).toBe(null);
      expect(hardware.gpu.tier).toBe("unknown");
    });
  });
});
