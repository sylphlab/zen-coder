import { StaticModelInfo } from '../../common/types';

export const anthropicStaticModels: { [modelId: string]: StaticModelInfo } = {
  "claude-3-7-sonnet-20250219": {
    id: "anthropic:claude-3-7-sonnet-20250219",
    name: "Claude 3.7 Sonnet (2025-02-19)",
    providerId: "anthropic",
    providerName: "Anthropic",
    maxTokens: 8192,
    contextWindow: 200_000,
    supportsImages: true,
    supportsObjectGeneration: true, // Based on Vercel table (assuming applies to latest Sonnet)
    supportsTools: true,           // Based on Vercel table
    supportsToolStreaming: true,   // Based on Vercel table
    supportsComputerUse: true,
    supportsPromptCache: true,
    inputPrice: 3.0,
    outputPrice: 15.0,
    cacheWritesPrice: 3.75,
    cacheReadsPrice: 0.3,
    thinking: false, // Assuming non-thinking version
  },
  "claude-3-5-sonnet-20241022": {
    id: "anthropic:claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet (2024-10-22)",
    providerId: "anthropic",
    providerName: "Anthropic",
    maxTokens: 8192,
    contextWindow: 200_000,
    supportsImages: true,
    supportsObjectGeneration: true, // Assuming applies
    supportsTools: true,
    supportsToolStreaming: true,
    supportsComputerUse: true,
    supportsPromptCache: true,
    inputPrice: 3.0,
    outputPrice: 15.0,
    cacheWritesPrice: 3.75,
    cacheReadsPrice: 0.3,
  },
   "claude-3-5-haiku-20241022": {
    id: "anthropic:claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku (2024-10-22)",
    providerId: "anthropic",
    providerName: "Anthropic",
    maxTokens: 8192,
    contextWindow: 200_000,
    supportsImages: false, // Cline data says false
    supportsObjectGeneration: true, // Assuming applies
    supportsTools: true,
    supportsToolStreaming: true,
    supportsPromptCache: true,
    inputPrice: 1.0, // Cline data differs slightly, using Cline's
    outputPrice: 5.0, // Cline data differs slightly, using Cline's
    cacheWritesPrice: 1.25, // Cline data differs slightly, using Cline's
    cacheReadsPrice: 0.1, // Cline data differs slightly, using Cline's
  },
  "claude-3-opus-20240229": {
    id: "anthropic:claude-3-opus-20240229",
    name: "Claude 3 Opus (2024-02-29)",
    providerId: "anthropic",
    providerName: "Anthropic",
    maxTokens: 4096,
    contextWindow: 200_000,
    supportsImages: true,
    supportsObjectGeneration: true, // Assuming applies
    supportsTools: true,
    supportsToolStreaming: true,
    supportsPromptCache: true,
    inputPrice: 15.0,
    outputPrice: 75.0,
    cacheWritesPrice: 18.75,
    cacheReadsPrice: 1.5,
  },
  "claude-3-haiku-20240307": {
    id: "anthropic:claude-3-haiku-20240307",
    name: "Claude 3 Haiku (2024-03-07)",
    providerId: "anthropic",
    providerName: "Anthropic",
    maxTokens: 4096,
    contextWindow: 200_000,
    supportsImages: true,
    supportsObjectGeneration: true, // Assuming applies
    supportsTools: true,
    supportsToolStreaming: true,
    supportsPromptCache: true,
    inputPrice: 0.25,
    outputPrice: 1.25,
    cacheWritesPrice: 0.3,
    cacheReadsPrice: 0.03,
  },
  // Note: Cline lists a "claude-3-7-sonnet-20250219:thinking" model,
  // but Vercel table doesn't differentiate. Adding it based on Cline.
  "claude-3-7-sonnet-20250219:thinking": {
    id: "anthropic:claude-3-7-sonnet-20250219:thinking",
    name: "Claude 3.7 Sonnet (Thinking)",
    providerId: "anthropic",
    providerName: "Anthropic",
    maxTokens: 128_000, // From Cline
    contextWindow: 200_000,
    supportsImages: true,
    supportsObjectGeneration: true, // Assuming applies
    supportsTools: true,
    supportsToolStreaming: true,
    supportsComputerUse: true,
    supportsPromptCache: true,
    inputPrice: 3.0,
    outputPrice: 15.0,
    cacheWritesPrice: 3.75,
    cacheReadsPrice: 0.3,
    thinking: true,
  },
};