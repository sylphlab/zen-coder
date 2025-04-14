import * as vscode from 'vscode';
import { MessageHandler, HandlerContext } from './MessageHandler'; // Import HandlerContext
import { HistoryManager } from '../../historyManager';
import { ChatConfig } from '../../common/types';

export class UpdateChatConfigHandler implements MessageHandler {
    public readonly messageType = 'updateChatConfig'; // Add the messageType property
    public readonly command = 'updateChatConfig';

    private _historyManager: HistoryManager;

    constructor(historyManager: HistoryManager) {
        this._historyManager = historyManager;
    }

    public async handle(message: any, context: HandlerContext): Promise<void> { // Use HandlerContext
        const { chatId, config } = message.payload;

        if (typeof chatId !== 'string' || !chatId) {
            console.error('UpdateChatConfigHandler: Invalid or missing chatId in payload.');
            // Optionally send error back to webview
            return;
        }

        if (typeof config !== 'object' || config === null) {
            console.error('UpdateChatConfigHandler: Invalid or missing config object in payload.');
            // Optionally send error back to webview
            return;
        }

        // Validate the config object structure minimally (more robust validation can be added)
        const validConfig: Partial<ChatConfig> = {};
        if (config.providerId !== undefined) { validConfig.providerId = config.providerId; }
        if (config.modelId !== undefined) { validConfig.modelId = config.modelId; } // Check for modelId instead of modelName
        if (config.imageModelId !== undefined) { validConfig.imageModelId = config.imageModelId; }
        if (config.optimizeModelId !== undefined) { validConfig.optimizeModelId = config.optimizeModelId; }
        if (config.useDefaults !== undefined) { validConfig.useDefaults = config.useDefaults; }

        if (Object.keys(validConfig).length === 0) {
             console.warn('UpdateChatConfigHandler: Received config object with no valid properties to update.');
             return;
        }

        try {
            // Get the current session to merge the config
            const currentSession = this._historyManager.getChatSession(chatId);
            if (!currentSession) {
                console.error(`[UpdateChatConfigHandler] Could not find chat session ${chatId} to update config.`);
                return;
            }

            // Merge the valid updates into the existing config
            const mergedConfig: ChatConfig = {
                ...currentSession.config, // Start with existing config
                ...validConfig           // Apply validated updates
            };

            // Ensure useDefaults is always a boolean after merge
            if (mergedConfig.useDefaults === undefined) {
                 // If useDefaults wasn't explicitly provided in the update AND wasn't in the original,
                 // we need a default behavior. Let's assume if specific fields are set, useDefaults becomes false.
                 // Or, more simply, ensure it defaults to the existing value or true if that's missing.
                 mergedConfig.useDefaults = currentSession.config.useDefaults ?? true; // Default to true if somehow missing
            }


            // Pass the fully merged config object
            await this._historyManager.updateChatSession(chatId, { config: mergedConfig });
            console.log(`[UpdateChatConfigHandler] Successfully updated config for chat ${chatId}`);
            // Optionally send success confirmation back to webview
        } catch (error) {
            console.error(`[UpdateChatConfigHandler] Error updating chat session config for chat ${chatId}:`, error);
            // Optionally send error back to webview
        }
    }
}