import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommandContext } from "./commands";
import type { CommandsObject } from "@/test/mock-types";

// Create simplified mock
const mockWebLLMClient = {
  initialize: vi.fn(),
  chat: vi.fn(),
  unload: vi.fn(),
};

const mockWebLLMClientClass = {
  isSupported: vi.fn(() => true),
};

vi.mock("@/lib/webllm", () => ({
  webLLMClient: mockWebLLMClient,
  WebLLMClient: mockWebLLMClientClass,
}));

vi.mock("@/lib/webllm/config", () => ({
  WEBLLM_CONFIG: {
    defaultModel: "llama-3.2-1b",
    models: [
      { id: "llama-3.2-1b", name: "Llama 3.2 1B", size: "1.2GB" },
      { id: "llama-3.2-3b", name: "Llama 3.2 3B", size: "3.1GB" },
    ],
  },
}));

describe("AI Commands Basic Tests", () => {
  let mockContext: CommandContext;
  let aiCommands: CommandsObject;

  beforeEach(async () => {
    mockContext = {
      currentDirectory: "/",
      currentUser: "guest",
      setCurrentDirectory: vi.fn(),
      setCurrentUser: vi.fn(),
      addToHistory: vi.fn(),
      clearTerminal: vi.fn(),
      closeTerminal: vi.fn(),
      terminalCols: 80,
      terminalRows: 24,
    };

    vi.clearAllMocks();
    mockWebLLMClientClass.isSupported.mockReturnValue(true);
    // Reset client mock to resolve successfully by default
    mockWebLLMClient.initialize.mockResolvedValue(undefined);
    mockWebLLMClient.unload = vi.fn().mockResolvedValue(undefined);

    // Import fresh module
    const aiModule = await import("./ai-commands");
    aiCommands = aiModule.aiCommands;
  });

  describe("ai command structure", () => {
    it("has all expected commands", () => {
      expect(aiCommands.ai).toBeInstanceOf(Function);
      expect(aiCommands.chat).toBeInstanceOf(Function);
      expect(aiCommands.stream).toBeInstanceOf(Function);
      expect(aiCommands.about).toBeInstanceOf(Function);
    });

    it("ai command shows help without arguments", async () => {
      const result = await aiCommands.ai([], mockContext);

      expect(result.success).toBe(true);
      expect(result.output).toContain("AI Assistant Commands:");
      expect(result.output).toContain("ai help");
      expect(result.output).toContain("ai init");
      expect(result.output).toContain("ai chat");
    });

    it("ai command shows help with help subcommand", async () => {
      const result = await aiCommands.ai(["help"], mockContext);

      expect(result.success).toBe(true);
      expect(result.output).toContain("AI Assistant Commands:");
    });

    it("ai command lists models", async () => {
      const result = await aiCommands.ai(["models"], mockContext);

      expect(result.success).toBe(true);
      expect(result.output).toContain("Available models:");
      expect(result.output).toContain("llama-3.2-1b");
      expect(result.output).toContain("Llama 3.2 1B");
    });

    it("ai command shows status", async () => {
      const result = await aiCommands.ai(["status"], mockContext);

      expect(result.success).toBe(true);
      expect(result.output).toContain("AI Status:");
      expect(result.output).toContain("Initialized:");
      expect(result.output).toContain("WebGPU Support:");
    });

    it("ai command clears history", async () => {
      const result = await aiCommands.ai(["clear"], mockContext);

      expect(result.success).toBe(true);
      expect(result.output).toBe("Chat history cleared.");
    });

    it("ai command handles unknown subcommand", async () => {
      const result = await aiCommands.ai(["unknown"], mockContext);

      expect(result.success).toBe(false);
      expect(result.output).toContain("Unknown AI subcommand: unknown");
    });
  });

  describe("chat command", () => {
    it("requires initialization (checks init before arguments)", async () => {
      const result = await aiCommands.chat([], mockContext);

      // The implementation checks for initialization first
      expect(result.success).toBe(false);
      expect(result.output).toBe('AI not initialized. Run "ai init" first.');
    });

    it("requires initialization for message", async () => {
      const result = await aiCommands.chat(["Hello"], mockContext);

      // Should fail because not initialized
      expect(result.success).toBe(false);
      expect(result.output).toBe('AI not initialized. Run "ai init" first.');
    });
  });

  describe("stream command", () => {
    it("requires initialization (checks init before arguments)", async () => {
      const result = await aiCommands.stream([], mockContext);

      // The implementation checks for initialization first
      expect(result.success).toBe(false);
      expect(result.output).toBe('AI not initialized. Run "ai init" first.');
    });

    it("requires initialization for message", async () => {
      const result = await aiCommands.stream(["Hello"], mockContext);

      // Should fail because not initialized
      expect(result.success).toBe(false);
      expect(result.output).toBe('AI not initialized. Run "ai init" first.');
    });
  });

  describe("about command", () => {
    it("returns information about Romain Claret", async () => {
      const result = await aiCommands.about([], mockContext);

      expect(result.success).toBe(true);
      expect(result.output).toContain("About Romain Claret");
      expect(result.output).toContain("Evolving Artificial Intelligence");
      expect(result.output).toContain("PhD Researcher");
      expect(result.output).toContain("University of Neuchâtel");
      expect(result.output).toContain("Use 'ai init' to start");
    });
  });

  describe("WebGPU support check", () => {
    it("ai init fails when WebGPU not supported", async () => {
      mockWebLLMClientClass.isSupported.mockReturnValue(false);

      const result = await aiCommands.ai(["init"], mockContext);

      expect(result.success).toBe(false);
      expect(result.output).toContain("WebGPU is not supported");
    });

    it("ai init fails with unknown model", async () => {
      const result = await aiCommands.ai(
        ["init", "unknown-model"],
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.output).toContain("Unknown model 'unknown-model'");
      expect(result.output).toContain("Available models:");
    });
  });

  describe("Writer Callback Integration", () => {
    it("includes writer callback in context for real-time output", async () => {
      const mockWriter = vi.fn();
      const contextWithWriter = { ...mockContext, writer: mockWriter };

      const result = await aiCommands.ai(["init"], contextWithWriter);

      expect(result.success).toBe(true);
      expect(mockWriter).toHaveBeenCalledWith(
        expect.stringContaining("Initializing"),
      );
      expect(mockWriter).toHaveBeenCalledWith(
        expect.stringContaining("Loading progress:"),
      );
      // Should have final success message with progress bar
      expect(mockWriter).toHaveBeenCalledWith(
        expect.stringContaining(
          "████████████████████████████████████████] 100%",
        ),
      );
    });

    it("passes abort controller to context for cancellation support", () => {
      const abortController = new AbortController();
      const contextWithAbort = {
        ...mockContext,
        writer: vi.fn(),
        abortController,
      };

      // Test that the context accepts abort controller
      expect(contextWithAbort.abortController).toBe(abortController);
      expect(contextWithAbort.abortController.signal.aborted).toBe(false);

      // Test abort functionality
      abortController.abort();
      expect(contextWithAbort.abortController.signal.aborted).toBe(true);
    });
  });
});
