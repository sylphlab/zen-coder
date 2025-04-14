import { RequestHandler, HandlerContext } from './RequestHandler';

interface UnsubscribePayload {
    subscriptionId: string;
}

export class UnsubscribeHandler implements RequestHandler {
    public readonly requestType = 'unsubscribe';

    public async handle(payload: UnsubscribePayload, context: HandlerContext): Promise<{ success: boolean }> {
        const { subscriptionId } = payload;

        if (!subscriptionId || typeof subscriptionId !== 'string') {
            console.error('[UnsubscribeHandler] Invalid payload:', payload);
            throw new Error('Invalid payload for unsubscribe request.');
        }

        console.log(`[UnsubscribeHandler] Handling unsubscribe request for ID: ${subscriptionId}`);

        try {
            // Delegate to AiService (or a dedicated SubscriptionManager)
            await context.aiService.removeSubscription(subscriptionId);
            console.log(`[UnsubscribeHandler] Unsubscription successful for ID: ${subscriptionId}`);
            return { success: true };
        } catch (error: any) {
            console.error(`[UnsubscribeHandler] Error removing subscription for ID: ${subscriptionId}:`, error);
            throw new Error(`Failed to unsubscribe: ${error.message}`);
        }
    }
}