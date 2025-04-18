import * as vscode from 'vscode';
import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler
// import { providerMap } from '../../ai/providers'; // Removed direct import
import { AiService, ApiProviderKey } from '../../ai/aiService'; // Import AiService and ApiProviderKey

export class SetApiKeyHandler implements RequestHandler {
    public readonly requestType = 'setApiKey';
    // Constructor removed - use context

    // Return a simple success object or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> { // Add context
        console.log("[SetApiKeyHandler] Handling setApiKey message...");
        // Payload is now directly passed
        if (payload && typeof payload.provider === 'string' && typeof payload.apiKey === 'string') {
            const providerKey = payload.provider as ApiProviderKey;
            const apiKey = payload.apiKey;

            // Use providerMap via ProviderManager from context.aiService
            if (context.aiService.providerManager.providerMap.has(providerKey)) {
                try {
                    await context.aiService.setApiKey(providerKey, apiKey); // Use context service
                    console.log(`[SetApiKeyHandler] API Key set request processed for ${providerKey}`);
                    // No need to manually push updates, Pub/Sub handles it via ProviderManager event emitter triggering SubscriptionManager
                    return { success: true }; // Return success
                } catch (error: any) {
                    // Error message is likely shown by AiService, just log here
                    console.error(`[SetApiKeyHandler] Error setting API Key for ${providerKey}:`, error);
                    throw new Error(`Failed to set API Key for ${providerKey}: ${error.message}`); // Throw error
                }
            } else {
                console.error(`[SetApiKeyHandler] Invalid provider ID received: ${providerKey}`);
                throw new Error(`Invalid provider ID: ${providerKey}`); // Throw error
                vscode.window.showErrorMessage(`Invalid provider ID: ${providerKey}`);
            }
        } else {
            console.error("[SetApiKeyHandler] Invalid payload:", payload);
            throw new Error("Invalid payload for setApiKey request."); // Throw error
        }
    }
}
