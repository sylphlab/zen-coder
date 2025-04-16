import { StaticModelInfo } from '../../common/types';

// Based on Cline data and Vercel AI SDK table for Google Generative AI
export const googleStaticModels: { [modelId: string]: StaticModelInfo } = {
  "gemini-1.5-pro-latest": { // Assuming this maps to gemini-1.5-pro in Vercel table
    id: "google:gemini-1.5-pro-latest",
    name: "Gemini 1.5 Pro Latest",
    providerId: "google",
    providerName: "Google Generative AI",
    maxTokens: 8192, // Cline data differs, using Vercel's implied limit or common practice
    contextWindow: 1_048_576, // Cline data
    supportsImages: true,
    supportsObjectGeneration: true, // Vercel table
    supportsTools: true,           // Vercel table
    supportsToolStreaming: true,   // Vercel table
    supportsPromptCache: false,    // Cline data
    inputPriceTiers: [             // Cline data
			{ tokenLimit: 128000, price: 3.5 }, // Price per million tokens
			{ tokenLimit: Infinity, price: 7.0 },
		],
		outputPriceTiers: [            // Cline data
			{ tokenLimit: 128000, price: 10.5 },
			{ tokenLimit: Infinity, price: 21.0 },
		],
  },
  "gemini-1.5-flash-latest": { // Assuming this maps to gemini-1.5-flash in Vercel table
    id: "google:gemini-1.5-flash-latest",
    name: "Gemini 1.5 Flash Latest",
    providerId: "google",
    providerName: "Google Generative AI",
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
		outputPriceTiers: [            // Cline data
			{ tokenLimit: 128000, price: 1.05 },
			{ tokenLimit: Infinity, price: 2.1 },
		],
  },
  "gemini-1.0-pro": { // Not explicitly in Vercel table, using Cline data
    id: "google:gemini-1.0-pro",
    name: "Gemini 1.0 Pro",
    providerId: "google",
    providerName: "Google Generative AI",
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
  // Add other models from Cline data if needed, mapping capabilities from Vercel table where possible
  "gemini-2.0-flash-exp": { // From Vercel table
    id: "google:gemini-2.0-flash-exp",
    name: "Gemini 2.0 Flash Exp",
    providerId: "google",
    providerName: "Google Generative AI",
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
  // Note: Cline lists many experimental/preview models. Including only a few relevant ones.
  // "gemini-2.5-pro-exp-03-25" - Already covered by vertex? Or different? Assume different for now.
  // "gemini-2.5-pro-preview-03-25" - Already covered by vertex?
};