import * as vscode from 'vscode';
import { MessageHandler, HandlerContext } from './MessageHandler';

export class WebviewReadyHandler implements MessageHandler {
    public readonly messageType = 'webviewReady';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log("[WebviewReadyHandler] Handling webviewReady message...");
        try {
            // Use ModelResolver
            const models = await context.modelResolver.resolveAvailableModels();
            context.postMessage({ type: 'availableModels', payload: models });
            console.log("[WebviewReadyHandler] Sent available models.");

            // Send chat sessions and last active ID from HistoryManager
            const allChats = context.historyManager.getAllChatSessions();
            const lastActiveId = context.historyManager.getLastActiveChatId();
            const lastLocation = context.historyManager.getLastLocation(); // Get last location
            context.postMessage({
                type: 'loadChatState',
                payload: {
                    chats: allChats,
                    lastActiveChatId: lastActiveId,
                    lastLocation: lastLocation // Include last location
                }
            });
            console.log(`[WebviewReadyHandler] Sent ${allChats.length} chats, last active ID (${lastActiveId}), last location (${lastLocation}).`);

            // Use ProviderStatusManager
            const statusList = await context.providerStatusManager.getProviderStatus();
            context.postMessage({ type: 'providerStatus', payload: statusList });
            console.log("[WebviewReadyHandler] Sent provider status list.");
        } catch (error: any) {
            console.error("[WebviewReadyHandler] Error fetching initial state:", error);
            vscode.window.showErrorMessage(`Error fetching initial state: ${error.message}`);
            // Send empty states on error to prevent UI hanging
            context.postMessage({ type: 'availableModels', payload: [] });
            context.postMessage({ type: 'providerStatus', payload: [] });
            context.postMessage({ type: 'loadChatState', payload: { chats: [], lastActiveChatId: null, lastLocation: '/index.html' } }); // Include default location on error
        }
    }
}