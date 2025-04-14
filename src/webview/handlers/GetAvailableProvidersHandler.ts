import { MessageHandler, HandlerContext } from './MessageHandler';

export class GetAvailableProvidersHandler implements MessageHandler {
    public readonly messageType = 'getAvailableProviders';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log(`[${this.messageType}] Handling request...`);
        try {
            // Use ModelResolver to get available providers
            const providers = await context.modelResolver.getAvailableProviders();

            // Respond with the providers list
            context.postMessage({
                type: 'availableProviders', // Response type
                payload: providers,
                requestId: message.requestId // Include requestId for correlation
            });
            console.log(`[${this.messageType}] Sent ${providers.length} available providers.`);
        } catch (error: any) {
            console.error(`[${this.messageType}] Error fetching available providers:`, error);
            // Send error response back to the webview
            context.postMessage({
                type: 'availableProvidersError', // Specific error type
                payload: { message: error.message || 'Failed to fetch available providers' },
                requestId: message.requestId
            });
        }
    }
}