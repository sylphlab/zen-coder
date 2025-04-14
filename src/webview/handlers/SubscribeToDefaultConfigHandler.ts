import { MessageHandler } from './MessageHandler';
import { AiService } from '../../ai/aiService';

/**
 * Handles messages from the webview requesting to subscribe to default config updates.
 */
export class SubscribeToDefaultConfigHandler implements MessageHandler {
    public readonly messageType = 'subscribeToDefaultConfig';

    constructor(private aiService: AiService) {}

    public async handle(payload: any, context: { aiService: AiService }): Promise<void> {
        console.log('[SubscribeToDefaultConfigHandler] Received subscription request.');
        // Use the context provided by the registration pattern, or the injected one if that's the pattern
        const service = context?.aiService || this.aiService;
        if (service) {
            service.setDefaultConfigSubscription(true);
            console.log('[SubscribeToDefaultConfigHandler] Default config subscription enabled.');
            // Optionally send the current config immediately upon subscription
            try {
                const currentConfig = await service.getDefaultConfig();
                // Assuming a postMessage function is available in the context or globally
                // This might need adjustment based on the actual message sending mechanism
                if (context && typeof (context as any).postMessage === 'function') {
                     (context as any).postMessage({ type: 'updateDefaultConfig', payload: currentConfig });
                } else {
                     console.warn('[SubscribeToDefaultConfigHandler] Could not send initial config state: postMessage function not found in context.');
                }
            } catch (error) {
                console.error('[SubscribeToDefaultConfigHandler] Error sending initial default config state:', error);
            }
        } else {
            console.error('[SubscribeToDefaultConfigHandler] AiService instance not available.');
        }
    }
}