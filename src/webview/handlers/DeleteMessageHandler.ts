import * as vscode from 'vscode';
import { HistoryManager } from '../../historyManager'; // Adjust path as needed
import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler

interface DeleteMessagePayload {
    chatId: string;
    messageId: string;
}

export class DeleteMessageHandler implements RequestHandler { // Implement RequestHandler
    public readonly requestType = 'deleteMessage'; // Change messageType to requestType
    // Constructor no longer needed if historyManager is accessed via context

    // Return a simple success object or throw an error
    public async handle(payload: DeleteMessagePayload, context: HandlerContext): Promise<{ success: boolean }> {
        const { chatId, messageId } = payload;

        if (!chatId || !messageId) {
            console.error('[DeleteMessageHandler] Missing chatId or messageId in payload:', payload);
            throw new Error("Invalid payload for deleteMessage request."); // Throw error
        }

        console.log(`[DeleteMessageHandler] Handling delete request for message ${messageId} in chat ${chatId}`);

        try {
            await context.historyManager.deleteMessageFromHistory(chatId, messageId); // Use context
            console.log(`[DeleteMessageHandler] Successfully requested deletion of message ${messageId} from history manager.`);
            return { success: true }; // Return success
        } catch (error: any) {
            console.error(`[DeleteMessageHandler] Error deleting message ${messageId} from chat ${chatId}:`, error);
            vscode.window.showErrorMessage(`刪除消息時出錯: ${error.message}`);
            throw new Error(`Failed to delete message: ${error.message}`); // Throw error
        }
    }
}