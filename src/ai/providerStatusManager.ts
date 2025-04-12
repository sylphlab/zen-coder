import * as vscode from 'vscode';
import { allProviders, providerMap } from './providers'; // Import provider definitions
import { ProviderInfoAndStatus } from '../common/types'; // Use shared type

/**
 * Manages retrieving the status (enabled, API key set) of AI providers.
 */
export class ProviderStatusManager {
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Checks if the API key is set for each provider that requires one.
     * @returns A record mapping provider ID to a boolean indicating if the key is set.
     */
    public async getApiKeyStatus(): Promise<Record<string, boolean>> {
        const status: Record<string, boolean> = {};
        for (const provider of allProviders) {
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

        for (const provider of allProviders) {
            const isEnabled = provider.isEnabled(); // Use provider's method
            const hasApiKey = apiKeyStatusMap[provider.id] ?? false;

            // Find the provider details from the map to get name, URL etc.
            const providerDetails = providerMap.get(provider.id);

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