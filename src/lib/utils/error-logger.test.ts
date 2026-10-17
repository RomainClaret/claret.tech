import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logError } from "./error-logger";

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

// Mock environment
const originalWindow = global.window;

describe("Privacy-First Error Logger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up console spies fresh for each test
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
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
});
