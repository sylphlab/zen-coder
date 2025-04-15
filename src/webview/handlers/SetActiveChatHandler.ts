import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler

export class SetActiveChatHandler implements RequestHandler {
    public readonly requestType = 'setActiveChat'; // Change messageType to requestType

    // Return a simple success object or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> {
        const chatId = payload?.chatId;
        if (chatId && typeof chatId === 'string') {
            console.log(`[SetActiveChatHandler] Setting active chat ID to: ${chatId}`);
            await context.chatSessionManager.setLastActiveChatId(chatId); // Use chatSessionManager
            return { success: true }; // Return success
        } else {
            console.error("[SetActiveChatHandler] Invalid or missing chatId in payload:", payload);
            throw new Error("Invalid payload for setActiveChat request."); // Throw error
        }
    }
}
