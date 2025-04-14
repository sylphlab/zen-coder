import { RequestHandler, HandlerContext } from './RequestHandler';
import { AvailableModel } from '../../common/types';

interface GetModelsPayload {
    providerId?: string;
}

export class GetModelsForProviderHandler implements RequestHandler {
    public readonly requestType = 'getModelsForProvider';

    public async handle(payload: GetModelsPayload, context: HandlerContext): Promise<AvailableModel[]> {
        const providerId = payload?.providerId;
        if (!providerId || typeof providerId !== 'string') {
            console.error('[GetModelsForProviderHandler] Invalid or missing providerId in payload:', payload);
            throw new Error('Invalid payload for getModelsForProvider request.');
        }

        console.log(`[GetModelsForProviderHandler] Handling ${this.requestType} for provider: ${providerId}`);
        try {
            // Delegate to ModelResolver
            const models = await context.modelResolver.fetchModelsForProvider(providerId);
            return models;
        } catch (error: any) {
            console.error(`[GetModelsForProviderHandler] Error fetching models for provider ${providerId}:`, error);
            throw new Error(`Failed to get models for provider ${providerId}: ${error.message}`);
        }
    }
}