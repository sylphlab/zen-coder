import { RequestHandler } from './RequestHandler';
import { ChatSession } from '../../common/types';
import { HistoryManager } from '../../historyManager'; // Assuming HistoryManager has a way to get a single session

export interface GetChatSessionPayload {
    chatId: string;
}

export interface GetChatSessionResponse {
    session: ChatSession | null;
}

export class GetChatSessionHandler implements RequestHandler<GetChatSessionPayload, GetChatSessionResponse> {
    public readonly requestType = 'getChatSession'; // Assign literal directly
    public static readonly requestType = 'getChatSession'; // Keep static for registration consistency

    private historyManager: HistoryManager;

    constructor(historyManager: HistoryManager) {
        this.historyManager = historyManager;
    }

    public async handle(payload: GetChatSessionPayload): Promise<GetChatSessionResponse> {
        if (!payload || !payload.chatId) {
            console.error('GetChatSessionHandler: Missing chatId in payload');
            throw new Error('Missing required chatId');
        }
        console.log(`GetChatSessionHandler: Fetching session for chatId: ${payload.chatId}`);
        const session = await this.historyManager.getChatSession(payload.chatId); // Need to implement getChatSession in HistoryManager
        console.log(`GetChatSessionHandler: Found session:`, session);
        return { session: session ?? null }; // Handle potential undefined from getChatSession
    }
}
