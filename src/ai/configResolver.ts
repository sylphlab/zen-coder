import * as vscode from 'vscode';
import { ChatSessionManager } from '../session/chatSessionManager';
import { DefaultChatConfig } from '../common/types'; // Only import DefaultChatConfig
import { ProviderManager } from './providerManager'; // Import ProviderManager
import { ModelDefinition } from './providers/providerInterface'; // Import ModelDefinition

// Define EffectiveChatConfig locally
export interface EffectiveChatConfig {
    // Removed chatModelId
    providerId?: string;
    modelId?: string; // Added modelId directly
    imageModelId?: string;
    optimizeModelId?: string;
}

/**
 * Resolves effective chat configurations by combining default settings and chat-specific overrides.
 */
export class ConfigResolver {
    private readonly _sessionManager: ChatSessionManager;
    private readonly _providerManager: ProviderManager; // Add ProviderManager

    constructor(sessionManager: ChatSessionManager, providerManager: ProviderManager) { // Add providerManager parameter
        this._sessionManager = sessionManager;
        this._providerManager = providerManager; // Store ProviderManager
    }

    /**
     * Reads the default chat configuration from VS Code settings.
     * @returns The default chat configuration.
     */
    public getDefaultConfig(): DefaultChatConfig {
        const config = vscode.workspace.getConfiguration('zencoder.defaults');
        const defaultConfig: DefaultChatConfig = {
            defaultProviderId: config.get<string>('defaultProviderId'),
            defaultModelId: config.get<string>('defaultModelId'),
            defaultImageModelId: config.get<string>('imageModelId'),
            defaultOptimizeModelId: config.get<string>('optimizeModelId'),
        };
        // console.log("[ConfigResolver] Loaded default config:", defaultConfig); // Optional logging
        return defaultConfig;
    }

    /**
     * Calculates the effective configuration for a specific chat session,
     * considering its settings and the default configuration.
     * @param chatId - The ID of the chat session.
     * @returns The calculated effective configuration.
     */
    public async getChatEffectiveConfig(chatId: string): Promise<EffectiveChatConfig> { // Make async
        const chat = this._sessionManager.getChatSession(chatId); // Use session manager
        console.log(`[ConfigResolver|${chatId}] Raw chat config from session manager:`, JSON.stringify(chat?.config));
        const defaults = this.getDefaultConfig();
        const effectiveConfig: EffectiveChatConfig = {};

        let finalProviderId: string | undefined;
        let finalModelId: string | undefined;

        if (chat?.config.useDefaults === false) {
            // Use only chat-specific settings if defined
            finalProviderId = chat.config.providerId;
            finalModelId = chat.config.modelId;
            effectiveConfig.imageModelId = chat.config.imageModelId;
            effectiveConfig.optimizeModelId = chat.config.optimizeModelId;
            console.log(`[ConfigResolver|${chatId}] Using chat-specific config. Provider: ${finalProviderId}, Model: ${finalModelId}`);
        } else {
            // Use defaults, overridden by chat specifics if they exist
            finalProviderId = chat?.config.providerId ?? defaults.defaultProviderId;
            const defaultModelIdFromSettings = chat?.config.modelId ?? defaults.defaultModelId;
            console.log(`[ConfigResolver|${chatId}] Using defaults. Initial Provider: ${finalProviderId}, Initial Model: ${defaultModelIdFromSettings}`);

            // *** NEW LOGIC: Validate defaultModelId against finalProviderId ***
            if (finalProviderId) {
                const provider = this._providerManager.providerMap.get(finalProviderId); // Use providerMap.get()
                if (provider) {
                    let providerModels: ModelDefinition[] = [];
                    try {
                        // getAvailableModels might be async
                        providerModels = await provider.getAvailableModels();
                    } catch (error) {
                         console.error(`[ConfigResolver|${chatId}] Error fetching models for provider ${finalProviderId}:`, error);
                    }

                    const isValidModel = providerModels.some(m => m.id === defaultModelIdFromSettings); // Use m.id

                    if (isValidModel) {
                        finalModelId = defaultModelIdFromSettings;
                        console.log(`[ConfigResolver|${chatId}] Validated Model: ${finalModelId} for Provider: ${finalProviderId}`);
                    } else {
                        // Fallback logic: Use the first available model from the provider
                        const firstAvailableModel = providerModels[0]?.id; // Use m.id directly as fallback
                        if (firstAvailableModel) {
                            finalModelId = firstAvailableModel; // Assign the first available model if default is invalid
                            console.warn(`[ConfigResolver|${chatId}] Default model '${defaultModelIdFromSettings}' is invalid or unavailable for provider '${finalProviderId}'. Falling back to '${finalModelId}'.`);
                        } else {
                            // If no models are available at all for the provider, keep the potentially invalid default.
                            // Let _getProviderInstance handle the final error.
                            finalModelId = defaultModelIdFromSettings;
                            console.error(`[ConfigResolver|${chatId}] Default model '${defaultModelIdFromSettings}' is invalid for provider '${finalProviderId}' AND NO models available for this provider! Keeping invalid ID.`);
                        }
                    }
                } else {
                    console.warn(`[ConfigResolver|${chatId}] Could not find provider instance for ID: ${finalProviderId}. Model ID will be undefined.`);
                    finalModelId = undefined; // Provider not found
                }
            } else {
                 console.warn(`[ConfigResolver|${chatId}] No provider ID resolved (neither chat-specific nor default). Model ID will be undefined.`);
                 finalModelId = undefined; // No provider ID
            }
            // *** END NEW LOGIC ***

            effectiveConfig.imageModelId = chat?.config.imageModelId ?? defaults.defaultImageModelId;
            effectiveConfig.optimizeModelId = chat?.config.optimizeModelId ?? defaults.defaultOptimizeModelId;
        }

        // Directly assign the resolved provider and model IDs
        effectiveConfig.providerId = finalProviderId;
        effectiveConfig.modelId = finalModelId;

        console.log(`[ConfigResolver] FINAL Effective config for chat ${chatId}:`, JSON.stringify(effectiveConfig));
        return effectiveConfig;
    }
}
