import { MessageHandler, HandlerContext } from './MessageHandler';

export class GetAllToolsStatusHandler implements MessageHandler {
    public readonly messageType = 'getAllToolsStatus';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log(`[${this.messageType}] Handling request...`);
        try {
            // Directly call the method on AiService to get combined status
            const allToolsStatus = await context.aiService.getAllToolsWithStatus();

            // Respond with the tools status
            context.postMessage({
                type: 'allToolsStatus', // Response type
                payload: allToolsStatus,
                requestId: message.requestId // Include requestId for correlation
            });
            console.log(`[${this.messageType}] Sent status for ${Object.keys(allToolsStatus).length} tools.`);
        } catch (error: any) {
            console.error(`[${this.messageType}] Error fetching tools status:`, error);
            // Send error response back to the webview
            context.postMessage({
                type: 'allToolsStatusError', // Specific error type
                payload: { message: error.message || 'Failed to fetch tools status' },
                requestId: message.requestId
            });
        }
    }
}