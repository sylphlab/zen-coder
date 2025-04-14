import { RequestHandler, HandlerContext } from './RequestHandler';

interface SubscribePayload {
    topic: string;
    subscriptionId: string;
}

export class SubscribeHandler implements RequestHandler {
    public readonly requestType = 'subscribe';

    public async handle(payload: SubscribePayload, context: HandlerContext): Promise<{ success: boolean }> {
        const { topic, subscriptionId } = payload;

        if (!topic || typeof topic !== 'string' || !subscriptionId || typeof subscriptionId !== 'string') {
            console.error('[SubscribeHandler] Invalid payload:', payload);
            throw new Error('Invalid payload for subscribe request.');
        }

        console.log(`[SubscribeHandler] Handling subscription request for topic: ${topic}, ID: ${subscriptionId}`);

        try {
            // Delegate to AiService (or a dedicated SubscriptionManager)
            await context.aiService.addSubscription(topic, subscriptionId);
            console.log(`[SubscribeHandler] Subscription successful for topic: ${topic}, ID: ${subscriptionId}`);
            return { success: true };
        } catch (error: any) {
            console.error(`[SubscribeHandler] Error adding subscription for topic: ${topic}, ID: ${subscriptionId}:`, error);
            throw new Error(`Failed to subscribe to topic ${topic}: ${error.message}`);
        }
    }
}