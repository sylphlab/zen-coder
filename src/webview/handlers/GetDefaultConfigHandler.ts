import { RequestHandler, HandlerContext } from './RequestHandler';
import { DefaultChatConfig } from '../../common/types';

export class GetDefaultConfigHandler implements RequestHandler {
    public readonly requestType = 'getDefaultConfig';

    public async handle(payload: any, context: HandlerContext): Promise<DefaultChatConfig> {
        console.log(`[GetDefaultConfigHandler] Handling ${this.requestType} request...`);
        try {
            // Assuming AiService or HistoryManager has the method to get defaults
            // Let's use HistoryManager as it was used before
            const config = context.historyManager.getDefaultConfig();
            return config;
        } catch (error: any) {
            console.error(`[GetDefaultConfigHandler] Error fetching default config:`, error);
            throw new Error(`Failed to get default config: ${error.message}`);
        }
    }
}