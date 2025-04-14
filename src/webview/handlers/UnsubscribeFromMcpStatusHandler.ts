import { RequestHandler, HandlerContext } from './RequestHandler'; // Correct import path

export class UnsubscribeFromMcpStatusHandler implements RequestHandler { // Implement correct interface
    public readonly requestType = 'unsubscribeFromMcpStatus'; // Use correct property name

    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> { // Update signature and return type
        console.log(`[${this.requestType}] Handling request...`); // Use correct property name
        try {
            context.mcpManager.setWebviewSubscription(false);
            console.log(`[${this.requestType}] Webview unsubscribed from MCP status updates.`); // Use correct property name
            return { success: true }; // Return success
        } catch (error: any) {
            console.error(`[${this.requestType}] Error setting subscription:`, error); // Use correct property name
            // Rethrow the error
            throw new Error(`Failed to unsubscribe from MCP status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
