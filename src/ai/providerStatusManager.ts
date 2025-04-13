import * as vscode from 'vscode';
// import { allProviders, providerMap } from './providers'; // Removed direct import
import { AiProvider } from './providers/providerInterface'; // Import interface
import { AiService } from './aiService'; // Import AiService
import { ProviderInfoAndStatus } from '../common/types'; // Use shared type

/**
 * Manages retrieving the status (enabled, API key set) of AI providers.
 */
export class ProviderStatusManager {
    private _aiService: AiService; // Store AiService instance

    constructor(
        private context: vscode.ExtensionContext,
        aiService: AiService // Inject AiService
    ) {
        this._aiService = aiService;
    }

    /**
     * Checks if the API key is set for each provider that requires one.
     * @returns A record mapping provider ID to a boolean indicating if the key is set.
     */
    public async getApiKeyStatus(): Promise<Record<string, boolean>> {
        const status: Record<string, boolean> = {};
        // Use providers from AiService instance
        for (const provider of this._aiService.allProviders) {
            if (provider.requiresApiKey) {
                try {
                    // Use the provider's method to check the key
                    const key = await provider.getApiKey(this.context.secrets);
                    status[provider.id] = !!key;
                } catch (error) {
                    console.error(`[ProviderStatusManager] Error checking API key status for ${provider.name}:`, error);
                    status[provider.id] = false; // Assume not set if error occurs
                }
            } else {
                // If no API key is required, consider it 'set' for status purposes
                status[provider.id] = true;
            }
        }
        console.log("[ProviderStatusManager] Calculated API Key Status:", status);
        return status;
    }

    /**
     * Gets the combined status (enabled, API key set) for all providers.
     * @returns An array of ProviderInfoAndStatus objects.
     */
    public async getProviderStatus(): Promise<ProviderInfoAndStatus[]> {
        const apiKeyStatusMap = await this.getApiKeyStatus();
        const combinedStatusList: ProviderInfoAndStatus[] = [];

        // Use providers from AiService instance
        for (const provider of this._aiService.allProviders) {
            const isEnabled = provider.isEnabled(); // Use provider's method
            const hasApiKey = apiKeyStatusMap[provider.id] ?? false;

            // Find the provider details from the map to get name, URL etc.
            // Use providerMap from AiService instance
            const providerDetails = this._aiService.providerMap.get(provider.id);

            combinedStatusList.push({
                id: provider.id,
                name: providerDetails?.name ?? provider.id, // Fallback to ID if name not in map
                apiKeyUrl: providerDetails?.apiKeyUrl,
                requiresApiKey: provider.requiresApiKey,
                enabled: isEnabled,
                apiKeySet: hasApiKey,
                // Models are not part of status, handled by ModelResolver
                models: [], // Keep structure consistent for now, but empty
            });
        }
        combinedStatusList.sort((a, b) => a.name.localeCompare(b.name));
        console.log("[ProviderStatusManager] Calculated Combined Provider Status List:", combinedStatusList.length);
        return combinedStatusList;
    }
}