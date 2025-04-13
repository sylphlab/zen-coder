import { MessageHandler, HandlerContext } from './MessageHandler';
import { ModelDefinition } from '../../ai/providers/providerInterface'; // Import ModelDefinition
import { AvailableModel } from '../../common/types'; // Import AvailableModel

/**
 * Handles requests from the frontend to fetch the actual models for a *specific* provider.
 * Sends cached models immediately if available, then fetches fresh models in the background
 * and sends an update if the list has changed.
 */
export class GetAvailableModelsHandler implements MessageHandler {
    public readonly messageType = 'getAvailableModels';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        const providerId = message.payload?.providerId;
        if (!providerId || typeof providerId !== 'string') {
            console.error("[GetAvailableModelsHandler] Invalid or missing providerId in payload:", message.payload);
            return;
        }

        console.log(`[GetAvailableModelsHandler] Handling request to fetch models for provider: ${providerId}`);

        // --- Caching Logic ---
        let modelsToSend: ModelDefinition[] = [];
        let source: 'cache' | 'fetch' | 'error' = 'cache';
        let cacheSent = false;

        // 1. Try to get cached models first
        const cachedModels = context.modelResolver.getCachedModelsForProvider(providerId);

        if (cachedModels) {
            console.log(`[GetAvailableModelsHandler] Sending ${cachedModels.length} cached models for ${providerId}.`);
            modelsToSend = cachedModels;
            source = 'cache';
            cacheSent = true;
            // Send cached models immediately
            context.postMessage({
                type: 'providerModelsLoaded',
                payload: {
                    providerId: providerId,
                    models: this.mapModelsToAvailableModel(modelsToSend, providerId, context),
                    source: source // Indicate data source
                }
            });
        } else {
             console.log(`[GetAvailableModelsHandler] No cache found for ${providerId}. Will fetch.`);
        }

        // 2. Fetch fresh models in the background
        try {
            const freshModels = await context.modelResolver.fetchModelsForProvider(providerId);
            console.log(`[GetAvailableModelsHandler] Fetched ${freshModels.length} fresh models for ${providerId}.`);

            // 3. Compare fresh models with cache
            const cacheChanged = !cachedModels || this.didModelListChange(cachedModels, freshModels);

            if (cacheChanged) {
                console.log(`[GetAvailableModelsHandler] Model list for ${providerId} changed. Sending update.`);
                modelsToSend = freshModels;
                source = 'fetch';
                // Send updated models
                context.postMessage({
                    type: 'providerModelsLoaded',
                    payload: {
                        providerId: providerId,
                        models: this.mapModelsToAvailableModel(modelsToSend, providerId, context),
                        source: source
                    }
                });
            } else {
                 console.log(`[GetAvailableModelsHandler] Fresh models for ${providerId} match cache. No update needed.`);
            }

        } catch (error: any) {
            console.error(`[GetAvailableModelsHandler] Error fetching fresh models for provider ${providerId}:`, error);
            // If cache wasn't sent initially, send an empty list now to signal completion/error
            if (!cacheSent) {
                 context.postMessage({
                    type: 'providerModelsLoaded',
                    payload: { providerId: providerId, models: [], source: 'error' }
                });
            }
        }
    } // End handle method

    // Helper to map ModelDefinition[] to AvailableModel[]
    private mapModelsToAvailableModel(models: ModelDefinition[], providerId: string, context: HandlerContext): AvailableModel[] {
        const providerName = context.aiService.providerMap.get(providerId)?.name ?? providerId;
        return models.map(m => ({
            id: `${providerId}:${m.id}`, // Standardized ID
            name: m.name,
            providerId: providerId,
            providerName: providerName
        }));
    }

    // Helper to compare model lists (simple comparison)
    private didModelListChange(cached: ModelDefinition[], fresh: ModelDefinition[]): boolean {
        if (cached.length !== fresh.length) {
            return true;
        }
        const freshIds = new Set(fresh.map(m => m.id));
        return !cached.every(cm => freshIds.has(cm.id));
    }

} // End class GetAvailableModelsHandler