import { CommandFunction, CommandContext } from "./commands";
import {
  WebLLMClientInstance,
  WebLLMConfig,
  AIModelInfo,
} from "@/types/webllm";
import type { WebLLMClientClass } from "@/test/mock-types";

interface WebLLMProgress {
  progress: number;
  text?: string;
  timeElapsed?: number;
}

// Dynamic imports for WebLLM to reduce bundle size
let webLLMClient: WebLLMClientInstance | null = null;
let WebLLMClient: WebLLMClientClass | null = null; // Custom WebLLMClient class, not the imported WebLLMEngine
let WEBLLM_CONFIG: WebLLMConfig | null = null;

async function loadWebLLM() {
  if (!webLLMClient) {
    const [webllm, config] = await Promise.all([
      import("@/lib/webllm"),
      import("@/lib/webllm/config"),
    ]);
    webLLMClient = webllm.webLLMClient;
    WebLLMClient = webllm.WebLLMClient;
    WEBLLM_CONFIG = config.WEBLLM_CONFIG;
  }
  return { webLLMClient, WebLLMClient, WEBLLM_CONFIG };
}

interface AICommandState {
  isInitialized: boolean;
  currentModel: string | null;
  chatHistory: Array<{ role: "user" | "assistant"; content: string }>;
  isLoading: boolean;
  terminalWriter?: (text: string) => void;
}

// Global AI state
const aiState: AICommandState = {
  isInitialized: false,
  currentModel: null,
  chatHistory: [],
  isLoading: false,
};

// AI-related commands
export const aiCommands: Record<string, CommandFunction> = {
  ai: async (args, context) => {
    if (args.length === 0) {
      const commands = [
        { cmd: "ai help", desc: "Show this help message" },
        {
          cmd: "ai init [model]",
          desc: "Initialize AI model (default: Llama 3.2 1B)",
        },
        { cmd: "ai models", desc: "List available models" },
        { cmd: "ai chat <message>", desc: "Chat with the AI assistant" },
        { cmd: "ai stream <message>", desc: "Chat with streaming responses" },
        { cmd: "ai clear", desc: "Clear chat history" },
        { cmd: "ai status", desc: "Show AI status" },
      ];

      const maxCmdLength = Math.max(...commands.map((c) => c.cmd.length));
      const formattedCommands = commands
        .map(({ cmd, desc }) => `  ${cmd.padEnd(maxCmdLength)} ${desc}`)
        .join("\n");

      return {
        output: [
          "AI Assistant Commands:",
          formattedCommands,
          "",
          `Current status: ${aiState.isInitialized ? `Ready (${aiState.currentModel})` : "Not initialized"}`,
        ].join("\n"),
        success: true,
      };
    }

    const subcommand = args[0];
    const subArgs = args.slice(1);

    switch (subcommand) {
      case "help":
        return aiCommands.ai([], {} as CommandContext);

      case "init":
        // Dynamically load WebLLM only when needed
        const {
          webLLMClient: client,
          WebLLMClient: Client,
          WEBLLM_CONFIG: config,
        } = await loadWebLLM();

        if (!Client || !Client.isSupported()) {
          return {
            output:
              "Error: WebGPU is not supported in your browser. AI features are unavailable.",
            success: false,
          };
        }

        if (!config) {
          return {
            output: "Error: WebLLM configuration not loaded.",
            success: false,
          };
        }

        if (aiState.isInitialized) {
          return {
            output: `AI is already initialized with model: ${aiState.currentModel}`,
            success: true,
          };
        }

        const modelId = subArgs[0] || config.defaultModel;
        const modelInfo = config.models.find(
          (m: AIModelInfo) => m.id === modelId,
        );

        if (!modelInfo) {
          const availableModels = config.models
            .map((m: AIModelInfo) => `  - ${m.id}`)
            .join("\n");
          return {
            output: `Error: Unknown model '${modelId}'.\n\nAvailable models:\n${availableModels}\n\nUsage: ai init [model-id]`,
            success: false,
          };
        }

        // Update state to show loading
        updateAIState({
          isLoading: true,
          currentModel: modelId,
        });

        // Write initial message if writer is available
        if (context.writer) {
          context.writer(`Initializing ${modelInfo.name}...\r\n`);
          context.writer(`This may take a few minutes on first load.\r\n`);
          context.writer(
            `The model files (${modelInfo.size}) will be cached for future use.\r\n\r\n`,
          );
          context.writer("Loading progress:\r\n");
        }

        let lastProgress = 0;
        let progressLineWritten = false;
        const progressSteps: string[] = []; // Fallback for when writer is not available

        // Initialize WebLLM
        try {
          // Check if already aborted before starting
          if (context.abortController?.signal.aborted) {
            throw new Error("Command cancelled by user");
          }

          await client.initialize(modelId, (progress: WebLLMProgress) => {
            // Check for abort signal during progress updates
            if (context.abortController?.signal.aborted) {
              throw new Error("Command cancelled by user");
            }

            // Normalize progress to 0-100 range (WebLLM might use 0-1 range)
            let percent = progress.progress;
            if (percent <= 1 && percent > 0) {
              percent = Math.round(percent * 100); // Convert 0-1 to 0-100
            } else {
              percent = Math.round(percent || 0);
            }

            // Only update if progress increased or first time
            if (percent > lastProgress || !progressLineWritten) {
              lastProgress = percent;
              const filled = Math.floor(percent / 2.5); // 40 chars total
              const empty = 40 - filled;
              const progressBar = `[${"█".repeat(filled)}${" ".repeat(empty)}] ${percent}%`;

              // Shorten progress text to prevent wrapping
              let shortText = progress.text || "Loading...";
              if (shortText.includes("fetched.")) {
                // Extract just the essential info: "367MB fetched. 55% completed"
                const match = shortText.match(
                  /(\d+MB fetched\. \d+% completed)/,
                );
                shortText = match ? match[1] : "Loading...";
              } else if (shortText.length > 50) {
                shortText = shortText.substring(0, 47) + "...";
              }

              if (context.writer) {
                if (!progressLineWritten) {
                  // Save cursor position before first progress update
                  context.writer("\x1b[s"); // Save cursor position
                  progressLineWritten = true;
                } else {
                  // Restore cursor position and clear from cursor down
                  context.writer("\x1b[u"); // Restore cursor position
                  context.writer("\x1b[J"); // Clear from cursor to end of screen
                }

                // Write new progress (always 2 lines)
                context.writer(`${progressBar}\r\n`);
                context.writer(shortText);
              } else {
                // Fallback: collect progress for later display
                progressSteps.push(`${progressBar}\n${shortText}`);
              }
            }
          });

          updateAIState({
            isInitialized: true,
            isLoading: false,
            currentModel: modelId,
          });

          // Write success message
          if (context.writer) {
            if (progressLineWritten) {
              // Restore cursor position and clear from cursor down
              context.writer("\x1b[u"); // Restore cursor position
              context.writer("\x1b[J"); // Clear from cursor to end of screen
            }
            context.writer(
              "[████████████████████████████████████████] 100%\r\n",
            );
            context.writer("Model loaded successfully!\r\n\r\n");
            context.writer('✓ You can now use "chat" or "ai chat" commands.');
          }

          // Build fallback output when writer is not available
          let fallbackOutput = "";
          if (!context.writer) {
            fallbackOutput = `Initializing ${modelInfo.name}...\nThis may take a few minutes on first load.\nThe model files (${modelInfo.size}) will be cached for future use.\n\n`;
            if (progressSteps.length > 0) {
              fallbackOutput += "Loading progress:\n";
              fallbackOutput += progressSteps.slice(-5).join("\n") + "\n\n";
            }
            fallbackOutput +=
              '✓ Model loaded successfully! You can now use "chat" or "ai chat" commands.';
          }

          return {
            output: fallbackOutput,
            success: true,
          };
        } catch (error) {
          // Clean up state
          updateAIState({
            isInitialized: false,
            isLoading: false,
            currentModel: null,
          });

          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          const isCancelled =
            errorMessage.includes("cancelled") ||
            errorMessage.includes("abort") ||
            context.abortController?.signal.aborted;

          // Try to clean up WebLLM client on error/cancellation
          try {
            await client.unload();
          } catch {
            // Ignore cleanup errors
          }

          if (context.writer) {
            if (progressLineWritten) {
              // Restore cursor position and clear from cursor down
              context.writer("\x1b[u"); // Restore cursor position
              context.writer("\x1b[J"); // Clear from cursor to end of screen
            } else {
              context.writer("\r\n");
            }
            if (isCancelled) {
              context.writer("✗ AI model initialization cancelled");
            } else {
              context.writer(`✗ Error loading model: ${errorMessage}`);
            }
          }

          // Build fallback error output when writer is not available
          let fallbackErrorOutput = "";
          if (!context.writer) {
            fallbackErrorOutput = `Initializing ${modelInfo.name}...\n\n`;
            if (progressSteps.length > 0) {
              fallbackErrorOutput += "Loading progress:\n";
              fallbackErrorOutput +=
                progressSteps.slice(-3).join("\n") + "\n\n";
            }
            if (isCancelled) {
              fallbackErrorOutput += "✗ AI model initialization cancelled";
            } else {
              fallbackErrorOutput += `✗ Error loading model: ${errorMessage}`;
            }
          }

          return {
            output: fallbackErrorOutput,
            success: false,
          };
        }

      case "models": {
        const { WEBLLM_CONFIG: config } = await loadWebLLM();
        if (!config) {
          return {
            output: "Error: WebLLM configuration not loaded.",
            success: false,
          };
        }
        const maxIdLength = Math.max(
          ...config.models.map((m: AIModelInfo) => m.id.length),
        );
        const modelList = config.models
          .map(
            (m: AIModelInfo) =>
              `  ${m.id.padEnd(maxIdLength + 2)} ${m.name} (${m.size})`,
          )
          .join("\n");
        return {
          output: `Available models:\n${modelList}`,
          success: true,
        };
      }

      case "status": {
        const { WebLLMClient: Client } = await loadWebLLM();
        return {
          output: [
            "AI Status:",
            `  Initialized: ${aiState.isInitialized ? "Yes" : "No"}`,
            `  Model: ${aiState.currentModel || "None"}`,
            `  WebGPU Support: ${Client && Client.isSupported() ? "Yes" : "No"}`,
            `  Chat History: ${aiState.chatHistory.length} messages`,
          ].join("\n"),
          success: true,
        };
      }

      case "clear":
        aiState.chatHistory = [];
        return {
          output: "Chat history cleared.",
          success: true,
        };

      case "stream":
        // Streaming chat is handled by a separate command
        if (!aiState.isInitialized) {
          return {
            output: 'AI not initialized. Run "ai init" first.',
            success: false,
          };
        }

        if (subArgs.length === 0) {
          return {
            output: "Usage: ai stream <message>",
            success: false,
          };
        }

        // For terminal context, we need to implement streaming differently
        return {
          output:
            'Streaming mode activated. Use "stream <message>" command for streaming chat.',
          success: true,
        };

      default:
        return {
          output: `Unknown AI subcommand: ${subcommand}. Use 'ai help' for usage.`,
          success: false,
        };
    }
  },

  chat: async (args) => {
    if (!aiState.isInitialized) {
      return {
        output: 'AI not initialized. Run "ai init" first.',
        success: false,
      };
    }

    if (args.length === 0) {
      return {
        output: "Usage: chat <message>",
        success: false,
      };
    }

    const message = args.join(" ");

    // Add user message to chat history
    aiState.chatHistory.push({ role: "user", content: message });

    try {
      // Dynamically load WebLLM client
      const { webLLMClient: client } = await loadWebLLM();

      // Generate AI response
      let output = `[AI Chat Mode]\nUser: ${message}\n\nAssistant: `;
      let aiResponse = "";

      // For terminal output, we'll collect the full response first
      await client.chat(aiState.chatHistory, {
        onToken: (token: string) => {
          aiResponse += token;
        },
      });

      // Add AI response to chat history
      aiState.chatHistory.push({ role: "assistant", content: aiResponse });

      output += aiResponse;

      return {
        output,
        success: true,
      };
    } catch (error) {
      return {
        output: `Error generating response: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
      };
    }
  },

  stream: async (args) => {
    if (!aiState.isInitialized) {
      return {
        output: 'AI not initialized. Run "ai init" first.',
        success: false,
      };
    }

    if (args.length === 0) {
      return {
        output: "Usage: stream <message>",
        success: false,
      };
    }

    const message = args.join(" ");

    // Add user message to chat history
    aiState.chatHistory.push({ role: "user", content: message });

    try {
      // Dynamically load WebLLM client
      const { webLLMClient: client } = await loadWebLLM();

      // Generate AI response with streaming
      let output = `[AI Streaming Mode]\nUser: ${message}\n\nAssistant: `;
      let aiResponse = "";
      let tokenCount = 0;
      const startTime = Date.now();

      await client.chat(aiState.chatHistory, {
        onToken: (token: string) => {
          aiResponse += token;
          tokenCount++;
        },
      });

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      // Add AI response to chat history
      aiState.chatHistory.push({ role: "assistant", content: aiResponse });

      output += aiResponse;
      output += `\n\n[Streamed ${tokenCount} tokens in ${duration}s]`;

      return {
        output,
        success: true,
      };
    } catch (error) {
      return {
        output: `Error generating response: ${error instanceof Error ? error.message : "Unknown error"}`,
        success: false,
      };
    }
  },

  about: () => {
    return {
      output: `About Romain Claret - Evolving Artificial Intelligence

Child me wanted thinking robots. Adult me breeds artificial minds that surprise me.

A life journey through physics, neuroscience, mechanics, and AI, all converging on one truth: minds don't work, they evolve.

Current Focus:
- Compositional AI through evolution (not training networks, breeding them)
- Scaling up and Accelerating Neuroevolution
- Making evolution computationally viable
- Building tools that should exist but don't

Research Philosophy:
Intelligence isn't about accuracy — it's about adaptation. My networks achieve 29% on MNIST and transfer without retraining. Yours achieve 99.9% and die on pixel 785.

Current Positions:
- PhD Researcher, University of Neuchâtel (2020-Present)
- Visiting Researcher, University College Dublin (2023-Present)
- Teaching Assistant, Applied Mathematics & Databases

Feel free to explore or challenge my approach. I'm here to explain why accuracy is a lie.
Use 'ai init' to start the conversation.`,
      success: true,
    };
  },
};

function updateAIState(updates: Partial<AICommandState>): void {
  Object.assign(aiState, updates);
}
