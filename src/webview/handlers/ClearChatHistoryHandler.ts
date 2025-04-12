import { MessageHandler, HandlerContext } from './MessageHandler';

export class ClearChatHistoryHandler implements MessageHandler {
    public readonly messageType = 'clearChatHistory';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log("[ClearChatHistoryHandler] Handling clearChatHistory message...");
        await context.historyManager.clearHistory();
        // Optionally send confirmation back, but UI likely cleared its state already
        // context.postMessage({ type: 'historyCleared' });
        console.log("[ClearChatHistoryHandler] History cleared.");
    }
}