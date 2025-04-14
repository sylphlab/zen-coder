import { MessageHandler, HandlerContext } from './MessageHandler';

export class UnsubscribeFromProviderStatusHandler implements MessageHandler {
    public readonly messageType = 'unsubscribeFromProviderStatus';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log(`[${this.messageType}] Handling request...`);
        try {
            // Assuming AiService manages this subscription state
            context.aiService.setProviderStatusSubscription(false);
            console.log(`[${this.messageType}] Webview unsubscribed from Provider status updates.`);
        } catch (error: any) {
            console.error(`[${this.messageType}] Error setting subscription:`, error);
        }
    }
}