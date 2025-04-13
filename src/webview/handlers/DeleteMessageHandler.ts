import * as vscode from 'vscode';
import { HistoryManager } from '../../historyManager'; // Adjust path as needed
import { MessageHandler } from './MessageHandler'; // Corrected import

interface DeleteMessagePayload {
    chatId: string;
    messageId: string;
}

export class DeleteMessageHandler implements MessageHandler { // Implement the interface
    public readonly messageType = 'deleteMessage'; // Add required property
    constructor(
        private historyManager: HistoryManager,
        private postMessage: (message: any) => void // Store postMessage locally if needed, no super() call
    ) {
        // No super() call needed for implementing an interface
    }

    public async handle(message: { type: string; payload: DeleteMessagePayload }): Promise<void> {
        const { chatId, messageId } = message.payload;

        if (!chatId || !messageId) {
            console.error('[DeleteMessageHandler] Missing chatId or messageId in payload:', message.payload);
            vscode.window.showErrorMessage('無法刪除消息：缺少必要的資訊。');
            return;
        }

        console.log(`[DeleteMessageHandler] Handling delete request for message ${messageId} in chat ${chatId}`);

        try {
            await this.historyManager.deleteMessageFromHistory(chatId, messageId);
            console.log(`[DeleteMessageHandler] Successfully requested deletion of message ${messageId} from history manager.`);
            // No need to send confirmation back to UI, optimistic update is sufficient
        } catch (error: any) {
            console.error(`[DeleteMessageHandler] Error deleting message ${messageId} from chat ${chatId}:`, error);
            vscode.window.showErrorMessage(`刪除消息時出錯: ${error.message}`);
            // Optionally, send an error message back to UI to revert optimistic update
            // this.postMessage({ type: 'errorDeletingMessage', payload: { chatId, messageId, error: error.message } });
        }
    }
}