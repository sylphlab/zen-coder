import { AiProvider } from './providerInterface';
import { anthropicProvider } from './anthropicProvider';
import { googleProvider } from './googleProvider';
import { openRouterProvider } from './openRouterProvider';
import { deepseekProvider } from './deepseekProvider';

/**
 * A list containing all implemented AI provider modules.
 * This list is used by AiService to manage and access different providers.
 */
export const allProviders: AiProvider[] = [
  anthropicProvider,
  googleProvider,
  openRouterProvider,
  deepseekProvider,
  // Add new providers here as they are implemented
];

/**
 * A map for quick lookup of providers by their unique ID.
 */
export const providerMap: Map<string, AiProvider> = new Map(
  allProviders.map(provider => [provider.id, provider])
);

// Export individual providers if needed elsewhere, though using the list/map is preferred.
export {
  anthropicProvider,
  googleProvider,
  openRouterProvider,
  deepseekProvider,
};

// Export the core interface as well
export * from './providerInterface';