import { RequestHandler, HandlerContext } from './RequestHandler';
import { DefaultChatConfig } from '../../common/types';

// Define the expected response structure/type
export type GetDefaultConfigResponse = DefaultChatConfig | null;

// Payload is likely empty for getting the default config
export interface GetDefaultConfigPayload {}

export class GetDefaultConfigHandler implements RequestHandler<GetDefaultConfigPayload, GetDefaultConfigResponse> {
    public readonly requestType = 'getDefaultConfig';
    public static readonly requestType = 'getDefaultConfig';

    public async handle(_payload: GetDefaultConfigPayload, context: HandlerContext): Promise<GetDefaultConfigResponse> {
        console.log(`[GetDefaultConfigHandler] Handling ${this.requestType} request...`);
        try {
            // Assuming HistoryManager has the method to get defaults
            const config = context.historyManager.getDefaultConfig();
            // Return the config, which might be null or partially undefined based on settings
            return config ?? null;
        } catch (error: any) {
            console.error(`[GetDefaultConfigHandler] Error fetching default config:`, error);
            throw new Error(`Failed to get default config: ${error.message}`);
        }
    }
}
