import { RequestHandler, HandlerContext } from './RequestHandler'; // Import HandlerContext
import { ChatSession } from '../../common/types';
// HistoryManager import no longer needed here

export interface GetChatSessionPayload {
    chatId: string;
}

export interface GetChatSessionResponse {
    session: ChatSession | null;
}

export class GetChatSessionHandler implements RequestHandler<GetChatSessionPayload, GetChatSessionResponse> {
    public readonly requestType = 'getChatSession';
    // Constructor removed - access managers via context

    public async handle(payload: GetChatSessionPayload, context: HandlerContext): Promise<GetChatSessionResponse> { // Add context parameter
        if (!payload || !payload.chatId) {
            console.error('GetChatSessionHandler: Missing chatId in payload');
            throw new Error('Missing required chatId');
        }
        console.log(`GetChatSessionHandler: Fetching session for chatId: ${payload.chatId}`);
        // Get session via ChatSessionManager from context
        const session = context.chatSessionManager.getChatSession(payload.chatId);
        console.log(`GetChatSessionHandler: Found session:`, session);
        return { session: session ?? null };
    }
}
