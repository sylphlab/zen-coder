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

            // Send loaded UI history from HistoryManager
            context.postMessage({ type: 'loadUiHistory', payload: context.historyManager.getHistory() });
            console.log("[WebviewReadyHandler] Sent loaded UI history.");

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
            context.postMessage({ type: 'loadUiHistory', payload: [] });
        }
    }
}