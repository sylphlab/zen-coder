import { RequestHandler, HandlerContext } from './RequestHandler'; // Correct import path
// Removed unused AiService import

/**
 * Handles requests from the webview to subscribe to default config updates.
 */
export class SubscribeToDefaultConfigHandler implements RequestHandler { // Implement correct interface
    public readonly requestType = 'subscribeToDefaultConfig'; // Use correct property name

    // Removed constructor

    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> { // Update signature and return type
        console.log('[SubscribeToDefaultConfigHandler] Received subscription request.');
        // Use the context directly
        const service = context.aiService;
        // Assuming service is always available via context
        await context.aiService.addSubscription('defaultConfig'); // Use addSubscription
        console.log('[SubscribeToDefaultConfigHandler] Default config subscription enabled.');

        // Send the current config immediately upon subscription via pushUpdate
        try {
            const currentConfig = await service.getDefaultConfig();
            // Use context.postMessage for push update
            context.postMessage({
                type: 'pushUpdate',
                payload: { // Add payload wrapper
                    topic: 'defaultConfig', // Standard topic name
                    data: currentConfig // Data within payload
                }
            });
            console.log('[SubscribeToDefaultConfigHandler] Sent initial default config state.');
        } catch (error) {
            console.error('[SubscribeToDefaultConfigHandler] Error sending initial default config state:', error);
            // Don't block success return if initial push fails, just log error
        }
        return { success: true }; // Return success
    }
}
