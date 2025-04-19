import * as vscode from 'vscode';
import { ChatSessionManager } from '../session/chatSessionManager';
import { DefaultChatConfig, ChatConfig, Assistant } from '../common/types'; // Import necessary types
import { AssistantManager } from '../session/AssistantManager'; // Import AssistantManager


// Define EffectiveChatConfig locally - Now includes Assistant details
export interface EffectiveChatConfig {
    assistantId?: string; // ID of the resolved assistant
    assistantName?: string; // Name for display/logging
    providerId?: string; // Resolved from Assistant
    modelId?: string; // Resolved from Assistant
    customInstructions?: string; // Resolved from Assistant
    // imageModelId and optimizeModelId removed
}

/**
 * Resolves effective chat configurations by combining default settings and chat-specific overrides.
 */
export class ConfigResolver {
    private readonly _sessionManager: ChatSessionManager;
    private readonly _assistantManager: AssistantManager; // Add AssistantManager dependency


    // Updated constructor
    constructor(sessionManager: ChatSessionManager, assistantManager: AssistantManager) { // Add assistantManager to constructor
        this._sessionManager = sessionManager;
        this._assistantManager = assistantManager; // Store AssistantManager
    }

    /**
     * Reads the default chat configuration from VS Code settings.
     * @returns The default chat configuration (now containing defaultAssistantId).
     */
    public getDefaultConfig(): DefaultChatConfig {
        const config = vscode.workspace.getConfiguration('zencoder.defaults');
        // Read defaultAssistantId from settings
        const defaultConfig: DefaultChatConfig = {
            defaultAssistantId: config.get<string>('defaultAssistantId'),
        };
        console.log("[ConfigResolver] Loaded default config:", defaultConfig);
        return defaultConfig;
    }

    /**
     * Calculates the effective configuration for a specific chat session,
     * resolving the Assistant and its underlying model details.
     * @param chatId - The ID of the chat session.
     * @returns The calculated effective configuration including Assistant details.
     */
    public async getChatEffectiveConfig(chatId: string): Promise<EffectiveChatConfig> {
        const chat = this._sessionManager.getChatSession(chatId);
        const defaults = this.getDefaultConfig();
        const effectiveConfig: EffectiveChatConfig = {};

        // 1. Determine the target Assistant ID
        let targetAssistantId: string | undefined;
        if (chat?.config.useDefaults === false && chat.config.assistantId) {
            targetAssistantId = chat.config.assistantId;
            console.log(`[ConfigResolver|${chatId}] Using chat-specific assistantId: ${targetAssistantId}`);
        } else {
            targetAssistantId = defaults.defaultAssistantId;
            console.log(`[ConfigResolver|${chatId}] Using default assistantId: ${targetAssistantId}`);
        }

        effectiveConfig.assistantId = targetAssistantId;

        // 2. Fetch the Assistant details using AssistantManager
        let selectedAssistant: Assistant | undefined | null = null; // Allow undefined from getAssistantById
        if (targetAssistantId) {
            try {
                // Use the actual AssistantManager
                selectedAssistant = await this._assistantManager.getAssistantById(targetAssistantId);
                if (!selectedAssistant) {
                    console.warn(`[ConfigResolver|${chatId}] Assistant with ID ${targetAssistantId} not found.`);
                } else {
                    console.log(`[ConfigResolver|${chatId}] Successfully fetched assistant details for ${targetAssistantId}.`);
                }
            } catch (error) {
                console.error(`[ConfigResolver|${chatId}] Error fetching assistant ${targetAssistantId}:`, error);
                selectedAssistant = null; // Ensure it's null on error
            }
        } else {
            console.log(`[ConfigResolver|${chatId}] No target assistant ID resolved.`);
        }

        // Removed placeholder data block











        // 3. Populate effectiveConfig from the fetched Assistant
        if (selectedAssistant) {
            effectiveConfig.assistantName = selectedAssistant.name;
            effectiveConfig.providerId = selectedAssistant.modelConfig.providerId; // Access via modelConfig
            effectiveConfig.modelId = selectedAssistant.modelConfig.modelId; // Access via modelConfig
            effectiveConfig.customInstructions = selectedAssistant.instructions; // Use 'instructions'
        } else {
            // Handle case where assistant couldn't be fetched or no ID was specified
            console.warn(`[ConfigResolver|${chatId}] Could not resolve assistant details. Provider/Model will be undefined.`);
            effectiveConfig.assistantName = targetAssistantId ? 'Unknown Assistant' : 'No Assistant Selected';
            effectiveConfig.providerId = undefined;
            effectiveConfig.modelId = undefined;
            effectiveConfig.customInstructions = undefined;
        }

        // imageModelId and optimizeModelId are removed

        console.log(`[ConfigResolver] FINAL Effective config for chat ${chatId}:`, JSON.stringify(effectiveConfig));
        return effectiveConfig;
    }
}
