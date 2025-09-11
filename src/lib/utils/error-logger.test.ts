import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  logError,
  logWarning,
  logInfo,
  logApiError,
  logPerformanceIssue,
} from "./error-logger";

// Mock the dev-logger module to prevent it from interfering
vi.mock("./dev-logger", () => ({
  devError: vi.fn(),
  devWarn: vi.fn(),
  devInfo: vi.fn(),
  devLog: vi.fn(),
  devDebug: vi.fn(),
}));

// Mock console methods - these will be set up in beforeEach
let mockConsoleError: ReturnType<typeof vi.spyOn>;
let mockConsoleWarn: ReturnType<typeof vi.spyOn>;
let mockConsoleInfo: ReturnType<typeof vi.spyOn>;

// Mock environment
const originalWindow = global.window;

describe("Privacy-First Error Logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up console spies fresh for each test
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockConsoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockConsoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    // Simulate server environment (no window)
    delete (global as Record<string, unknown>).window;
    // Reset NODE_ENV to test default
    (process.env as any).NODE_ENV = "test";
  });

  afterEach(() => {
    global.window = originalWindow;
    // Restore NODE_ENV
    (process.env as any).NODE_ENV = "test";
  });

  describe("logError", () => {
    it("logs errors in production environment", () => {
      (process.env as any).NODE_ENV = "production";

      const error = new Error("Test error");
      logError(error, { userId: "sensitive-id", publicInfo: "safe" });

      expect(mockConsoleError).toHaveBeenCalledOnce();
      const logCall = mockConsoleError.mock.calls[0];
      const logEntry = JSON.parse(logCall[1] as string);

      expect(logEntry.level).toBe("error");
      expect(logEntry.message).toBe("Test error");
      expect(logEntry.stack).toContain("Test error");
      expect(logEntry.environment).toBe("production");
      expect(logEntry.context.userId).toBe("[REDACTED]"); // Sensitive data redacted
      expect(logEntry.context.publicInfo).toBe("safe"); // Safe data preserved
    });

    it("does not log in browser environment", () => {
      (process.env as any).NODE_ENV = "production";
      global.window = {} as Window & typeof globalThis; // Simulate browser

      const error = new Error("Test error");
      logError(error);

      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it("falls back to dev logger in development", () => {
      (process.env as any).NODE_ENV = "development";

      // Mock dev-logger
      vi.doMock("./dev-logger", () => ({
        devError: vi.fn(),
      }));

      const error = new Error("Test error");
      logError(error, { test: "context" });

      // Should not use production console logging in dev
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });

  describe("Context Sanitization", () => {
    it("redacts sensitive keys", () => {
      (process.env as any).NODE_ENV = "production";

      const error = new Error("Test error");
      logError(error, {
        authorization: "Bearer secret-token",
        password: "secret123",
        email: "user@example.com",
        safeData: "this is fine",
        nested: {
          token: "secret",
          publicInfo: "safe",
        },
      });

      const logCall = mockConsoleError.mock.calls[0];
      const logEntry = JSON.parse(logCall[1] as string);

      expect(logEntry.context.authorization).toBe("[REDACTED]");
      expect(logEntry.context.password).toBe("[REDACTED]");
      expect(logEntry.context.email).toBe("[REDACTED]");
      expect(logEntry.context.safeData).toBe("this is fine");
      expect(logEntry.context.nested.token).toBe("[REDACTED]");
      expect(logEntry.context.nested.publicInfo).toBe("safe");
    });

    it("truncates very long strings", () => {
      (process.env as any).NODE_ENV = "production";

      const longString = "a".repeat(1000);
      const error = new Error("Test error");
      logError(error, { longData: longString });

      const logCall = mockConsoleError.mock.calls[0];
      const logEntry = JSON.parse(logCall[1] as string);

      expect(logEntry.context.longData).toHaveLength(514); // 500 + "...[TRUNCATED]"
      expect(logEntry.context.longData).toContain("[TRUNCATED]");
    });
  });

  describe("logWarning", () => {
    it("logs warnings in production", () => {
      (process.env as any).NODE_ENV = "production";

      logWarning("Test warning", { component: "TestComponent" });

      expect(mockConsoleWarn).toHaveBeenCalledOnce();
      const logCall = mockConsoleWarn.mock.calls[0];
      const logEntry = JSON.parse(logCall[1] as string);

      expect(logEntry.level).toBe("warn");
      expect(logEntry.message).toBe("Test warning");
      expect(logEntry.context.component).toBe("TestComponent");
    });
  });

  describe("logInfo", () => {
    it("only logs in production environment", () => {
      (process.env as any).NODE_ENV = "production";

      logInfo("Test info", { event: "startup" });

      expect(mockConsoleInfo).toHaveBeenCalledOnce();
      const logCall = mockConsoleInfo.mock.calls[0];
      const logEntry = JSON.parse(logCall[1] as string);

      expect(logEntry.level).toBe("info");
      expect(logEntry.message).toBe("Test info");
    });

    it("does not log in development", () => {
      (process.env as any).NODE_ENV = "development";

      logInfo("Test info");

      expect(mockConsoleInfo).not.toHaveBeenCalled();
    });
  });

  describe("API Error Logging", () => {
    it("logs API errors with route context", () => {
      (process.env as any).NODE_ENV = "production";

      const error = new Error("API Error");
      logApiError(error, "/api/test", "GET", 500);

      expect(mockConsoleError).toHaveBeenCalledOnce();
      const logCall = mockConsoleError.mock.calls[0];
      const logEntry = JSON.parse(logCall[1] as string);

      expect(logEntry.context.type).toBe("api_error");
      expect(logEntry.context.route).toBe("/api/test");
      expect(logEntry.context.method).toBe("GET");
      expect(logEntry.context.statusCode).toBe(500);
    });
  });

  describe("Performance Issue Logging", () => {
    it("logs performance issues as warnings", () => {
      (process.env as any).NODE_ENV = "production";

      logPerformanceIssue("response_time", 5000, 2000, {
        endpoint: "/api/slow",
      });

      expect(mockConsoleWarn).toHaveBeenCalledOnce();
      const logCall = mockConsoleWarn.mock.calls[0];
      const logEntry = JSON.parse(logCall[1] as string);

      expect(logEntry.message).toContain(
        "Performance issue: response_time (5000) exceeded threshold (2000)",
      );
      expect(logEntry.context.type).toBe("performance_issue");
      expect(logEntry.context.metric).toBe("response_time");
      expect(logEntry.context.value).toBe(5000);
      expect(logEntry.context.threshold).toBe(2000);
      expect(logEntry.context.endpoint).toBe("/api/slow");
    });
  });
});
