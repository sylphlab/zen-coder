import * as vscode from 'vscode';
// import { allProviders, providerMap } from './providers'; // Removed direct import
import { AiProvider } from './providers/providerInterface'; // Import interface
// import { AiService } from './aiService'; // Remove AiService import
import { ProviderInfoAndStatus } from '../common/types'; // Use shared type

/**
 * Manages retrieving the status (enabled, API key set) of AI providers.
 */
export class ProviderStatusManager {
    // private _aiService: AiService; // Remove AiService instance

    constructor(
        private context: vscode.ExtensionContext
        // aiService: AiService // Remove AiService injection
    ) {
        // this._aiService = aiService;
    }

    /**
     * Checks if the API key is set for each provider that requires one.
     * @returns A record mapping provider ID to a boolean indicating if the key is set.
     */
    public async getApiKeyStatus(allProviders: readonly AiProvider[]): Promise<Record<string, boolean>> { // Accept providers as argument
        console.time('[ProviderStatusManager] getApiKeyStatus Execution Time'); // Start timer
        const status: Record<string, boolean> = {};
        // Use passed-in providers
        for (const provider of allProviders) {
            if (provider.requiresApiKey) {
                 const checkStart = Date.now(); // Individual key check start
                try {
                    // Use the provider's method to check the key
                    const key = await provider.getApiKey(this.context.secrets);
                    status[provider.id] = !!key;
                     console.log(`[ProviderStatusManager] Key check for ${provider.name}: ${status[provider.id]} (${Date.now() - checkStart}ms)`); // Log individual time
                } catch (error) {
                    console.error(`[ProviderStatusManager] Error checking API key status for ${provider.name}:`, error);
                    status[provider.id] = false; // Assume not set if error occurs
                     console.log(`[ProviderStatusManager] Key check error for ${provider.name} (${Date.now() - checkStart}ms)`); // Log individual time on error
                }
            } else {
                // If no API key is required, consider it 'set' for status purposes
                status[provider.id] = true;
            }
        }
        console.timeEnd('[ProviderStatusManager] getApiKeyStatus Execution Time'); // End timer
        console.log("[ProviderStatusManager] Calculated API Key Status:", status);
        return status;
    }

    /**
     * Gets the combined status (enabled, API key set) for all providers.
     * @returns An array of ProviderInfoAndStatus objects.
     */
    public async getProviderStatus(
        allProviders: readonly AiProvider[],
        providerMap: ReadonlyMap<string, AiProvider>
    ): Promise<ProviderInfoAndStatus[]> { // Accept providers and map as arguments
        const apiKeyStatusMap = await this.getApiKeyStatus(allProviders); // Pass providers
        const combinedStatusList: ProviderInfoAndStatus[] = [];

        // Use passed-in providers
        for (const provider of allProviders) {
            const isEnabled = provider.isEnabled(); // Use provider's method
            const hasApiKey = apiKeyStatusMap[provider.id] ?? false;
            let models: { id: string; name: string }[] = []; // Initialize models array

            // Find the provider details from the map to get name, URL etc.
            // Use passed-in providerMap
            const providerDetails = providerMap.get(provider.id);

            // Fetch models only if the provider is enabled and has the necessary API key (if required)
            if (isEnabled && (hasApiKey || !provider.requiresApiKey)) {
                try {
                    const apiKey = provider.requiresApiKey ? await provider.getApiKey(this.context.secrets) : undefined;
                    const fetchedModels = await provider.getAvailableModels(apiKey);
                    // Ensure models have both id and name, provide fallback if name is missing
                    models = fetchedModels.map(m => ({
                        id: m.id,
                        name: m.name || m.id // Use ID as fallback name
                    }));
                    console.log(`[ProviderStatusManager] Fetched ${models.length} models for enabled provider ${provider.id}`);
                } catch (error) {
                    console.error(`[ProviderStatusManager] Failed to fetch models for provider ${provider.id}:`, error);
                    // Keep models as empty array on error
                }
            } else {
                 console.log(`[ProviderStatusManager] Skipping model fetch for disabled/key-missing provider ${provider.id}`);
            }

            combinedStatusList.push({
                id: provider.id,
                name: providerDetails?.name ?? provider.id, // Fallback to ID if name not in map
                apiKeyUrl: providerDetails?.apiKeyUrl,
                // @ts-ignore - Access potentially existing properties from the concrete class instance
                apiKeyDescription: providerDetails?.apiKeyDescription,
                // @ts-ignore - Access potentially existing properties from the concrete class instance
                usesComplexCredentials: providerDetails?.usesComplexCredentials,
                requiresApiKey: provider.requiresApiKey,
                enabled: isEnabled,
                apiKeySet: hasApiKey,
                models: models, // Include fetched models
            });
        }
        combinedStatusList.sort((a, b) => a.name.localeCompare(b.name));
        console.log("[ProviderStatusManager] Calculated Combined Provider Status List:", combinedStatusList.length);
        return combinedStatusList;
    }
}
