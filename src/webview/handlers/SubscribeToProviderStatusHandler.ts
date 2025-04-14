import { RequestHandler, HandlerContext } from './RequestHandler'; // Correct import path

export class SubscribeToProviderStatusHandler implements RequestHandler { // Implement correct interface
    public readonly requestType = 'subscribeToProviderStatus'; // Use correct property name

    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> { // Update signature and return type
        console.log(`[${this.requestType}] Handling request...`); // Use correct property name
        try {
            // AiService likely manages this subscription state
            context.aiService.setProviderStatusSubscription(true); // Corrected: Call method on AiService
            console.log(`[${this.requestType}] Webview subscribed to Provider status updates.`); // Use correct property name

            // Push the current status immediately upon subscription via pushUpdate
            const currentStatus = await context.providerStatusManager.getProviderStatus(
                context.aiService.allProviders, // Assuming these are still needed
                context.aiService.providerMap   // Assuming these are still needed
            );
            context.postMessage({
                type: 'pushUpdate',
                topic: 'providerStatusUpdate', // Use a specific topic
                payload: currentStatus
            });
            console.log(`[${this.requestType}] Sent initial Provider status state.`); // Use correct property name

            return { success: true }; // Return success

        } catch (error: any) {
            console.error(`[${this.requestType}] Error setting subscription:`, error); // Use correct property name
            // Rethrow the error
            throw new Error(`Failed to subscribe to Provider status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
