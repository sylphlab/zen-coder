import * as vscode from 'vscode';
import { MessageHandler, HandlerContext } from './MessageHandler';
// import { providerMap } from '../../ai/providers'; // Removed direct import
import { AiService } from '../../ai/aiService'; // Import AiService

export class DeleteApiKeyHandler implements MessageHandler {
    public readonly messageType = 'deleteApiKey';
    private _aiService: AiService; // Store AiService instance

    constructor(aiService: AiService) { // Inject AiService
        this._aiService = aiService;
    }

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log("[DeleteApiKeyHandler] Handling deleteApiKey message...");
        if (message.payload && typeof message.payload.provider === 'string') {
            const providerId = message.payload.provider;

            // Use providerMap from AiService instance
            if (this._aiService.providerMap.has(providerId)) {
                try {
                    await context.aiService.deleteApiKey(providerId);
                    console.log(`[DeleteApiKeyHandler] API Key delete request processed for ${providerId}`);

                    // No need to manually get/send status here anymore.
                    // AiService.deleteApiKey triggers the event emitter, which updates the webview atom.
                    // const updatedStatusList = await context.providerStatusManager.getProviderStatus(context.aiService.allProviders, context.aiService.providerMap);
                    // context.postMessage({ type: 'providerStatus', payload: updatedStatusList }); // REMOVED

                    // Refresh available *providers* as one might become unavailable
                    const currentProviders = await context.modelResolver.getAvailableProviders();
                    context.postMessage({ type: 'availableProviders', payload: currentProviders }); // Changed type
                    // Note: The frontend should handle removing models associated with the now unavailable provider.
                } catch (error: any) {
                    // Error message is likely shown by AiService, just log here
                    console.error(`[DeleteApiKeyHandler] Error deleting API Key for ${providerId}:`, error);
                }
            } else {
                console.error(`[DeleteApiKeyHandler] Invalid provider ID received: ${providerId}`);
                vscode.window.showErrorMessage(`Invalid provider ID: ${providerId}`);
            }
        } else {
            console.error("[DeleteApiKeyHandler] Invalid payload:", message.payload);
        }
    }
}