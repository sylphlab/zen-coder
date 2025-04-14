import { MessageHandler } from './MessageHandler';
import { AiService } from '../../ai/aiService';

/**
 * Handles messages from the webview requesting to unsubscribe from default config updates.
 */
export class UnsubscribeFromDefaultConfigHandler implements MessageHandler {
    public readonly messageType = 'unsubscribeFromDefaultConfig';

    constructor(private aiService: AiService) {}

    public async handle(payload: any, context: { aiService: AiService }): Promise<void> {
        console.log('[UnsubscribeFromDefaultConfigHandler] Received unsubscription request.');
        // Use the context provided by the registration pattern, or the injected one if that's the pattern
        const service = context?.aiService || this.aiService;
        if (service) {
            service.setDefaultConfigSubscription(false);
            console.log('[UnsubscribeFromDefaultConfigHandler] Default config subscription disabled.');
        } else {
            console.error('[UnsubscribeFromDefaultConfigHandler] AiService instance not available.');
        }
    }
}