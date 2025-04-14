import { MessageHandler, HandlerContext } from './MessageHandler';

export class SubscribeToMcpStatusHandler implements MessageHandler {
    public readonly messageType = 'subscribeToMcpStatus';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log(`[${this.messageType}] Handling request...`);
        try {
            context.mcpManager.setWebviewSubscription(true);
            console.log(`[${this.messageType}] Webview subscribed to MCP status updates.`);

            // Optionally, push the current status immediately upon subscription
            const currentStatus = context.mcpManager.getMcpServerConfiguredStatus();
            context.postMessage({ type: 'updateMcpConfiguredStatus', payload: currentStatus });

        } catch (error: any) {
            console.error(`[${this.messageType}] Error setting subscription:`, error);
            // Optionally notify webview of error
        }
    }
}