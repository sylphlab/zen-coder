import { MessageHandler, HandlerContext } from './MessageHandler';

/**
 * Handles the 'retryMcpConnection' message from the webview.
 * Triggers a connection retry attempt for a specific MCP server using AiService
 * (which delegates to McpManager). McpManager will notify the UI about the
 * status update via the postMessage callback after the attempt.
 */
export class RetryMcpConnectionHandler implements MessageHandler {
    public messageType = 'retryMcpConnection';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        const serverName = message.payload?.serverName;
        if (typeof serverName !== 'string' || !serverName) {
            console.error(`[Handler] Invalid or missing serverName in ${this.messageType} message payload:`, message.payload);
            // Optionally send an error back, though the UI might not expect a direct response here
            context.postMessage({
                type: 'error',
                payload: 'Invalid request: Missing server name for connection retry.'
            });
            return;
        }

        console.log(`[Handler] Handling ${this.messageType} for server: ${serverName}`);
        try {
            // Call the retry method on AiService (which delegates to McpManager)
            // This method doesn't return status directly; McpManager sends an update message.
            await context.aiService.retryMcpConnection(serverName);
            console.log(`[Handler] Triggered retry for ${serverName}. McpManager will send status update.`);

        } catch (error) {
            console.error(`[Handler] Error triggering retry for ${serverName}:`, error);
            // Send error back to the webview
            // We might still want McpManager to send its own status update even on error here.
            // For now, just log the error during the trigger phase.
             context.postMessage({
                 type: 'error', // Generic error type
                 payload: `Failed to trigger retry for ${serverName}: ${error instanceof Error ? error.message : 'Unknown error'}`
             });
        }
    }
}