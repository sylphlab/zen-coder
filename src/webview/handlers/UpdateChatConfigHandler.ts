import * as vscode from 'vscode';
import { RequestHandler, HandlerContext } from './RequestHandler';
import { ChatConfig, ChatSession } from '../../common/types'; // Import ChatConfig and ChatSession types

interface UpdateChatConfigPayload {
    chatId: string;
    config: Partial<ChatConfig>; // Allow partial updates
}

// Define the expected return type for the frontend
interface UpdateChatConfigResult {
    config: ChatConfig;
}

export class UpdateChatConfigHandler implements RequestHandler {
    public readonly requestType = 'updateChatConfig';

    // Correct the return type in the method signature
    public async handle(payload: UpdateChatConfigPayload, context: HandlerContext): Promise<UpdateChatConfigResult> {
        const { chatId, config } = payload;

        if (!chatId || typeof chatId !== 'string' || !config || typeof config !== 'object') {
            console.error('[UpdateChatConfigHandler] Invalid payload:', payload);
            throw new Error('Invalid payload for updateChatConfig request.');
        }

        console.log(`[UpdateChatConfigHandler] Handling updateChatConfig for chat ID: ${chatId}`, config);

        try {
            const chat = context.chatSessionManager.getChatSession(chatId); // Use chatSessionManager
            if (!chat) {
                throw new Error(`Chat session not found: ${chatId}`);
            }
            // Merge existing config with the partial update
            const mergedConfig: ChatConfig = {
                ...chat.config, // Start with existing config
                ...config       // Apply partial updates
            };
            // Pass the complete, merged config object
            await context.chatSessionManager.updateChatSession(chatId, { config: mergedConfig }); // Use chatSessionManager
            console.log(`[UpdateChatConfigHandler] Successfully updated config for chat ${chatId}.`);

            // Get the updated session data
            const updatedSession = context.chatSessionManager.getChatSession(chatId); // Use chatSessionManager
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
                 // Even if push fails, the update was successful in the backend
            }
            // Return the updated config as expected by the frontend mutation store
            if (!updatedSession?.config) {
                 // This case should ideally not happen if updateChatSession worked,
                 // but handle defensively.
                 console.error(`[UpdateChatConfigHandler] Config not found for session ${chatId} after update.`);
                 throw new Error('Config not found after update.');
             }
             // Correctly return the object matching UpdateChatConfigResult
            return { config: updatedSession.config }; // Ensure this matches the Promise<UpdateChatConfigResult> signature
        } catch (error: any) {
            console.error(`[UpdateChatConfigHandler] Error updating config for chat ${chatId}:`, error);
            vscode.window.showErrorMessage(`Failed to update chat config: ${error.message}`);
            throw new Error(`Failed to update chat config: ${error.message}`);
        }
    }
}
