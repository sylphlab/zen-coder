import * as vscode from 'vscode';
import { ChatSessionManager } from '../session/chatSessionManager';
import { DefaultChatConfig } from '../common/types'; // Only import DefaultChatConfig

// Define EffectiveChatConfig locally as it was previously in HistoryManager
export interface EffectiveChatConfig {
    chatModelId?: string;
    providerId?: string;
    imageModelId?: string;
    optimizeModelId?: string;
}

/**
 * Resolves effective chat configurations by combining default settings and chat-specific overrides.
 */
export class ConfigResolver {
    private readonly _sessionManager: ChatSessionManager;

    constructor(sessionManager: ChatSessionManager) {
        this._sessionManager = sessionManager;
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
    public getChatEffectiveConfig(chatId: string): EffectiveChatConfig {
        const chat = this._sessionManager.getChatSession(chatId); // Use session manager
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
        } else {
            // Use defaults, overridden by chat specifics if they exist
            finalProviderId = chat?.config.providerId ?? defaults.defaultProviderId;
            finalModelId = chat?.config.modelId ?? defaults.defaultModelId;
            effectiveConfig.imageModelId = chat?.config.imageModelId ?? defaults.defaultImageModelId;
            effectiveConfig.optimizeModelId = chat?.config.optimizeModelId ?? defaults.defaultOptimizeModelId;
        }

        effectiveConfig.providerId = finalProviderId;

        // Combine providerId and modelId into the chatModelId format (e.g., "anthropic:model-name")
        if (finalProviderId && finalModelId) {
            effectiveConfig.chatModelId = `${finalProviderId}:${finalModelId}`;
        } else {
            effectiveConfig.chatModelId = undefined; // Set to undefined if either part is missing
            if (finalProviderId || finalModelId) {
                 console.warn(`[ConfigResolver] Inconsistent chat model config for chat ${chatId}. Provider: ${finalProviderId}, Model: ${finalModelId}. Setting chatModelId to undefined.`);
            }
        }
        // console.log(`[ConfigResolver] Effective config for chat ${chatId}:`, effectiveConfig); // Optional logging
        return effectiveConfig;
    }
}
