import { RequestHandler, HandlerContext } from './RequestHandler';

// Simplified Payload: Only topic is needed
interface UnsubscribePayload {
    topic: string;
    // subscriptionId is no longer sent/needed
}

export class UnsubscribeHandler implements RequestHandler {
    public readonly requestType = 'unsubscribe';

    public async handle(payload: UnsubscribePayload, context: HandlerContext): Promise<{ success: boolean }> {
        const { topic } = payload; // Destructure only topic

        // Validate only topic
        if (!topic || typeof topic !== 'string') {
            console.error('[UnsubscribeHandler] Invalid payload:', payload);
            throw new Error('Invalid payload for unsubscribe request (missing or invalid topic).');
        }

        console.log(`[UnsubscribeHandler] Handling unsubscribe request for topic: ${topic}`); // Updated log

        try {
            // Call simplified AiService method
            await context.aiService.removeSubscription(topic); // Pass only topic
            console.log(`[UnsubscribeHandler] Unsubscription successful for topic: ${topic}`); // Updated log
            return { success: true };
        } catch (error: any) {
            console.error(`[UnsubscribeHandler] Error removing subscription for topic: ${topic}:`, error); // Updated log
            throw new Error(`Failed to unsubscribe: ${error.message}`);
        }
    }
}
