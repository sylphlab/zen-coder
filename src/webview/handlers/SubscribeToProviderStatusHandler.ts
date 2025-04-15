import { RequestHandler, HandlerContext } from './RequestHandler'; // Correct import path

export class SubscribeToProviderStatusHandler implements RequestHandler { // Implement correct interface
    public readonly requestType = 'subscribeToProviderStatus'; // Use correct property name

    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> { // Update signature and return type
        console.log(`[${this.requestType}] Handling request...`);
        try {
            await context.aiService.addSubscription('providerStatus'); // Use addSubscription
            console.log(`[${this.requestType}] Webview subscribed to Provider status updates.`);

            // Push the current status immediately upon subscription via pushUpdate
            const currentStatus = await context.providerStatusManager.getProviderStatus(
                context.aiService.providerManager.allProviders, // Use providerManager
                context.aiService.providerManager.providerMap    // Use providerManager
            );
            context.postMessage({
                type: 'pushUpdate',
                payload: { // Add payload wrapper
                    topic: 'providerStatus', // Standard topic name
                    data: { payload: currentStatus } // Data needs the inner 'payload' wrapper based on SubscriptionManager
                }
            });
            console.log(`[${this.requestType}] Sent initial Provider status state.`);

            return { success: true }; // Return success

        } catch (error: any) {
            console.error(`[${this.requestType}] Error setting subscription:`, error); // Use correct property name
            // Rethrow the error
            throw new Error(`Failed to subscribe to Provider status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
