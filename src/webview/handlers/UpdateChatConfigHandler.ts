import * as vscode from 'vscode';
import { RequestHandler, HandlerContext } from './RequestHandler';
import { ChatConfig, ChatSession } from '../../common/types'; // Import ChatConfig and ChatSession types

interface UpdateChatConfigPayload {
    chatId: string;
    config: Partial<ChatConfig>; // Allow partial updates
}

export class UpdateChatConfigHandler implements RequestHandler {
    public readonly requestType = 'updateChatConfig';

    public async handle(payload: UpdateChatConfigPayload, context: HandlerContext): Promise<{ success: boolean }> {
        const { chatId, config } = payload;

        if (!chatId || typeof chatId !== 'string' || !config || typeof config !== 'object') {
            console.error('[UpdateChatConfigHandler] Invalid payload:', payload);
            throw new Error('Invalid payload for updateChatConfig request.');
        }

        console.log(`[UpdateChatConfigHandler] Handling updateChatConfig for chat ID: ${chatId}`, config);

        try {
            const chat = context.historyManager.getChatSession(chatId);
            if (!chat) {
                throw new Error(`Chat session not found: ${chatId}`);
            }
            // Merge existing config with the partial update
            const mergedConfig: ChatConfig = {
                ...chat.config, // Start with existing config
                ...config       // Apply partial updates
            };
            // Pass the complete, merged config object
            await context.historyManager.updateChatSession(chatId, { config: mergedConfig });
            console.log(`[UpdateChatConfigHandler] Successfully updated config for chat ${chatId}.`);

            // Get the updated session data
            const updatedSession = context.historyManager.getChatSession(chatId);
            if (updatedSession) {
                // Trigger a push update for the specific chat session
                const topic = `chatSessionUpdate/${chatId}`;
                context.postMessage({
                    type: 'pushUpdate',
                    payload: {
                        topic: topic,
                        data: updatedSession // Send the full updated session object
                    }
                });
                console.log(`[UpdateChatConfigHandler] Config updated for chat ${chatId} and ${topic} pushed.`);
            } else {
                 console.warn(`[UpdateChatConfigHandler] Could not find session ${chatId} after update to push.`);
            }
            return { success: true };
        } catch (error: any) {
            console.error(`[UpdateChatConfigHandler] Error updating config for chat ${chatId}:`, error);
            vscode.window.showErrorMessage(`Failed to update chat config: ${error.message}`);
            throw new Error(`Failed to update chat config: ${error.message}`);
        }
    }
}