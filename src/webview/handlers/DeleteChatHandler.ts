import { MessageHandler, HandlerContext } from './MessageHandler';

export class DeleteChatHandler implements MessageHandler {
    public readonly messageType = 'deleteChat';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        const chatIdToDelete = message.payload?.chatId;
        if (!chatIdToDelete || typeof chatIdToDelete !== 'string') {
            console.error("[DeleteChatHandler] Invalid or missing chatId in payload:", message.payload);
            // Optionally send an error back to the UI
            return;
        }

        console.log(`[DeleteChatHandler] Handling deleteChat message for chat ID: ${chatIdToDelete}...`);

        try {
            await context.historyManager.deleteChatSession(chatIdToDelete);

            // Send the updated chat state back to the UI
            const allChats = context.historyManager.getAllChatSessions();
            // HistoryManager handles resetting lastActiveChatId if the deleted one was active
            const lastActiveId = context.historyManager.getLastActiveChatId();
            context.postMessage({ type: 'loadChatState', payload: { chats: allChats, lastActiveChatId: lastActiveId } });

            console.log(`[DeleteChatHandler] Chat deleted (ID: ${chatIdToDelete}). Sent updated state to UI.`);

        } catch (error: any) {
            console.error(`[DeleteChatHandler] Error deleting chat session (ID: ${chatIdToDelete}):`, error);
            // Optionally inform the UI about the error
            context.postMessage({ type: 'showError', payload: { message: `Failed to delete chat: ${error.message}` } });
        }
    }
}