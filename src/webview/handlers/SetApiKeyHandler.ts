import * as vscode from 'vscode';
import { MessageHandler, HandlerContext } from './MessageHandler';
// import { providerMap } from '../../ai/providers'; // Removed direct import
import { AiService, ApiProviderKey } from '../../ai/aiService'; // Import AiService and ApiProviderKey

export class SetApiKeyHandler implements MessageHandler {
    public readonly messageType = 'setApiKey';
    private _aiService: AiService; // Store AiService instance

    constructor(aiService: AiService) { // Inject AiService
        this._aiService = aiService;
    }

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log("[SetApiKeyHandler] Handling setApiKey message...");
        if (message.payload && typeof message.payload.provider === 'string' && typeof message.payload.apiKey === 'string') {
            const providerKey = message.payload.provider as ApiProviderKey;
            const apiKey = message.payload.apiKey;

            // Use providerMap from AiService instance
            if (this._aiService.providerMap.has(providerKey)) {
                try {
                    await context.aiService.setApiKey(providerKey, apiKey);
                    console.log(`[SetApiKeyHandler] API Key set request processed for ${providerKey}`);

                    // Refresh and send updated provider status list using ProviderStatusManager
                    const updatedStatusList = await context.providerStatusManager.getProviderStatus();
                    context.postMessage({ type: 'providerStatus', payload: updatedStatusList });

                    // Refresh available models as new ones might be available using ModelResolver
                    const currentModels = await context.modelResolver.resolveAvailableModels();
                    context.postMessage({ type: 'availableModels', payload: currentModels });

                } catch (error: any) {
                    // Error message is likely shown by AiService, just log here
                    console.error(`[SetApiKeyHandler] Error setting API Key for ${providerKey}:`, error);
                }
            } else {
                console.error(`[SetApiKeyHandler] Invalid provider ID received: ${providerKey}`);
                vscode.window.showErrorMessage(`Invalid provider ID: ${providerKey}`);
            }
        } else {
            console.error("[SetApiKeyHandler] Invalid payload:", message.payload);
        }
    }
}