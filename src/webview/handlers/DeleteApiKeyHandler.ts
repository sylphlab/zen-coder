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

                    // Refresh and send updated provider status list using ProviderStatusManager
                    const updatedStatusList = await context.providerStatusManager.getProviderStatus();
                    context.postMessage({ type: 'providerStatus', payload: updatedStatusList });

                    // Refresh available models as some might become unavailable using ModelResolver
                    const currentModels = await context.modelResolver.resolveAvailableModels();
                    context.postMessage({ type: 'availableModels', payload: currentModels });

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