import { RequestHandler, HandlerContext } from './RequestHandler';

// Simplified Payload: Only topic is needed
interface SubscribePayload {
    topic: string;
    // subscriptionId is no longer sent/needed
}

export class SubscribeHandler implements RequestHandler {
    public readonly requestType = 'subscribe';

    public async handle(payload: SubscribePayload, context: HandlerContext): Promise<{ success: boolean }> {
        const { topic } = payload; // Destructure only topic

        // Validate only topic
        if (!topic || typeof topic !== 'string') {
            console.error('[SubscribeHandler] Invalid payload:', payload);
            throw new Error('Invalid payload for subscribe request (missing or invalid topic).');
        }

        console.log(`[SubscribeHandler] Handling subscription request for topic: ${topic}`); // Removed ID log

        try {
            // Call simplified AiService method
            await context.aiService.addSubscription(topic); // Pass only topic
            console.log(`[SubscribeHandler] Subscription successful for topic: ${topic}`); // Removed ID log
            return { success: true };
        } catch (error: any) {
            console.error(`[SubscribeHandler] Error adding subscription for topic: ${topic}:`, error); // Removed ID log
            throw new Error(`Failed to subscribe to topic ${topic}: ${error.message}`);
        }
    }
}
