import * as vscode from 'vscode';
import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler
// import { providerMap } from '../../ai/providers'; // Removed direct import
import { AiService, ApiProviderKey } from '../../ai/aiService'; // Import AiService and ApiProviderKey

export class SetProviderEnabledHandler implements RequestHandler {
    public readonly requestType = 'setProviderEnabled';
    // Constructor removed - use context

    // Return a simple success object or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> { // Add context
        console.log("[SetProviderEnabledHandler] Handling setProviderEnabled message...");
        // Payload is now directly passed
        if (payload && typeof payload.provider === 'string' && typeof payload.enabled === 'boolean') {
            const providerKeyInput = payload.provider;
            const enabled = payload.enabled;

            // Use providerMap via ProviderManager from context.aiService
            if (context.aiService.providerManager.providerMap.has(providerKeyInput)) {
                const providerKey = providerKeyInput as ApiProviderKey;
                try {
                    // Call the AiService method which handles config update and event emission
                    await context.aiService.setProviderEnabled(providerKey, enabled); // Use context service
                    console.log(`[SetProviderEnabledHandler] Called AiService.setProviderEnabled for ${providerKey} to ${enabled}`);
                    // No need to manually push updates, Pub/Sub handles it via ProviderManager event emitter triggering SubscriptionManager
                    return { success: true }; // Return success
                } catch (error: any) {
                    // Error message is likely shown by AiService, just log here
                    console.error(`[SetProviderEnabledHandler] Error calling AiService.setProviderEnabled for ${providerKey}:`, error);
                    throw new Error(`Failed to set provider enabled status for ${providerKey}: ${error.message}`); // Throw error
                }
            } else {
                console.error(`[SetProviderEnabledHandler] Invalid provider key received: ${providerKeyInput}`);
                throw new Error(`Invalid provider key: ${providerKeyInput}`); // Throw error
            }
        } else {
            console.error("[SetProviderEnabledHandler] Invalid payload:", payload);
            throw new Error("Invalid payload for setProviderEnabled request."); // Throw error
        }
    }
}
