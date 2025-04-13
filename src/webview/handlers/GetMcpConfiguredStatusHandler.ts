import { MessageHandler, HandlerContext } from './MessageHandler';

/**
 * Handles the 'getMcpConfiguredStatus' message from the webview.
 * Fetches the configured status (enabled/disabled) of MCP servers from AiService
 * and sends it back to the webview.
 */
export class GetMcpConfiguredStatusHandler implements MessageHandler {
    public messageType = 'getMcpConfiguredStatus';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log(`[Handler] Handling ${this.messageType}`);
        try {
            // Directly call the method on the aiService instance provided in the context
            const configuredStatus = context.aiService.getMcpServerConfiguredStatus();
            console.log(`[Handler] Fetched configured status for ${Object.keys(configuredStatus).length} MCP servers.`);

            // Send the status back to the webview
            context.postMessage({
                type: 'updateMcpConfiguredStatus', // Message type for the webview to listen for
                payload: configuredStatus
            });
        } catch (error) {
            console.error(`[Handler] Error handling ${this.messageType}:`, error);
            // Optionally notify the webview of the error
            context.postMessage({
                type: 'error',
                payload: `Failed to get MCP server configured status: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }
}