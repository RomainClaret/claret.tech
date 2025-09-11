"use client";

import { useState, useCallback, useRef } from "react";
import {
  webLLMClient,
  WebLLMClient,
  LLMLoadProgress,
  LLMMessage,
} from "./client";
import { WEBLLM_CONFIG } from "./config";

export interface UseWebLLMOptions {
  modelId?: string;
  onError?: (error: Error) => void;
}

export interface UseWebLLMReturn {
  isLoading: boolean;
  isGenerating: boolean;
  loadProgress: LLMLoadProgress | null;
  error: Error | null;
  currentModel: string | null;
  availableModels: typeof WEBLLM_CONFIG.models;

  initialize: (modelId?: string) => Promise<void>;
  generate: (
    prompt: string,
    onToken?: (token: string) => void,
  ) => Promise<string>;
  chat: (
    messages: LLMMessage[],
    onToken?: (token: string) => void,
  ) => Promise<string>;
  abort: () => void;
  isSupported: () => boolean;
}

export function useWebLLM(options?: UseWebLLMOptions): UseWebLLMReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadProgress, setLoadProgress] = useState<LLMLoadProgress | null>(
    null,
  );
  const [error, setError] = useState<Error | null>(null);
  const [currentModel, setCurrentModel] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const initialize = useCallback(
    async (modelId?: string) => {
      const model = modelId || options?.modelId || WEBLLM_CONFIG.defaultModel;

      setIsLoading(true);
      setError(null);
      setLoadProgress({
        progress: 0,
        text: "Starting model initialization...",
      });

      try {
        await webLLMClient.initialize(model, (progress) => {
          setLoadProgress(progress);
        });

        setCurrentModel(model);
        setLoadProgress(null);
      } catch (err) {
        const error = err as Error;
        setError(error);
        if (options?.onError) {
          options.onError(error);
        }
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [options],
  );

  const generate = useCallback(
    async (
      prompt: string,
      onToken?: (token: string) => void,
    ): Promise<string> => {
      setIsGenerating(true);
      setError(null);

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        const response = await webLLMClient.generate(prompt, {
          onToken,
          signal: abortControllerRef.current.signal,
        });

        return response;
      } catch (err) {
        const error = err as Error;
        setError(error);
        if (options?.onError) {
          options.onError(error);
        }
        throw error;
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [options],
  );

  const chat = useCallback(
    async (
      messages: LLMMessage[],
      onToken?: (token: string) => void,
    ): Promise<string> => {
      setIsGenerating(true);
      setError(null);

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        const response = await webLLMClient.chat(messages, {
          onToken,
          signal: abortControllerRef.current.signal,
        });

        return response;
      } catch (err) {
        const error = err as Error;
        setError(error);
        if (options?.onError) {
          options.onError(error);
        }
        throw error;
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [options],
  );

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const isSupported = useCallback(() => {
    return WebLLMClient.isSupported();
  }, []);

  return {
    isLoading,
    isGenerating,
    loadProgress,
    error,
    currentModel: currentModel || webLLMClient.getCurrentModel(),
    availableModels: WEBLLM_CONFIG.models,

    initialize,
    generate,
    chat,
    abort,
    isSupported,
  };
}
