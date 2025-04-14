import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler

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
        // No need to post confirmation back, requestData promise handles it.
        console.log(`[ClearChatHistoryHandler] History cleared for chat ID: ${chatId}.`);
        return { success: true }; // Return success
    }
}