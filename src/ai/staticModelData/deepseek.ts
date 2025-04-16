import { StaticModelInfo } from '../../common/types';

// Based on Cline data and Vercel AI SDK table for DeepSeek
export const deepseekStaticModels: { [modelId: string]: StaticModelInfo } = {
  "deepseek-chat": {
    id: "deepseek:deepseek-chat",
    name: "DeepSeek Chat",
    providerId: "deepseek",
    providerName: "DeepSeek",
    maxTokens: 8192, // Cline differs (8000), using Vercel's implied limit or common practice
    contextWindow: 64_000, // Cline
    supportsImages: false, // Cline
    supportsObjectGeneration: true, // Vercel
    supportsTools: true,           // Vercel
    supportsToolStreaming: true,   // Vercel
    supportsPromptCache: true,     // Cline
    inputPrice: 0,                 // Cline (sum of cache reads/writes)
    outputPrice: 1.1,              // Cline
    cacheWritesPrice: 0.27,        // Cline
    cacheReadsPrice: 0.07,         // Cline
    description: "DeepSeek-V3 model, strong general capabilities.", // Added description based on Cline
  },
  "deepseek-reasoner": {
    id: "deepseek:deepseek-reasoner",
    name: "DeepSeek Reasoner",
    providerId: "deepseek",
    providerName: "DeepSeek",
    maxTokens: 8192, // Cline differs (8000)
    contextWindow: 64_000, // Cline
    supportsImages: false, // Cline
    supportsObjectGeneration: false, // Vercel says no
    supportsTools: false,           // Vercel says no
    supportsToolStreaming: false,   // Vercel says no
    supportsPromptCache: true,     // Cline
    inputPrice: 0,                 // Cline
    outputPrice: 2.19,             // Cline
    cacheWritesPrice: 0.55,        // Cline
    cacheReadsPrice: 0.14,         // Cline
    description: "DeepSeek-R1 model, comparable to OpenAI-o1 for reasoning tasks.", // Added description based on Cline
  },
};