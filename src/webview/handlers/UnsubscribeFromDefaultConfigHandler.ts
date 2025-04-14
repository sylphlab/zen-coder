import { RequestHandler, HandlerContext } from './RequestHandler'; // Correct import path
// Removed unused AiService import

/**
 * Handles requests from the webview to unsubscribe from default config updates.
 */
export class UnsubscribeFromDefaultConfigHandler implements RequestHandler { // Implement correct interface
    public readonly requestType = 'unsubscribeFromDefaultConfig'; // Use correct property name

    // Removed constructor

    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> { // Update signature and return type
        console.log('[UnsubscribeFromDefaultConfigHandler] Received unsubscription request.');
        // Use the context directly
        const service = context.aiService;
        // Assuming service is always available via context
        try {
            service.setDefaultConfigSubscription(false);
            console.log('[UnsubscribeFromDefaultConfigHandler] Default config subscription disabled.');
            return { success: true }; // Return success
        } catch (error: any) {
            console.error('[UnsubscribeFromDefaultConfigHandler] Error disabling subscription:', error);
            throw new Error(`Failed to unsubscribe from default config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
