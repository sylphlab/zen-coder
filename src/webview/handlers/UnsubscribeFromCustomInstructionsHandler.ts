import { MessageHandler, HandlerContext } from './MessageHandler';
import { AiService } from '../../ai/aiService';

/**
 * Handles messages from the webview requesting to unsubscribe from custom instructions updates.
 */
export class UnsubscribeFromCustomInstructionsHandler implements MessageHandler {
    public readonly messageType = 'unsubscribeFromCustomInstructions';

    constructor(private aiService: AiService) {}

    public async handle(payload: any, context: HandlerContext): Promise<void> {
        console.log('[UnsubscribeFromCustomInstructionsHandler] Received unsubscription request.');
        // Use the context provided by the registration pattern, or the injected one if that's the pattern
        const service = context?.aiService || this.aiService;
        if (service) {
            service.setCustomInstructionsSubscription(false);
            console.log('[UnsubscribeFromCustomInstructionsHandler] Custom instructions subscription disabled.');
        } else {
            console.error('[UnsubscribeFromCustomInstructionsHandler] AiService instance not available.');
        }
    }
}