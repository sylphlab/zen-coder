import { MessageHandler, HandlerContext } from './MessageHandler';

export class ClearChatHistoryHandler implements MessageHandler {
    public readonly messageType = 'clearChatHistory';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        const chatId = message.payload?.chatId; // Expect chatId in payload
        if (!chatId || typeof chatId !== 'string') {
            console.error("[ClearChatHistoryHandler] Invalid or missing chatId in message payload.");
            // Optionally send an error back to the UI
            return;
        }
        console.log(`[ClearChatHistoryHandler] Handling clearChatHistory message for chat ID: ${chatId}...`);
        await context.historyManager.clearHistory(chatId); // Pass chatId
        // Optionally send confirmation back, including chatId
        context.postMessage({ type: 'historyCleared', payload: { chatId: chatId } });
        console.log(`[ClearChatHistoryHandler] History cleared for chat ID: ${chatId}.`);
    }
}