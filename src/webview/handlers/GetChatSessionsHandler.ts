import { RequestHandler, HandlerContext } from './RequestHandler';
import { ChatSession } from '../../common/types'; // Import ChatSession directly

// Define the payload type for this handler
export interface GetChatSessionsPayload {
    sessions: ChatSession[];
}

export class GetChatSessionsHandler implements RequestHandler {
    public readonly requestType = 'getChatSessions'; // Renamed requestType

    // Return the chat sessions payload or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<GetChatSessionsPayload> {
        console.log(`[${this.requestType}] Handling request...`);
        try {
            const allSessions = context.historyManager.getAllChatSessions();
            console.log(`[${this.requestType}] Returning ${allSessions.length} sessions.`);
            // Return only the sessions list
            return {
                sessions: allSessions
            };
        } catch (error: any) {
            console.error(`[${this.requestType}] Error fetching chat sessions:`, error);
            throw new Error(`Failed to fetch chat sessions: ${error.message}`);
        }
    }
}