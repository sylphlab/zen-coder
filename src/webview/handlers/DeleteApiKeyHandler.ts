import * as vscode from 'vscode';
import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler
// import { providerMap } from '../../ai/providers'; // Removed direct import
import { AiService } from '../../ai/aiService'; // Import AiService

export class DeleteApiKeyHandler implements RequestHandler {
    public readonly requestType = 'deleteApiKey'; // Change messageType to requestType
    private _aiService: AiService; // Store AiService instance

    constructor(aiService: AiService) { // Inject AiService
        this._aiService = aiService;
    }

    // Return a simple success object or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> {
        console.log("[DeleteApiKeyHandler] Handling deleteApiKey message...");
        // Payload is now directly passed
        if (payload && typeof payload.provider === 'string') {
            const providerId = payload.provider;

            // Use providerMap from AiService instance
            if (this._aiService.providerMap.has(providerId)) {
                try {
                    await this._aiService.deleteApiKey(providerId); // Use injected service
                    console.log(`[DeleteApiKeyHandler] API Key delete request processed for ${providerId}`);
                    // No need to manually push updates, Pub/Sub handles it via AiService event emitter
                    return { success: true }; // Return success
                } catch (error: any) {
                    // Error message is likely shown by AiService, just log here
                    console.error(`[DeleteApiKeyHandler] Error deleting API Key for ${providerId}:`, error);
                    throw new Error(`Failed to delete API Key for ${providerId}: ${error.message}`); // Throw error
                }
            } else {
                console.error(`[DeleteApiKeyHandler] Invalid provider ID received: ${providerId}`);
                throw new Error(`Invalid provider ID: ${providerId}`); // Throw error
                vscode.window.showErrorMessage(`Invalid provider ID: ${providerId}`);
            }
        } else {
            console.error("[DeleteApiKeyHandler] Invalid payload:", payload);
            throw new Error("Invalid payload for deleteApiKey request."); // Throw error
        }
    }
}