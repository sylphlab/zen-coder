import { RequestHandler, HandlerContext } from './RequestHandler'; // Correct import path

export class SubscribeToToolStatusHandler implements RequestHandler { // Implement correct interface
    public readonly requestType = 'subscribeToToolStatus'; // Use correct property name

    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> { // Update signature and return type
        console.log(`[${this.requestType}] Handling request...`); // Use correct property name
        try {
            context.aiService.setToolStatusSubscription(true);
            console.log(`[${this.requestType}] Webview subscribed to Tool status updates.`); // Use correct property name

            // Push the current status immediately upon subscription via pushUpdate
            const currentStatus = await context.aiService.getAllToolsWithStatus();
            context.postMessage({
                type: 'pushUpdate',
                topic: 'toolStatusUpdate', // Use a specific topic
                payload: currentStatus
            });
            console.log(`[${this.requestType}] Sent initial Tool status state.`); // Use correct property name

            return { success: true }; // Return success

        } catch (error: any) {
            console.error(`[${this.requestType}] Error setting subscription:`, error); // Use correct property name
            // Rethrow the error
            throw new Error(`Failed to subscribe to Tool status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
