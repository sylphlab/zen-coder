import { RequestHandler, HandlerContext } from './RequestHandler'; // Correct import path

export class SubscribeToMcpStatusHandler implements RequestHandler { // Implement correct interface
    public readonly requestType = 'subscribeToMcpStatus'; // Use correct property name

    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> { // Update signature and return type
        console.log(`[${this.requestType}] Handling request...`); // Use correct property name
        try {
            context.mcpManager.setWebviewSubscription(true);
            console.log(`[${this.requestType}] Webview subscribed to MCP status updates.`); // Use correct property name

            // Push the current status immediately upon subscription via pushUpdate
            const currentStatus = context.mcpManager.getMcpServerConfiguredStatus();
            context.postMessage({
                type: 'pushUpdate',
                topic: 'mcpStatusUpdate', // Use a specific topic
                payload: currentStatus
            });
            console.log(`[${this.requestType}] Sent initial MCP status state.`); // Use correct property name

            return { success: true }; // Return success

        } catch (error: any) {
            console.error(`[${this.requestType}] Error setting subscription:`, error); // Use correct property name
            // Rethrow the error to be handled by the request manager
            throw new Error(`Failed to subscribe to MCP status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
