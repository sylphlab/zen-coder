import * as vscode from 'vscode';
import { MessageHandler, HandlerContext } from './MessageHandler';
// import { providerMap } from '../../ai/providers'; // Removed direct import
import { AiService, ApiProviderKey } from '../../ai/aiService'; // Import AiService and ApiProviderKey

export class SetProviderEnabledHandler implements MessageHandler {
    public readonly messageType = 'setProviderEnabled';
    private _aiService: AiService; // Store AiService instance

    constructor(aiService: AiService) { // Inject AiService
        this._aiService = aiService;
    }

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log("[SetProviderEnabledHandler] Handling setProviderEnabled message...");
        if (message.payload && typeof message.payload.provider === 'string' && typeof message.payload.enabled === 'boolean') {
            const providerKeyInput = message.payload.provider;
            const enabled = message.payload.enabled;

            // Use providerMap from AiService instance
            if (this._aiService.providerMap.has(providerKeyInput)) {
                const providerKey = providerKeyInput as ApiProviderKey;
                try {
                    // Call the AiService method which handles config update and event emission
                    await context.aiService.setProviderEnabled(providerKey, enabled);
                    console.log(`[SetProviderEnabledHandler] Called AiService.setProviderEnabled for ${providerKey} to ${enabled}`);

                    // No need to manually get/send status here anymore.
                    // AiService.setProviderEnabled triggers the event emitter.
                    // const updatedStatusList = await context.providerStatusManager.getProviderStatus(context.aiService.allProviders, context.aiService.providerMap);
                    // context.postMessage({ type: 'providerStatus', payload: updatedStatusList }); // REMOVED

                } catch (error: any) {
                    // Error message is likely shown by AiService, just log here
                    console.error(`[SetProviderEnabledHandler] Error calling AiService.setProviderEnabled for ${providerKey}:`, error);
                }
            } else {
                console.error(`[SetProviderEnabledHandler] Invalid provider key received: ${providerKeyInput}`);
            }
        } else {
            console.error("[SetProviderEnabledHandler] Invalid payload:", message.payload);
        }
    }
}