import { MessageHandler, HandlerContext } from './MessageHandler';

export class UnsubscribeFromToolStatusHandler implements MessageHandler {
    public readonly messageType = 'unsubscribeFromToolStatus';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log(`[${this.messageType}] Handling request...`);
        try {
            context.aiService.setToolStatusSubscription(false);
            console.log(`[${this.messageType}] Webview unsubscribed from Tool status updates.`);
        } catch (error: any) {
            console.error(`[${this.messageType}] Error setting subscription:`, error);
        }
    }
}