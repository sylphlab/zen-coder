import * as vscode from 'vscode';
import { providerMap, ModelDefinition } from './providers'; // Import provider map and model def type
import { ProviderStatusManager } from './providerStatusManager'; // Needs status manager
import { ApiProviderKey } from './aiService'; // Need ApiProviderKey type
import { AvailableModel } from '../common/types'; // Use shared type

/**
 * Resolves the list of available AI models based on enabled providers and set API keys.
 */
export class ModelResolver {
    constructor(
        private context: vscode.ExtensionContext,
        private providerStatusManager: ProviderStatusManager // Inject status manager
    ) {}

    /**
     * Fetches and compiles a list of available models from all enabled providers
     * that have their required API keys set.
     * @returns A promise resolving to an array of AvailableModel objects.
     */
    public async resolveAvailableModels(): Promise<AvailableModel[]> {
        const allResolvedModels: AvailableModel[] = [];
        // Get the current status of all providers first
        const providerInfoList = await this.providerStatusManager.getProviderStatus();

        console.log(`[ModelResolver] Starting model resolution for ${providerInfoList.length} providers.`);

        for (const providerInfo of providerInfoList) {
            // Check if provider is enabled and has API key if required
            if (providerInfo.enabled && (providerInfo.apiKeySet || !providerInfo.requiresApiKey)) {
                const provider = providerMap.get(providerInfo.id);

                if (!provider) {
                    console.warn(`[ModelResolver] Provider implementation not found for ID '${providerInfo.id}'. Skipping.`);
                    continue;
                }

                try {
                    console.log(`[ModelResolver] Fetching models for enabled provider: ${provider.name}`);
                    let apiKey: string | undefined;
                    if (provider.requiresApiKey) {
                        // Fetch the API key again if needed by the provider's getAvailableModels method
                        apiKey = await provider.getApiKey(this.context.secrets);
                        if (!apiKey) {
                             console.warn(`[ModelResolver] Skipping ${provider.name} model fetch: API key required but not found/retrieved.`);
                             continue; // Skip if key needed but not available
                        }
                    }
                    // Get models from the specific provider implementation
                    const modelsFromProvider: ModelDefinition[] = await provider.getAvailableModels(apiKey);

                    // Map to the common AvailableModel format
                    const resolvedPortion: AvailableModel[] = modelsFromProvider.map(m => ({
                        id: m.id,
                        name: m.name, // Use 'name' for display label
                        providerId: provider.id,
                        providerName: provider.name,
                        // 'source' could be added here if needed, based on provider logic
                    }));
                    allResolvedModels.push(...resolvedPortion);
                    console.log(`[ModelResolver] Successfully fetched/retrieved ${resolvedPortion.length} models from ${provider.name}.`);
                } catch (error) {
                    console.error(`[ModelResolver] Failed to fetch models for provider ${provider.name}:`, error);
                    // Optionally show a less intrusive warning or log only
                    // vscode.window.showWarningMessage(`無法從 ${provider.name} 獲取模型列表。`);
                }
            } else {
                console.log(`[ModelResolver] Skipping model fetch for disabled/keyless provider: ${providerInfo.name}`);
            }
        }

        // Ensure uniqueness (though unlikely with current structure) and sort
        const uniqueModels = Array.from(new Map(allResolvedModels.map(m => [m.id, m])).values());
        uniqueModels.sort((a, b) => {
             // Sort primarily by provider name, then by model name
             const providerCompare = a.providerName.localeCompare(b.providerName);
             if (providerCompare !== 0) return providerCompare;
             return a.name.localeCompare(b.name);
        });

        console.log("[ModelResolver] Final resolved available models count:", uniqueModels.length);
        return uniqueModels;
    }
}