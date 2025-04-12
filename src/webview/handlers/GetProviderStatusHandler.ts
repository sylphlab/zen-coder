import * as vscode from 'vscode';
import { MessageHandler, HandlerContext } from './MessageHandler';

export class GetProviderStatusHandler implements MessageHandler {
    public readonly messageType = 'getProviderStatus';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log("[GetProviderStatusHandler] Handling getProviderStatus message...");
        try {
            // Use ProviderStatusManager
            const currentStatusList = await context.providerStatusManager.getProviderStatus();
            context.postMessage({ type: 'providerStatus', payload: currentStatusList });
            console.log("[GetProviderStatusHandler] Sent updated provider status list.");
        } catch (error: any) {
            console.error("[GetProviderStatusHandler] Error getting provider status:", error);
            vscode.window.showErrorMessage(`Error getting provider status: ${error.message}`);
            context.postMessage({ type: 'providerStatus', payload: [] }); // Send empty array on error
        }
    }
}