import { StaticModelInfo } from '../../common/types';

// Based on Cline data and Vercel AI SDK table for OpenAI
export const openaiStaticModels: { [modelId: string]: StaticModelInfo } = {
  "gpt-4.1": {
    id: "openai:gpt-4.1",
    name: "GPT-4.1",
    providerId: "openai",
    providerName: "OpenAI",
    maxTokens: 32768, // Cline
    contextWindow: 1_047_576, // Cline
    supportsImages: true,
    supportsObjectGeneration: true, // Vercel
    supportsTools: true,           // Vercel
    supportsToolStreaming: true,   // Vercel
    supportsPromptCache: true,     // Cline
    inputPrice: 2.0,               // Cline
    outputPrice: 8.0,              // Cline
    cacheReadsPrice: 0.5,          // Cline
  },
  "gpt-4.1-mini": {
    id: "openai:gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    providerId: "openai",
    providerName: "OpenAI",
    maxTokens: 32768, // Cline
    contextWindow: 1_047_576, // Cline
    supportsImages: true,
    supportsObjectGeneration: true, // Vercel
    supportsTools: true,           // Vercel
    supportsToolStreaming: true,   // Vercel
    supportsPromptCache: true,     // Cline
    inputPrice: 0.4,               // Cline
    outputPrice: 1.6,              // Cline
    cacheReadsPrice: 0.1,          // Cline
  },
  "gpt-4.1-nano": {
    id: "openai:gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    providerId: "openai",
    providerName: "OpenAI",
    maxTokens: 32768, // Cline
    contextWindow: 1_047_576, // Cline
    supportsImages: true,
    supportsObjectGeneration: true, // Vercel
    supportsTools: true,           // Vercel
    supportsToolStreaming: true,   // Vercel
    supportsPromptCache: true,     // Cline
    inputPrice: 0.1,               // Cline
    outputPrice: 0.4,              // Cline
    cacheReadsPrice: 0.025,        // Cline
  },
  "gpt-4o": {
    id: "openai:gpt-4o",
    name: "GPT-4o",
    providerId: "openai",
    providerName: "OpenAI",
    maxTokens: 16384, // Cline differs (4096), using Cline's gpt-4o-mini value as likely correct for 4o
    contextWindow: 128_000, // Cline
    supportsImages: true,
    supportsObjectGeneration: true, // Vercel
    supportsTools: true,           // Vercel
    supportsToolStreaming: true,   // Vercel
    supportsPromptCache: true,     // Cline
    inputPrice: 2.5,               // Cline
    outputPrice: 10.0,             // Cline
    cacheReadsPrice: 1.25,         // Cline
  },
  "gpt-4o-mini": {
    id: "openai:gpt-4o-mini",
    name: "GPT-4o Mini",
    providerId: "openai",
    providerName: "OpenAI",
    maxTokens: 16384, // Cline
    contextWindow: 128_000, // Cline
    supportsImages: true,
    supportsObjectGeneration: true, // Vercel
    supportsTools: true,           // Vercel
    supportsToolStreaming: true,   // Vercel
    supportsPromptCache: true,     // Cline
    inputPrice: 0.15,              // Cline
    outputPrice: 0.6,              // Cline
    cacheReadsPrice: 0.075,        // Cline
  },
  "gpt-4-turbo": { // Vercel lists this
    id: "openai:gpt-4-turbo",
    name: "GPT-4 Turbo",
    providerId: "openai",
    providerName: "OpenAI",
    maxTokens: 4096, // Common default, Cline doesn't list
    contextWindow: 128_000, // Common for Turbo
    supportsImages: true,
    supportsObjectGeneration: true, // Vercel
    supportsTools: true,           // Vercel
    supportsToolStreaming: true,   // Vercel
    supportsPromptCache: false,    // Assume false if not specified
    inputPrice: 10.0,              // Common Turbo pricing
    outputPrice: 30.0,             // Common Turbo pricing
  },
  "gpt-4": { // Vercel lists this
    id: "openai:gpt-4",
    name: "GPT-4",
    providerId: "openai",
    providerName: "OpenAI",
    maxTokens: 8192, // Common GPT-4 limit
    contextWindow: 8192, // Common GPT-4 limit
    supportsImages: false, // Base GPT-4 usually no image input
    supportsObjectGeneration: true, // Vercel
    supportsTools: true,           // Vercel
    supportsToolStreaming: true,   // Vercel
    supportsPromptCache: false,    // Assume false
    inputPrice: 30.0,              // Common GPT-4 pricing
    outputPrice: 60.0,             // Common GPT-4 pricing
  },
  // Cline lists o3-mini, o1 models - Vercel doesn't explicitly list tool support for these yet
  "o3-mini": {
    id: "openai:o3-mini",
    name: "o3 Mini",
    providerId: "openai",
    providerName: "OpenAI",
    maxTokens: 100_000, // Cline
    contextWindow: 200_000, // Cline
    supportsImages: false, // Cline
    supportsObjectGeneration: false, // Vercel says no
    supportsTools: true,           // Vercel says yes
    supportsToolStreaming: true,   // Vercel says yes
    supportsPromptCache: true,     // Cline
    inputPrice: 1.1,               // Cline
    outputPrice: 4.4,              // Cline
    cacheReadsPrice: 0.55,         // Cline
    reasoningEffort: "medium",     // Cline
  },
   "o1": {
    id: "openai:o1",
    name: "o1",
    providerId: "openai",
    providerName: "OpenAI",
    maxTokens: 100_000, // Cline
    contextWindow: 200_000, // Cline
    supportsImages: true, // Cline
    supportsObjectGeneration: false, // Vercel says no
    supportsTools: true,           // Vercel says yes
    supportsToolStreaming: true,   // Vercel says yes
    supportsPromptCache: true,     // Cline differs (false), using Cline's true
    inputPrice: 15.0,              // Cline
    outputPrice: 60.0,             // Cline
    cacheReadsPrice: 7.5,          // Cline
  },
   "o1-mini": {
    id: "openai:o1-mini",
    name: "o1 Mini",
    providerId: "openai",
    providerName: "OpenAI",
    maxTokens: 65536, // Cline
    contextWindow: 128_000, // Cline
    supportsImages: true, // Cline
    supportsObjectGeneration: false, // Vercel says no
    supportsTools: true,           // Vercel says yes
    supportsToolStreaming: true,   // Vercel says yes
    supportsPromptCache: true,     // Cline
    inputPrice: 1.1,               // Cline
    outputPrice: 4.4,              // Cline
    cacheReadsPrice: 0.55,         // Cline
  },
  // Note: Cline lists preview/other o3 variants, skipping for brevity
};