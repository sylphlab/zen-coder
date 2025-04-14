import { MessageHandler, HandlerContext } from './MessageHandler';
import { AiService } from '../../ai/aiService';

/**
 * Handles messages from the webview requesting to subscribe to custom instructions updates.
 */
export class SubscribeToCustomInstructionsHandler implements MessageHandler {
    public readonly messageType = 'subscribeToCustomInstructions';

    constructor(private aiService: AiService) {}

    public async handle(payload: any, context: HandlerContext): Promise<void> {
        console.log('[SubscribeToCustomInstructionsHandler] Received subscription request.');
        // Use the context provided by the registration pattern, or the injected one if that's the pattern
        const service = context?.aiService || this.aiService;
        if (service) {
            service.setCustomInstructionsSubscription(true);
            console.log('[SubscribeToCustomInstructionsHandler] Custom instructions subscription enabled.');
            // Optionally send the current instructions immediately upon subscription
            try {
                const currentInstructions = await service.getCombinedCustomInstructions();
                // Assuming a postMessage function is available in the context or globally
                if (context && typeof context.postMessage === 'function') {
                     context.postMessage({ type: 'updateCustomInstructions', payload: currentInstructions });
                } else {
                     console.warn('[SubscribeToCustomInstructionsHandler] Could not send initial instructions state: postMessage function not found in context.');
                }
            } catch (error) {
                console.error('[SubscribeToCustomInstructionsHandler] Error sending initial custom instructions state:', error);
            }
        } else {
            console.error('[SubscribeToCustomInstructionsHandler] AiService instance not available.');
        }
    }
}