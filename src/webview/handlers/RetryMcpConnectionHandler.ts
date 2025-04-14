import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler

/**
 * Handles the 'retryMcpConnection' message from the webview.
 * Triggers a connection retry attempt for a specific MCP server using AiService
 * (which delegates to McpManager). McpManager will notify the UI about the
 * status update via the postMessage callback after the attempt.
 */
export class RetryMcpConnectionHandler implements RequestHandler {
    public requestType = 'retryMcpConnection'; // Change messageType to requestType

    // Return a simple success object or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> {
        const serverName = payload?.serverName;
        if (typeof serverName !== 'string' || !serverName) {
            console.error(`[Handler] Invalid or missing serverName in ${this.requestType} message payload:`, payload);
            throw new Error('Invalid payload: Missing server name for connection retry.'); // Throw error
        }

        console.log(`[Handler] Handling ${this.requestType} for server: ${serverName}`);
        try {
            // Call the retry method on AiService (which delegates to McpManager)
            await context.aiService.retryMcpConnection(serverName);
            console.log(`[Handler] Triggered retry for ${serverName}. McpManager will send status update via Pub/Sub.`);
            return { success: true }; // Return success
        } catch (error) {
            console.error(`[Handler] Error triggering retry for ${serverName}:`, error);
            // Throw error to reject the requestData promise
            throw new Error(`Failed to trigger retry for ${serverName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}