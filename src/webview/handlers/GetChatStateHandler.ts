import { MessageHandler, HandlerContext } from './MessageHandler';

export class GetChatStateHandler implements MessageHandler {
    public readonly messageType = 'getChatState';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log(`[${this.messageType}] Handling request...`);
        try {
            const allChats = context.historyManager.getAllChatSessions();
            const lastActiveId = context.historyManager.getLastActiveChatId();
            const lastLocation = context.historyManager.getLastLocation(); // Get last location

            // Respond with the chat state
            context.postMessage({
                type: 'chatState', // Use a distinct response type
                payload: {
                    chats: allChats,
                    lastActiveChatId: lastActiveId,
                    lastLocation: lastLocation
                },
                requestId: message.requestId // Include requestId for correlation
            });
            console.log(`[${this.messageType}] Sent ${allChats.length} chats, last active ID (${lastActiveId}), last location (${lastLocation}).`);
        } catch (error: any) {
            console.error(`[${this.messageType}] Error fetching chat state:`, error);
            // Send error response back to the webview
            context.postMessage({
                type: 'chatStateError', // Specific error type
                payload: { message: error.message || 'Failed to fetch chat state' },
                requestId: message.requestId
            });
        }
    }
}