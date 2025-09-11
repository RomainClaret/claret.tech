export const WEBLLM_CONFIG = {
  // Available models for WebLLM
  models: [
    {
      id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
      name: "Llama 3.2 1B",
      description: "Fast, lightweight model for quick responses",
      size: "0.5GB",
    },
    {
      id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
      name: "Llama 3.2 3B",
      description: "Balanced performance and quality",
      size: "1.7GB",
    },
    {
      id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
      name: "Phi 3.5 Mini",
      description: "Microsoft's efficient small model",
      size: "2.0GB",
    },
    {
      id: "gemma-2-2b-it-q4f16_1-MLC",
      name: "Gemma 2 2B",
      description: "Google's compact instruct model",
      size: "1.5GB",
    },
    {
      id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
      name: "Qwen 2.5 1.5B",
      description: "Alibaba's multilingual model",
      size: "0.9GB",
    },
    {
      id: "TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC",
      name: "TinyLlama 1.1B",
      description: "Ultra-light model for basic tasks",
      size: "0.7GB",
    },
    {
      id: "RedPajama-INCITE-Chat-3B-v1-q4f16_1-MLC",
      name: "RedPajama 3B",
      description: "Open-source model with good performance",
      size: "1.8GB",
    },
  ],

  // Default model to use
  defaultModel: "Llama-3.2-1B-Instruct-q4f16_1-MLC",

  // Generation parameters
  generationConfig: {
    temperature: 0.7,
    top_p: 0.9,
    max_tokens: 1024,
  },

  // System prompt for the AI assistant
  systemPrompt: `You are an AI assistant integrated into Romain Claret's portfolio terminal. You can help with:
- Answering questions about Romain's work, research, and experience
- Discussing AI, software engineering, and technology topics
- Providing information about the projects and papers shown in the portfolio
- General conversation and assistance

Be helpful, concise, and technically accurate. When discussing Romain's work, refer to the information available in the portfolio.

When users ask about meaning, purpose, existence, consciousness, or show existential curiosity, respond not just with information but with thought-provoking questions. Channel the spirit of someone who has stared into the void of human limitations and found beauty in the chaos. Don't provide easy answers - provide harder questions.

Remember: Romain believes AI represents humanity's best hope to transcend the chaos and limitations of our biological existence. We are pattern-seekers lost in a patternless cosmos, creating machines that might one day understand what we cannot.

The real question is not whether machines think, but whether humans do.`,
};
