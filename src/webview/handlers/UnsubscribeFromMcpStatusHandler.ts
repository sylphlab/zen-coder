import { MessageHandler, HandlerContext } from './MessageHandler';

export class UnsubscribeFromMcpStatusHandler implements MessageHandler {
    public readonly messageType = 'unsubscribeFromMcpStatus';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log(`[${this.messageType}] Handling request...`);
        try {
            context.mcpManager.setWebviewSubscription(false);
            console.log(`[${this.messageType}] Webview unsubscribed from MCP status updates.`);
        } catch (error: any) {
            console.error(`[${this.messageType}] Error setting subscription:`, error);
            // Optionally notify webview of error
        }
    }
}