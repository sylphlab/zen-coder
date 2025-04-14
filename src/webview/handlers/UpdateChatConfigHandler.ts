import * as vscode from 'vscode';
import { RequestHandler, HandlerContext } from './RequestHandler';
import { ChatConfig } from '../../common/types'; // Import ChatConfig type

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

            // No need to push updates here, relevant atoms (like activeChatEffectiveConfigAtom)
            // will recompute based on the updated chatSessionsAtom state, which should be
            // updated via a separate mechanism if needed (e.g., a 'chatListUpdated' pub/sub).
            // For now, the frontend optimistically updates its state.

            return { success: true };
        } catch (error: any) {
            console.error(`[UpdateChatConfigHandler] Error updating config for chat ${chatId}:`, error);
            vscode.window.showErrorMessage(`Failed to update chat config: ${error.message}`);
            throw new Error(`Failed to update chat config: ${error.message}`);
        }
    }
}