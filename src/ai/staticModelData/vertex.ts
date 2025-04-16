import { StaticModelInfo } from '../../common/types';

// Based on Cline data and Vercel AI SDK table for Google Vertex
export const vertexStaticModels: { [modelId: string]: StaticModelInfo } = {
  "gemini-1.5-pro-latest": { // Maps to gemini-1.5-pro in Vercel table
    id: "vertex:gemini-1.5-pro-latest",
    name: "Vertex Gemini 1.5 Pro Latest",
    providerId: "vertex",
    providerName: "Google Vertex AI",
    maxTokens: 8192, // Default, Cline has 65536 for preview
    contextWindow: 1_048_576, // Cline preview has 1M
    supportsImages: true,
    supportsObjectGeneration: true, // Vercel table
    supportsTools: true,           // Vercel table
    supportsToolStreaming: true,   // Vercel table
    supportsPromptCache: false,    // Cline data for Gemini generally
    // Pricing might differ from Google AI Studio, using Cline's preview pricing as reference
    inputPriceTiers: [
			{ tokenLimit: 128000, price: 3.5 }, // Using Gemini 1.5 Pro Studio pricing as reference
			{ tokenLimit: Infinity, price: 7.0 },
		],
		outputPriceTiers: [
			{ tokenLimit: 128000, price: 10.5 },
			{ tokenLimit: Infinity, price: 21.0 },
		],
  },
  "gemini-1.5-flash-latest": { // Maps to gemini-1.5-flash in Vercel table
    id: "vertex:gemini-1.5-flash-latest",
    name: "Vertex Gemini 1.5 Flash Latest",
    providerId: "vertex",
    providerName: "Google Vertex AI",
    maxTokens: 8192, // Cline data
    contextWindow: 1_048_576, // Cline data
    supportsImages: true,
    supportsObjectGeneration: true, // Vercel table
    supportsTools: true,           // Vercel table
    supportsToolStreaming: true,   // Vercel table
    supportsPromptCache: false,    // Cline data
    inputPriceTiers: [             // Cline data
			{ tokenLimit: 128000, price: 0.35 },
			{ tokenLimit: Infinity, price: 0.7 },
		],
		outputPriceTiers: [
			{ tokenLimit: 128000, price: 1.05 },
			{ tokenLimit: Infinity, price: 2.1 },
		],
  },
  "gemini-1.0-pro": { // Not in Vercel table, using Cline data
    id: "vertex:gemini-1.0-pro",
    name: "Vertex Gemini 1.0 Pro",
    providerId: "vertex",
    providerName: "Google Vertex AI",
    maxTokens: 8192, // Common default
    contextWindow: 32768, // Common for 1.0 Pro
    supportsImages: false, // 1.0 Pro usually doesn't support images directly
    supportsObjectGeneration: false, // Assume false
    supportsTools: true, // Assume true
    supportsToolStreaming: false, // Assume false
    supportsPromptCache: false,
    // Pricing for 1.0 Pro might differ, using Flash as placeholder
    inputPrice: 0.35,
    outputPrice: 1.05,
  },
  "gemini-2.0-flash-exp": { // From Vercel table
    id: "vertex:gemini-2.0-flash-exp",
    name: "Vertex Gemini 2.0 Flash Exp",
    providerId: "vertex",
    providerName: "Google Vertex AI",
    maxTokens: 8192, // Cline
    contextWindow: 1_048_576, // Cline
    supportsImages: true,
    supportsObjectGeneration: true,
    supportsTools: true,
    supportsToolStreaming: true,
    supportsPromptCache: false, // Cline
    inputPrice: 0, // Cline
    outputPrice: 0, // Cline
  },
  // Add Claude models available on Vertex from Cline data
  "claude-3-7-sonnet@20250219": {
    id: "vertex:claude-3-7-sonnet@20250219",
    name: "Vertex Claude 3.7 Sonnet",
    providerId: "vertex",
    providerName: "Google Vertex AI",
    maxTokens: 8192,
    contextWindow: 200_000,
    supportsImages: true,
    supportsObjectGeneration: true, // Assume true based on Anthropic native
    supportsTools: true,           // Assume true
    supportsToolStreaming: true,   // Assume true
    supportsComputerUse: true,
    supportsPromptCache: true,
    inputPrice: 3.0,
    outputPrice: 15.0,
    // Cache prices might differ on Vertex, using Anthropic native as reference
    cacheWritesPrice: 3.75,
    cacheReadsPrice: 0.3,
  },
  "claude-3-5-sonnet@20240620": { // Cline ID differs slightly, using Cline's
    id: "vertex:claude-3-5-sonnet@20240620",
    name: "Vertex Claude 3.5 Sonnet",
    providerId: "vertex",
    providerName: "Google Vertex AI",
    maxTokens: 8192,
    contextWindow: 200_000,
    supportsImages: true,
    supportsObjectGeneration: true, // Assume true
    supportsTools: true,           // Assume true
    supportsToolStreaming: true,   // Assume true
    supportsComputerUse: true,     // Assume true
    supportsPromptCache: true,
    inputPrice: 3.0,
    outputPrice: 15.0,
    cacheWritesPrice: 3.75,
    cacheReadsPrice: 0.3,
  },
  "claude-3-opus@20240229": {
    id: "vertex:claude-3-opus@20240229",
    name: "Vertex Claude 3 Opus",
    providerId: "vertex",
    providerName: "Google Vertex AI",
    maxTokens: 4096,
    contextWindow: 200_000,
    supportsImages: true,
    supportsObjectGeneration: true, // Assume true
    supportsTools: true,           // Assume true
    supportsToolStreaming: true,   // Assume true
    supportsPromptCache: true,
    inputPrice: 15.0,
    outputPrice: 75.0,
    cacheWritesPrice: 18.75,
    cacheReadsPrice: 1.5,
  },
  "claude-3-haiku@20240307": {
    id: "vertex:claude-3-haiku@20240307",
    name: "Vertex Claude 3 Haiku",
    providerId: "vertex",
    providerName: "Google Vertex AI",
    maxTokens: 4096,
    contextWindow: 200_000,
    supportsImages: true,
    supportsObjectGeneration: true, // Assume true
    supportsTools: true,           // Assume true
    supportsToolStreaming: true,   // Assume true
    supportsPromptCache: true,
    inputPrice: 0.25,
    outputPrice: 1.25,
    cacheWritesPrice: 0.3,
    cacheReadsPrice: 0.03,
  },
};