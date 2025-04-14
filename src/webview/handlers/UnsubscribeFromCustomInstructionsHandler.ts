import { RequestHandler, HandlerContext } from './RequestHandler'; // Correct import path
// Removed unused AiService import

/**
 * Handles requests from the webview to unsubscribe from custom instructions updates.
 */
export class UnsubscribeFromCustomInstructionsHandler implements RequestHandler { // Implement correct interface
    public readonly requestType = 'unsubscribeFromCustomInstructions'; // Use correct property name

    // Removed constructor

    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> { // Update signature and return type
        console.log('[UnsubscribeFromCustomInstructionsHandler] Received unsubscription request.');
        // Use the context directly
        const service = context.aiService;
        // Assuming service is always available via context
        try {
            service.setCustomInstructionsSubscription(false);
            console.log('[UnsubscribeFromCustomInstructionsHandler] Custom instructions subscription disabled.');
            return { success: true }; // Return success
        } catch (error: any) {
            console.error('[UnsubscribeFromCustomInstructionsHandler] Error disabling subscription:', error);
            throw new Error(`Failed to unsubscribe from custom instructions: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
