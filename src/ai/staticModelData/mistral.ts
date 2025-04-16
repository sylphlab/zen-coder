import { StaticModelInfo } from '../../common/types';

// Based on Cline data and Vercel AI SDK table for Mistral
export const mistralStaticModels: { [modelId: string]: StaticModelInfo } = {
  "codestral-latest": { // Cline default
    id: "mistral:codestral-latest",
    name: "Codestral Latest",
    providerId: "mistral",
    providerName: "Mistral",
    maxTokens: 256_000, // Cline
    contextWindow: 256_000, // Cline
    supportsImages: false, // Cline
    supportsObjectGeneration: true, // Assume true based on other Mistral models in Vercel
    supportsTools: true,           // Assume true
    supportsToolStreaming: true,   // Assume true
    supportsPromptCache: false,    // Cline
    inputPrice: 0.3,               // Cline
    outputPrice: 0.9,              // Cline
  },
  "mistral-large-latest": { // Vercel & Cline
    id: "mistral:mistral-large-latest",
    name: "Mistral Large Latest",
    providerId: "mistral",
    providerName: "Mistral",
    maxTokens: 131_000, // Cline
    contextWindow: 131_000, // Cline
    supportsImages: false, // Cline & Vercel
    supportsObjectGeneration: true, // Vercel
    supportsTools: true,           // Vercel
    supportsToolStreaming: true,   // Vercel
    supportsPromptCache: false,    // Cline
    inputPrice: 2.0,               // Cline
    outputPrice: 6.0,              // Cline
  },
  "mistral-small-latest": { // Vercel & Cline
    id: "mistral:mistral-small-latest",
    name: "Mistral Small Latest",
    providerId: "mistral",
    providerName: "Mistral",
    maxTokens: 32_000, // Cline differs (131k), using Vercel's likely context window as maxTokens
    contextWindow: 32_000, // Cline differs (131k), using Vercel's likely context window
    supportsImages: false, // Cline & Vercel
    supportsObjectGeneration: true, // Vercel
    supportsTools: true,           // Vercel
    supportsToolStreaming: true,   // Vercel
    supportsPromptCache: false,    // Cline
    inputPrice: 0.2,               // Cline
    outputPrice: 0.6,              // Cline
  },
  "pixtral-large-latest": { // Vercel & Cline (pixtral-large-2411)
    id: "mistral:pixtral-large-latest",
    name: "Pixtral Large Latest",
    providerId: "mistral",
    providerName: "Mistral",
    maxTokens: 131_000, // Cline
    contextWindow: 131_000, // Cline
    supportsImages: true, // Cline & Vercel
    supportsObjectGeneration: true, // Vercel
    supportsTools: true,           // Vercel
    supportsToolStreaming: true,   // Vercel
    supportsPromptCache: false,    // Cline
    inputPrice: 2.0,               // Cline
    outputPrice: 6.0,              // Cline
  },
  "pixtral-12b-2409": { // Vercel & Cline
    id: "mistral:pixtral-12b-2409",
    name: "Pixtral 12B (2409)",
    providerId: "mistral",
    providerName: "Mistral",
    maxTokens: 131_000, // Cline
    contextWindow: 131_000, // Cline
    supportsImages: true, // Cline & Vercel
    supportsObjectGeneration: true, // Vercel
    supportsTools: true,           // Vercel
    supportsToolStreaming: true,   // Vercel
    supportsPromptCache: false,    // Cline
    inputPrice: 0.15,              // Cline
    outputPrice: 0.15,             // Cline
  },
  // Skipping other Cline models like ministral, open-mistral-nemo, open-codestral-mamba for brevity
};