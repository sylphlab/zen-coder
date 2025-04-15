import * as vscode from 'vscode';
import { AiProvider } from './providers/providerInterface';
import { AnthropicProvider } from './providers/anthropicProvider';
import { GoogleProvider } from './providers/googleProvider';
import { OpenRouterProvider } from './providers/openRouterProvider';
import { DeepseekProvider } from './providers/deepseekProvider';
import { OpenAiProvider } from './providers/openaiProvider';
import { OllamaProvider } from './providers/ollamaProvider';
import { ProviderInfoAndStatus } from '../common/types';
import { ProviderStatusManager } from './providerStatusManager'; // ProviderManager might use this

/**
 * Manages AI Providers, including initialization, configuration (API keys, enablement),
 * and providing access to provider instances and status.
 */
export class ProviderManager {
    public readonly allProviders: AiProvider[];
    public readonly providerMap: Map<string, AiProvider>;
    private readonly context: vscode.ExtensionContext;
    private readonly providerStatusManager: ProviderStatusManager; // Use ProviderStatusManager for status checks
    private readonly _notifyProviderStatusChange: () => Promise<void>; // Callback to notify AiService/SubscriptionManager

    constructor(
        context: vscode.ExtensionContext,
        providerStatusManager: ProviderStatusManager,
        notifyProviderStatusChange: () => Promise<void> // Inject callback
    ) {
        this.context = context;
        this.providerStatusManager = providerStatusManager;
        this._notifyProviderStatusChange = notifyProviderStatusChange;

        // Initialize all known providers
        const providerClasses = [
            AnthropicProvider, GoogleProvider, OpenRouterProvider,
            DeepseekProvider, OpenAiProvider, OllamaProvider,
        ];
        this.allProviders = providerClasses.map(ProviderClass => new ProviderClass(context));
        this.providerMap = new Map(this.allProviders.map(provider => [provider.id, provider]));
        console.log(`[ProviderManager] Initialized ${this.allProviders.length} providers.`);
    }

    /**
     * Gets the status of all providers.
     * Uses ProviderStatusManager to check enablement and API key status.
     */
    public async getProviderStatus(): Promise<ProviderInfoAndStatus[]> {
        // Delegate status checking to ProviderStatusManager
        return await this.providerStatusManager.getProviderStatus(this.allProviders, this.providerMap);
    }

    /**
     * Sets the API key for a specific provider.
     */
    public async setApiKey(providerId: string, apiKey: string): Promise<void> {
        const provider = this.providerMap.get(providerId);
        if (!provider) { throw new Error(`Unknown provider ID '${providerId}'.`); }
        if (!provider.requiresApiKey) {
            console.warn(`[ProviderManager] Attempted to set API key for provider '${providerId}' which does not require one.`);
            return;
        }
        try {
            await provider.setApiKey(this.context.secrets, apiKey);
            console.log(`[ProviderManager] API Key for ${provider.name} updated successfully.`);
            vscode.window.showInformationMessage(`API Key for ${provider.name} updated.`);
            await this._notifyProviderStatusChange(); // Trigger notification
        } catch (error: any) {
            console.error(`[ProviderManager] Error setting API Key for ${provider.name}:`, error);
            vscode.window.showErrorMessage(`Failed to store API key for ${provider.name}: ${error.message}`);
            throw error; // Re-throw for handler
        }
    }

    /**
     * Deletes the API key for a specific provider.
     */
    public async deleteApiKey(providerId: string): Promise<void> {
        const provider = this.providerMap.get(providerId);
        if (!provider) { throw new Error(`Unknown provider ID '${providerId}'.`); }
        if (!provider.requiresApiKey) {
            console.warn(`[ProviderManager] Attempted to delete API key for provider '${providerId}' which does not require one.`);
            return;
        }
        try {
            await provider.deleteApiKey(this.context.secrets);
            console.log(`[ProviderManager] API Key for ${provider.name} deleted successfully.`);
            vscode.window.showInformationMessage(`API Key for ${provider.name} deleted.`);
            await this._notifyProviderStatusChange(); // Trigger notification
        } catch (error: any) {
            console.error(`[ProviderManager] Error deleting API Key for ${provider.name}:`, error);
            vscode.window.showErrorMessage(`Failed to delete API key for ${provider.name}: ${error.message}`);
            throw error; // Re-throw for handler
        }
    }

    /**
     * Sets the enabled status for a specific provider in the configuration.
     */
    public async setProviderEnabled(providerId: string, enabled: boolean): Promise<void> {
        const provider = this.providerMap.get(providerId);
        if (!provider) {
            throw new Error(`Unknown provider ID '${providerId}'.`);
        }
        try {
            // Update the VS Code configuration setting
            const config = vscode.workspace.getConfiguration('zencoder.providers');
            // Use inspect to check the current scope before updating, update workspace if global is undefined/default
            // For simplicity, update global directly for now. Consider more nuanced scope handling later if needed.
            await config.update(providerId, enabled, vscode.ConfigurationTarget.Global);
            console.log(`[ProviderManager] Provider ${provider.name} enabled status set to ${enabled} in configuration.`);
            vscode.window.showInformationMessage(`Provider ${provider.name} ${enabled ? 'enabled' : 'disabled'}.`);

            // IMPORTANT: The provider instance's internal isEnabled() might need updating
            // if it caches the value. Assuming it reads from config each time for now.
            // If not, we'd need a method like provider.updateEnabledStatus(enabled);

            await this._notifyProviderStatusChange(); // Trigger notification
        } catch (error: any) {
            console.error(`[ProviderManager] Error setting enabled status for ${provider.name}:`, error);
            vscode.window.showErrorMessage(`Failed to update enabled status for ${provider.name}: ${error.message}`);
            throw error; // Re-throw for handler
        }
    }
}
