import { MessageHandler, HandlerContext } from './MessageHandler';

export class GetMcpStatusHandler implements MessageHandler {
    public readonly messageType = 'getMcpStatus';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log(`[${this.messageType}] Handling request...`);
        try {
            // Use McpManager to get the configured status
            const mcpStatus = context.mcpManager.getMcpServerConfiguredStatus();

            // Respond with the MCP status
            context.postMessage({
                type: 'mcpStatus', // Response type
                payload: mcpStatus,
                requestId: message.requestId // Include requestId for correlation
            });
            console.log(`[${this.messageType}] Sent status for ${Object.keys(mcpStatus).length} MCP servers.`);
        } catch (error: any) {
            console.error(`[${this.messageType}] Error fetching MCP status:`, error);
            // Send error response back to the webview
            context.postMessage({
                type: 'mcpStatusError', // Specific error type
                payload: { message: error.message || 'Failed to fetch MCP status' },
                requestId: message.requestId
            });
        }
    }
}