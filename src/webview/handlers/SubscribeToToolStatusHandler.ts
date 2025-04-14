import { MessageHandler, HandlerContext } from './MessageHandler';

export class SubscribeToToolStatusHandler implements MessageHandler {
    public readonly messageType = 'subscribeToToolStatus';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log(`[${this.messageType}] Handling request...`);
        try {
            context.aiService.setToolStatusSubscription(true);
            console.log(`[${this.messageType}] Webview subscribed to Tool status updates.`);

            // Push the current status immediately upon subscription
            const currentStatus = await context.aiService.getAllToolsWithStatus();
            // Use a specific push type for tool status
            context.postMessage({ type: 'pushUpdateAllToolsStatus', payload: currentStatus });

        } catch (error: any) {
            console.error(`[${this.messageType}] Error setting subscription:`, error);
        }
    }
}