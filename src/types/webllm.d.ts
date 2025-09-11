// TypeScript definitions for WebLLM
// Provides proper typing for @mlc-ai/web-llm dynamic imports

declare module "@mlc-ai/web-llm" {
  export interface ModelConfig {
    model_id: string;
    model_url: string;
    model_lib_url?: string;
    vram_required_MB?: number;
    low_resource_required?: boolean;
  }

  export interface AppConfig {
    model_list: ModelConfig[];
    use_indexeddb_cache?: boolean;
  }

  export interface GenerateOptions {
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    stop?: string | string[];
    stream?: boolean;
  }

  export interface ChatCompletionRequest {
    messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;
    model?: string;
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
  }

  export interface ChatCompletionResponse {
    choices: Array<{
      message: {
        role: string;
        content: string;
      };
      finish_reason: string;
    }>;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }

  export interface ChatCompletionInterface {
    completions: {
      create: (
        request: ChatCompletionRequest,
      ) => Promise<ChatCompletionResponse>;
    };
  }

  export class WebLLMEngine {
    chat: ChatCompletionInterface;

    constructor();

    reload(model: string, config?: AppConfig): Promise<void>;

    generate(
      prompt: string,
      options?: GenerateOptions,
    ): AsyncGenerator<string, void, unknown>;

    runtimeStatsText(): string;

    interruptGenerate(): void;

    unload(): Promise<void>;

    setInitProgressCallback(callback: (progress: number) => void): void;
  }

  export const prebuiltAppConfig: AppConfig;
}

// Global type extensions for WebLLM usage
export interface WebLLMClientInstance {
  initialize(
    modelId?: string,
    onProgress?: (report: { progress: number; text: string }) => void,
  ): Promise<void>;
  generate(
    prompt: string,
    options?: { onToken?: (token: string) => void; signal?: AbortSignal },
  ): Promise<string>;
  chat(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    options?: { onToken?: (token: string) => void; signal?: AbortSignal },
  ): Promise<string>;
  unload(): Promise<void>;
  isLoaded(): boolean;
  getCurrentModel(): string | null;
}

export interface WebLLMConfig {
  models: Array<{
    id: string;
    name: string;
    description: string;
    size: string;
  }>;
  defaultModel: string;
  generationConfig: {
    temperature: number;
    top_p: number;
    max_tokens: number;
  };
  systemPrompt: string;
}

// Terminal AI command configuration types
export interface AIModelInfo {
  id: string;
  name?: string;
  description?: string;
  size?: string;
  vram_required_MB?: number;
}

export interface AICommandConfig {
  defaultModel: string;
  models: AIModelInfo[];
  temperature?: number;
  max_tokens?: number;
}
