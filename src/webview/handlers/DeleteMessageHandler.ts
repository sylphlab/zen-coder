import * as vscode from 'vscode';
import { HistoryManager } from '../../historyManager';
import { RequestHandler, HandlerContext } from './RequestHandler';
import { ChatSession } from '../../common/types'; // Import ChatSession
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
            await context.historyManager.deleteMessageFromHistory(chatId, messageId);
            console.log(`[DeleteMessageHandler] Successfully deleted message ${messageId} from history manager.`);
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
    console.log(`[DeleteMessageHandler] Message ${messageId} deleted for chat ${chatId} and ${topic} pushed.`);
} else {
     console.warn(`[DeleteMessageHandler] Could not find session ${chatId} after deleting message to push.`);
}

            return { success: true }; // Return success
        } catch (error: any) {
            console.error(`[DeleteMessageHandler] Error deleting message ${messageId} from chat ${chatId}:`, error);
            vscode.window.showErrorMessage(`刪除消息時出錯: ${error.message}`);
            throw new Error(`Failed to delete message: ${error.message}`); // Throw error
        }
    }
}