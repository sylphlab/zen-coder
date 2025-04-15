import { RequestHandler } from './RequestHandler';
import { UiMessage } from '../../common/types';
import { HistoryManager } from '../../historyManager';

export interface GetChatHistoryPayload {
    chatId: string;
}

export interface GetChatHistoryResponse {
    history: UiMessage[] | null;
}

export class GetChatHistoryHandler implements RequestHandler<GetChatHistoryPayload, GetChatHistoryResponse> {
    public readonly requestType = 'getChatHistory';
    public static readonly requestType = 'getChatHistory';

    private historyManager: HistoryManager;

    constructor(historyManager: HistoryManager) {
        this.historyManager = historyManager;
    }

    public async handle(payload: GetChatHistoryPayload): Promise<GetChatHistoryResponse> {
        if (!payload || !payload.chatId) {
            console.error('GetChatHistoryHandler: Missing chatId in payload');
            throw new Error('Missing required chatId');
        }
        console.log(`GetChatHistoryHandler: Fetching history for chatId: ${payload.chatId}`);
        // getHistory returns UiMessage[] or [], ensure null is returned if session doesn't exist maybe?
        // Let's assume getHistory handles non-existent chat gracefully (returns [])
        const history = this.historyManager.getHistory(payload.chatId);
        console.log(`GetChatHistoryHandler: Found history length: ${history?.length ?? 'null'}`);
        // Return a *copy* of the history to prevent mutation issues if backend modifies it later
        return { history: history ? [...history] : null };
    }
}
