import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler

export class CreateChatHandler implements RequestHandler {
    public readonly requestType = 'createChat'; // Change messageType to requestType

    // Return the new chat session ID or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<{ newChatId: string }> {
        console.log("[CreateChatHandler] Handling createChat message...");
        try {
            // Create the new chat session (HistoryManager handles saving and setting it active)
            const newChat = await context.historyManager.createChatSession(); // Name is optional

            // No need to manually push 'loadChatState'.
            // The frontend will refetch or update based on other events if necessary,
            // or we can implement a dedicated 'chatListUpdated' Pub/Sub topic later.

            console.log(`[CreateChatHandler] New chat created (ID: ${newChat.id}).`);
            return { newChatId: newChat.id }; // Return the ID of the newly created chat

        } catch (error: any) {
            console.error("[CreateChatHandler] Error creating chat session:", error);
            // Throw error to reject the requestData promise
            throw new Error(`Failed to create new chat: ${error.message}`);
        }
    }
}