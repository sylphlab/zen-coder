import { MessageHandler, HandlerContext } from './MessageHandler';

export class GetProviderStatusHandler implements MessageHandler {
    public readonly messageType = 'getProviderStatus';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log(`[${this.messageType}] Handling request...`);
        try {
            // Use ProviderStatusManager
            const statusList = await context.providerStatusManager.getProviderStatus(
                context.aiService.allProviders,
                context.aiService.providerMap
            );

            // Respond with the status list
            context.postMessage({
                type: 'providerStatus', // Response type
                payload: statusList,
                requestId: message.requestId // Include requestId for correlation
            });
            console.log(`[${this.messageType}] Sent status for ${statusList.length} providers.`);
        } catch (error: any) {
            console.error(`[${this.messageType}] Error fetching provider status:`, error);
            // Send error response back to the webview
            context.postMessage({
                type: 'providerStatusError', // Specific error type
                payload: { message: error.message || 'Failed to fetch provider status' },
                requestId: message.requestId
            });
        }
    }
}