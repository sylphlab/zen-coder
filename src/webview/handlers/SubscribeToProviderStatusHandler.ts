import { MessageHandler, HandlerContext } from './MessageHandler';

export class SubscribeToProviderStatusHandler implements MessageHandler {
    public readonly messageType = 'subscribeToProviderStatus';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log(`[${this.messageType}] Handling request...`);
        try {
            // Assuming AiService will manage this subscription state
            context.aiService.setProviderStatusSubscription(true);
            console.log(`[${this.messageType}] Webview subscribed to Provider status updates.`);

            // Push the current status immediately upon subscription
            const currentStatus = await context.providerStatusManager.getProviderStatus(
                context.aiService.allProviders,
                context.aiService.providerMap
            );
            // Use the specific push type
            context.postMessage({ type: 'pushUpdateProviderStatus', payload: currentStatus });

        } catch (error: any) {
            console.error(`[${this.messageType}] Error setting subscription:`, error);
        }
    }
}