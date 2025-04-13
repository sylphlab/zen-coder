import { MessageHandler, HandlerContext } from './MessageHandler';

export class CreateChatHandler implements MessageHandler {
    public readonly messageType = 'createChat';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log("[CreateChatHandler] Handling createChat message...");
        try {
            // Create the new chat session (HistoryManager handles saving and setting it active)
            const newChat = await context.historyManager.createChatSession(); // Name is optional

            // Send the updated chat state back to the UI
            const allChats = context.historyManager.getAllChatSessions();
            const lastActiveId = context.historyManager.getLastActiveChatId(); // Should be the new chat ID
            context.postMessage({ type: 'loadChatState', payload: { chats: allChats, lastActiveChatId: lastActiveId } });

            console.log(`[CreateChatHandler] New chat created (ID: ${newChat.id}). Sent updated state to UI.`);

        } catch (error: any) {
            console.error("[CreateChatHandler] Error creating chat session:", error);
            // Optionally inform the UI about the error
            context.postMessage({ type: 'showError', payload: { message: `Failed to create new chat: ${error.message}` } });
        }
    }
}