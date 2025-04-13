import { AiProvider } from './providerInterface';
// Import Provider Classes instead of instances
import { AnthropicProvider } from './anthropicProvider'; // Assuming class export now
import { GoogleProvider } from './googleProvider';       // Assuming class export now
import { OpenRouterProvider } from './openRouterProvider'; // Assuming class export now
import { DeepseekProvider } from './deepseekProvider';   // Assuming class export now
import { OpenAiProvider } from './openaiProvider';
import { OllamaProvider } from './ollamaProvider';

// Remove comments related to instantiation here
// Remove instantiation logic and instance imports


// Remove allProviders array export - this needs context for instantiation
// export const allProviders: AiProvider[] = [ ... ];

/**
 * A map for quick lookup of providers by their unique ID.
 */
// Remove providerMap export - this needs context for instantiation
// export const providerMap: Map<string, AiProvider> = new Map( ... );

// Export individual providers if needed elsewhere, though using the list/map is preferred.
// Export the Provider Classes
export {
  AnthropicProvider,
  GoogleProvider,
  OpenRouterProvider,
  DeepseekProvider,
  OpenAiProvider,
  OllamaProvider,
};

// Export the core interface as well
export * from './providerInterface';