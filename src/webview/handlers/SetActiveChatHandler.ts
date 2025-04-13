import { MessageHandler, HandlerContext } from './MessageHandler';

export class SetActiveChatHandler implements MessageHandler {
    public readonly messageType = 'setActiveChat';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        const chatId = message.payload?.chatId;
        if (chatId && typeof chatId === 'string') {
            console.log(`[SetActiveChatHandler] Setting active chat ID to: ${chatId}`);
            // HistoryManager now persists the last active ID when set
            await context.historyManager.setLastActiveChatId(chatId);
            // No confirmation needed back to UI as it likely updated state already
        } else {
            console.error("[SetActiveChatHandler] Invalid or missing chatId in payload:", message.payload);
        }
    }
}