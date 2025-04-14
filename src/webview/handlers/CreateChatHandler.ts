import { RequestHandler, HandlerContext } from './RequestHandler';
import { ChatSession } from '../../common/types'; // Import ChatSession
export class CreateChatHandler implements RequestHandler {
    public readonly requestType = 'createChat'; // Change messageType to requestType

    // Return the new chat session ID or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<{ newChatId: string }> {
        console.log("[CreateChatHandler] Handling createChat message...");
        try {
            // Create the new chat session (HistoryManager handles saving and setting it active)
            const newChat = await context.historyManager.createChatSession(); // Name is optional

            // No push needed here. Frontend navigates, ChatView mounts,
            // and chatSessionAtomFamily gets initial state from chatSessionsAtom.
            // chatSessionsAtom itself is updated via chatSessionsUpdate pushed by Create/Delete handlers.
            // Correction: CreateChatHandler *should* push chatSessionsUpdate so the list page updates.
            const allSessions = context.historyManager.getAllChatSessions();
            context.postMessage({
                type: 'pushUpdate',
                payload: {
                    topic: 'chatSessionsUpdate',
                    data: { sessions: allSessions }
                }
            });

            console.log(`[CreateChatHandler] New chat created (ID: ${newChat.id}) and chatSessionsUpdate pushed.`);
            return { newChatId: newChat.id };

        } catch (error: any) {
            console.error("[CreateChatHandler] Error creating chat session:", error);
            // Throw error to reject the requestData promise
            throw new Error(`Failed to create new chat: ${error.message}`);
        }
    }
}