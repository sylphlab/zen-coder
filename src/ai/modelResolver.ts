import * as vscode from 'vscode';
import { ModelDefinition } from './providers/providerInterface'; // Import interface
import { ProviderStatusManager } from './providerStatusManager';
import { AiService } from './aiService'; // Import AiService
import { AvailableModel } from '../common/types'; // Use shared type

const MODEL_CACHE_PREFIX = 'modelCache_'; // Prefix for globalState keys

/**
 * Resolves the list of available AI providers and fetches/caches their models.
 */
export class ModelResolver {
    private _aiService: AiService; // Store AiService instance

    constructor(
        private context: vscode.ExtensionContext, // Keep context for secrets access
        private providerStatusManager: ProviderStatusManager,
        aiService: AiService // Inject AiService
    ) {
        this._aiService = aiService;
    }

    /**
     * Fetches and compiles a list of available models from all enabled providers
     * that have their required API keys set.
     * @returns A promise resolving to an array of AvailableModel objects.
     */
    // DEPRECATED: This method now only returns providers, not models.
    // Use getAvailableProviders for clarity, and fetch models separately.
    public async resolveAvailableModels(): Promise<AvailableModel[]> {
       return this.getAvailableProviders();
    }

    /**
     * Gets the list of providers that are enabled and have their API key set (if required).
     * This method is fast as it does not fetch models from the providers.
     * @returns A promise resolving to an array of AvailableModel-like objects representing providers.
     */
    public async getAvailableProviders(): Promise<AvailableModel[]> {
        const availableProviders: AvailableModel[] = [];
        const providerInfoList = await this.providerStatusManager.getProviderStatus();

        console.log(`[ModelResolver] Getting available providers based on status for ${providerInfoList.length} providers.`);

        for (const providerInfo of providerInfoList) {
            // Check if provider is enabled and has API key if required
            if (providerInfo.enabled && (providerInfo.apiKeySet || !providerInfo.requiresApiKey)) {
                 // Use providerMap from AiService instance to ensure it exists
                 const provider = this._aiService.providerMap.get(providerInfo.id);
                 if (!provider) {
                     console.warn(`[ModelResolver] Provider implementation not found for ID '${providerInfo.id}' during available provider check. Skipping.`);
                     continue;
                 }

                // Add the provider info to the list.
                const placeholderModelId = `${providerInfo.id}:default_placeholder`;
                availableProviders.push({
                    id: placeholderModelId, // Placeholder ID representing the provider
                    name: `${providerInfo.name} (Provider)`, // Indicate this represents the provider
                    providerId: providerInfo.id,
                    providerName: providerInfo.name,
                });
                console.log(`[ModelResolver] Added available provider: ${providerInfo.name}`);
            } else {
                 console.log(`[ModelResolver] Skipping unavailable provider: ${providerInfo.name} (Enabled: ${providerInfo.enabled}, KeySet: ${providerInfo.apiKeySet})`);
            }
        }

        // Sort providers by name
        availableProviders.sort((a, b) => a.providerName.localeCompare(b.providerName));

        console.log("[ModelResolver] Final available providers count:", availableProviders.length);
        return availableProviders;
    }

     /**
     * Gets the cached models for a specific provider from globalState.
     * @param providerId The ID of the provider.
     * @returns An array of ModelDefinition objects or undefined if not cached.
     */
    public getCachedModelsForProvider(providerId: string): ModelDefinition[] | undefined {
        const cacheKey = `${MODEL_CACHE_PREFIX}${providerId}`;
        const cachedData = this.context.globalState.get<ModelDefinition[]>(cacheKey);
        console.log(`[ModelResolver] Cache check for ${providerId}: ${cachedData ? `HIT (${cachedData.length} models)` : 'MISS'}`);
        return cachedData;
    }

    /**
     * Fetches the actual models for a specific provider, updates the cache, and returns the models.
     * @param providerId The ID of the provider.
     * @returns A promise resolving to an array of ModelDefinition objects.
     */
    public async fetchModelsForProvider(providerId: string): Promise<ModelDefinition[]> {
        const provider = this._aiService.providerMap.get(providerId);
        if (!provider) {
            console.error(`[ModelResolver] Provider implementation not found for ID '${providerId}' when fetching models.`);
            // Return empty list instead of throwing to avoid breaking UI completely if provider disappears
            return [];
            // throw new Error(`Provider not found: ${providerId}`);
        }

        console.log(`[ModelResolver] Fetching fresh models for provider: ${provider.name}`);
        let apiKey: string | undefined;
        if (provider.requiresApiKey) {
            apiKey = await provider.getApiKey(this.context.secrets);
            if (!apiKey) {
                 console.warn(`[ModelResolver] Cannot fetch models for ${provider.name}: API key required but not found/retrieved.`);
                 return []; // Return empty, don't update cache on key error
            }
        }

        try {
            const models = await provider.getAvailableModels(apiKey);
            console.log(`[ModelResolver] Successfully fetched ${models.length} fresh models from ${provider.name}.`);
            // Update cache
            const cacheKey = `${MODEL_CACHE_PREFIX}${providerId}`;
            // Use await for the update operation
            await this.context.globalState.update(cacheKey, models);
            console.log(`[ModelResolver] Updated cache for ${providerId}.`);
            return models;
        } catch (error) {
            console.error(`[ModelResolver] Failed to fetch fresh models for provider ${provider.name}:`, error);
            // Return empty list on error, don't update cache
            return [];
        }
    }
}