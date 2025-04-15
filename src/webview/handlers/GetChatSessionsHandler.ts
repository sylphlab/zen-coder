import { RequestHandler, HandlerContext } from './RequestHandler';
import { ChatSession } from '../../common/types';

// Define the response type containing the sessions array
export interface GetChatSessionsResponse {
    sessions: ChatSession[];
}

// Payload is empty for getting all sessions
export interface GetChatSessionsPayload {}

export class GetChatSessionsHandler implements RequestHandler<GetChatSessionsPayload, GetChatSessionsResponse> {
    public readonly requestType = 'getChatSessions';
    public static readonly requestType = 'getChatSessions'; // Keep static for registration consistency

    // Return the chat sessions payload or throw an error
    public async handle(_payload: GetChatSessionsPayload, context: HandlerContext): Promise<GetChatSessionsResponse> {
        console.log(`[${this.requestType}] Handling request...`);
        try {
            const allSessions = context.chatSessionManager.getAllChatSessions(); // Use chatSessionManager
            console.log(`[${this.requestType}] Returning ${allSessions.length} sessions.`);
            // Return the correct response structure
            return {
                sessions: allSessions
            };
        } catch (error: any) {
            console.error(`[${this.requestType}] Error fetching chat sessions:`, error);
            throw new Error(`Failed to fetch chat sessions: ${error.message}`);
        }
    }
}
