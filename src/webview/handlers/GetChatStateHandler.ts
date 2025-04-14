import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler
import { LoadChatStatePayload } from '../../common/types'; // Import payload type

export class GetChatStateHandler implements RequestHandler {
    public readonly requestType = 'getChatState'; // Change messageType to requestType

    // Return the chat state payload or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<LoadChatStatePayload> {
        console.log(`[${this.requestType}] Handling request...`);
        try {
            const allChats = context.historyManager.getAllChatSessions();
            const lastActiveId = context.historyManager.getLastActiveChatId();
            const lastLocation = context.historyManager.getLastLocation();
            console.log(`[${this.requestType}] Returning ${allChats.length} chats, last active ID (${lastActiveId}), last location (${lastLocation}).`);
            // Return the payload directly for requestData
            return {
                chats: allChats,
                lastActiveChatId: lastActiveId,
                lastLocation: lastLocation
            };
        } catch (error: any) {
            console.error(`[${this.requestType}] Error fetching chat state:`, error);
            // Throw error to reject the requestData promise
            throw new Error(`Failed to fetch chat state: ${error.message}`);
        }
    }
}