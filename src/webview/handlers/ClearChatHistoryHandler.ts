import { RequestHandler, HandlerContext } from './RequestHandler';
import { ChatSession } from '../../common/types'; // Import ChatSession
export class ClearChatHistoryHandler implements RequestHandler {
    public readonly requestType = 'clearChatHistory'; // Change messageType to requestType

    // Return a simple success object or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> {
        const chatId = payload?.chatId; // Expect chatId in payload
        if (!chatId || typeof chatId !== 'string') {
            console.error("[ClearChatHistoryHandler] Invalid or missing chatId in payload.");
            throw new Error("Invalid payload for clearChatHistory request."); // Throw error
        }
        console.log(`[ClearChatHistoryHandler] Handling ${this.requestType} for chat ID: ${chatId}...`);
        await context.historyManager.clearHistory(chatId); // Pass chatId
        // Get the updated session data (history should be empty now)
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
            console.log(`[ClearChatHistoryHandler] History cleared for chat ${chatId} and ${topic} pushed.`);
        } else {
             console.warn(`[ClearChatHistoryHandler] Could not find session ${chatId} after clearing history to push.`);
        }
        return { success: true }; // Return success
    }
}