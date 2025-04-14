
import { RequestHandler, HandlerContext } from './RequestHandler'; // Correct import path
// Removed unused AiService import as it's in context

/**
 * Handles requests from the webview to subscribe to custom instructions updates.
 */
export class SubscribeToCustomInstructionsHandler implements RequestHandler { // Implement correct interface
    public readonly requestType = 'subscribeToCustomInstructions'; // Use correct property name

    // Removed constructor, dependencies are in context

    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> { // Update signature and return type
        console.log('[SubscribeToCustomInstructionsHandler] Received subscription request.');
        // Use the context directly
        const service = context.aiService;
        // No null check needed if context setup guarantees aiService exists
        // if (service) { // Assuming service is always available via context
            service.setCustomInstructionsSubscription(true);
            console.log('[SubscribeToCustomInstructionsHandler] Custom instructions subscription enabled.');

            // Send the current instructions immediately upon subscription via pushUpdate
            try {
                const currentInstructions = await service.getCombinedCustomInstructions();
                // Use context.postMessage for push update
                context.postMessage({
                    type: 'pushUpdate',
                    topic: 'customInstructionsUpdate', // Use a specific topic
                    payload: currentInstructions
                });
                console.log('[SubscribeToCustomInstructionsHandler] Sent initial custom instructions state.');
            } catch (error) {
                console.error('[SubscribeToCustomInstructionsHandler] Error sending initial custom instructions state:', error);
                // Don't block success return if initial push fails, just log error
            }
            return { success: true }; // Return success
        // } else { // Assuming service is always available
        //     console.error('[SubscribeToCustomInstructionsHandler] AiService instance not available.');
        //     throw new Error('AiService not available'); // Throw if service is unexpectedly missing
        // }
    }
}
