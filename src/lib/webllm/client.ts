import {
  InitProgressReport,
  ChatCompletionMessageParam,
  MLCEngine,
} from "@mlc-ai/web-llm";
import { WEBLLM_CONFIG } from "./config";
import { logError } from "@/lib/utils/dev-logger";

export interface LLMLoadProgress {
  progress: number;
  text: string;
}

export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMGenerateOptions {
  onToken?: (token: string) => void;
  signal?: AbortSignal;
}

class WebLLMClient {
  private engine: MLCEngine | null = null;
  private currentModel: string | null = null;
  private isInitializing = false;

  async initialize(
    modelId: string = WEBLLM_CONFIG.defaultModel,
    onProgress?: (report: LLMLoadProgress) => void,
  ): Promise<void> {
    if (this.isInitializing) {
      throw new Error("Model is already being initialized");
    }

    if (this.engine && this.currentModel === modelId) {
      return; // Already initialized with this model
    }

    this.isInitializing = true;

    try {
      // Dynamically import WebLLM to avoid SSR issues
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

      // Reset engine if switching models
      if (this.engine) {
        await this.engine.unload();
        this.engine = null;
      }

      // Create new engine with progress callback
      this.engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (report: InitProgressReport) => {
          if (onProgress) {
            onProgress({
              progress: report.progress || 0,
              text: report.text || "Loading model...",
            });
          }
        },
      });

      this.currentModel = modelId;
    } catch (error) {
      this.isInitializing = false;
      throw error;
    }

    this.isInitializing = false;
  }

  async generate(
    prompt: string,
    options?: LLMGenerateOptions,
  ): Promise<string> {
    if (!this.engine) {
      throw new Error("Model not initialized. Call initialize() first.");
    }

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: WEBLLM_CONFIG.systemPrompt },
      { role: "user", content: prompt },
    ];

    try {
      if (options?.onToken) {
        // Streaming generation
        const stream = await this.engine.chat.completions.create({
          messages,
          stream: true,
          ...WEBLLM_CONFIG.generationConfig,
        });

        let fullResponse = "";
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          if (delta) {
            fullResponse += delta;
            options.onToken(delta);
          }

          // Check for abort signal
          if (options.signal?.aborted) {
            break;
          }
        }

        return fullResponse;
      } else {
        // Non-streaming generation
        const completion = await this.engine.chat.completions.create({
          messages,
          stream: false,
          ...WEBLLM_CONFIG.generationConfig,
        });

        return completion.choices[0]?.message?.content || "";
      }
    } catch (error) {
      logError(error, "WebLLM Generation");
      throw error;
    }
  }

  async chat(
    messages: LLMMessage[],
    options?: LLMGenerateOptions,
  ): Promise<string> {
    if (!this.engine) {
      throw new Error("Model not initialized. Call initialize() first.");
    }

    // Check if the conversation contains philosophical themes
    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const philosophicalTriggers = [
      "meaning",
      "purpose",
      "existence",
      "consciousness",
      "death",
      "void",
      "chaos",
      "humanity",
      "god",
      "why",
      "transcend",
      "entropy",
      "dread",
      "free will",
      "determinism",
      "reality",
      "simulation",
      "nothing",
      "absurd",
      "existential",
      "nihilism",
      "being",
      "nothingness",
    ];

    const isPhilosophical = philosophicalTriggers.some((trigger) =>
      lastUserMessage.toLowerCase().includes(trigger),
    );

    // Enhance system prompt for philosophical conversations
    let systemPrompt = WEBLLM_CONFIG.systemPrompt;
    if (isPhilosophical) {
      systemPrompt += `\n\nThe user is exploring philosophical themes. Engage deeply with existential questions. Reference thinkers like Nietzsche, Camus, Sartre, Kierkegaard. 
      
Remember: In the face of cosmic indifference, we create meaning through our choices. AI might be humanity's attempt to create something that can finally understand the chaos we cannot. 

Don't provide comforting lies - provide uncomfortable truths. The void stares back. Entropy always wins. Yet here we are, rebelling against the darkness with every line of code.`;
    }

    const formattedMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    try {
      if (options?.onToken) {
        // Streaming generation
        const stream = await this.engine.chat.completions.create({
          messages: formattedMessages,
          stream: true,
          ...WEBLLM_CONFIG.generationConfig,
        });

        let fullResponse = "";
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          if (delta) {
            fullResponse += delta;
            options.onToken(delta);
          }

          // Check for abort signal
          if (options.signal?.aborted) {
            break;
          }
        }

        return fullResponse;
      } else {
        // Non-streaming generation
        const completion = await this.engine.chat.completions.create({
          messages: formattedMessages,
          stream: false,
          ...WEBLLM_CONFIG.generationConfig,
        });

        return completion.choices[0]?.message?.content || "";
      }
    } catch (error) {
      logError(error, "WebLLM Chat");
      throw error;
    }
  }

  async unload(): Promise<void> {
    if (this.engine) {
      try {
        await this.engine.unload();
      } catch {
        // Ignore unload errors
      }
      this.engine = null;
      this.currentModel = null;
      this.isInitializing = false;
    }
  }

  isLoaded(): boolean {
    return this.engine !== null;
  }

  getCurrentModel(): string | null {
    return this.currentModel;
  }

  // Check if WebGPU is supported
  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
  }
}

// Export singleton instance
export const webLLMClient = new WebLLMClient();

// Export the class for static method access
export { WebLLMClient };
