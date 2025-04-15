import { RequestHandler, HandlerContext } from './RequestHandler';
import { ChatSession } from '../../common/types'; // Import ChatSession
export class DeleteChatHandler implements RequestHandler {
    public readonly requestType = 'deleteChat'; // Change messageType to requestType

    // Return a simple success object or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> {
        const chatIdToDelete = payload?.chatId;
        if (!chatIdToDelete || typeof chatIdToDelete !== 'string') {
            console.error("[DeleteChatHandler] Invalid or missing chatId in payload:", payload);
            throw new Error("Invalid payload for deleteChat request."); // Throw error
        }

        console.log(`[DeleteChatHandler] Handling ${this.requestType} for chat ID: ${chatIdToDelete}...`);

        try {
            await context.chatSessionManager.deleteChatSession(chatIdToDelete); // Use chatSessionManager

            // Trigger a push update with the latest sessions list
            const allSessions = context.chatSessionManager.getAllChatSessions(); // Use chatSessionManager
            context.postMessage({
                type: 'pushUpdate',
                payload: {
                    topic: 'chatSessionsUpdate', // Renamed topic
                    data: { sessions: allSessions } // Only send sessions
                }
            });

            console.log(`[DeleteChatHandler] Chat deleted (ID: ${chatIdToDelete}) and chatSessionsUpdate pushed.`);
            return { success: true }; // Return success

        } catch (error: any) {
            console.error(`[DeleteChatHandler] Error deleting chat session (ID: ${chatIdToDelete}):`, error);
            // Throw error to reject the requestData promise
            throw new Error(`Failed to delete chat: ${error.message}`);
        }
    }
}
