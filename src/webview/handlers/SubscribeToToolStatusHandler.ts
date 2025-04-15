import { RequestHandler, HandlerContext } from './RequestHandler'; // Correct import path

export class SubscribeToToolStatusHandler implements RequestHandler { // Implement correct interface
    public readonly requestType = 'subscribeToToolStatus'; // Use correct property name

    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> { // Update signature and return type
        console.log(`[${this.requestType}] Handling request...`);
        const topic = 'allToolsStatusUpdate'; // Use standard topic name
        try {
            await context.aiService.addSubscription(topic); // Use addSubscription
            console.log(`[${this.requestType}] Webview subscribed to Tool status updates.`);

            // Push the current status immediately upon subscription via pushUpdate
            const currentStatus = await context.aiService.getResolvedToolStatusInfo(); // Use correct method
            context.postMessage({
                type: 'pushUpdate',
                payload: { // Add payload wrapper
                    topic: topic, // Standard topic name
                    data: currentStatus // Data within payload
                }
            });
            console.log(`[${this.requestType}] Sent initial Tool status state.`);

            return { success: true }; // Return success

        } catch (error: any) {
            console.error(`[${this.requestType}] Error setting subscription:`, error); // Use correct property name
            // Rethrow the error
            throw new Error(`Failed to subscribe to Tool status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
