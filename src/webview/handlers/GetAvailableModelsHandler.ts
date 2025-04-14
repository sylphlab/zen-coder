import { RequestHandler, HandlerContext } from './RequestHandler';
import { ModelDefinition } from '../../ai/providers/providerInterface'; // Import ModelDefinition
import { AvailableModel } from '../../common/types'; // Import AvailableModel

/**
 * Handles requests from the frontend to fetch the actual models for a *specific* provider.
 * Fetches available models for a specific provider, utilizing caching.
 * This handler is designed for the Request/Response pattern and returns the models.
 */
export class GetAvailableModelsHandler implements RequestHandler { // Changed interface
    public readonly requestType = 'getAvailableModels'; // Changed property name

    // Note: The original 'handle' method used context.postMessage directly.
    // The RequestHandler pattern expects the handle method to *return* the payload.
    // This refactoring focuses on fixing the TS error, assuming the calling code
    // handles the returned promise correctly. A deeper refactor might be needed
    // if this handler's logic needs to change significantly for Request/Response.
    public async handle(payload: any, context: HandlerContext): Promise<AvailableModel[]> { // Changed signature and return type
        const providerId = payload?.providerId; // Use payload directly
        if (!providerId || typeof providerId !== 'string') {
            console.error("[GetAvailableModelsHandler] Invalid or missing providerId in payload:", payload);
            throw new Error("Invalid or missing providerId"); // Throw error for request failure
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
            // If cache is found, return it immediately (Request/Response pattern)
            console.log(`[GetAvailableModelsHandler] Returning ${cachedModels.length} cached models for ${providerId}.`);
            // Trigger background fetch without awaiting here
            this.fetchAndNotifyInBackground(providerId, cachedModels, context);
            return this.mapModelsToAvailableModel(modelsToSend, providerId, context);

        } else {
             console.log(`[GetAvailableModelsHandler] No cache found for ${providerId}. Fetching now (and awaiting).`);
        }

        // 2. Fetch fresh models in the background
        try {
            const freshModels = await context.modelResolver.fetchModelsForProvider(providerId);
            console.log(`[GetAvailableModelsHandler] Fetched ${freshModels.length} fresh models for ${providerId}.`);

            // If cache was not found, await the fetch and return the result
            modelsToSend = freshModels;
            source = 'fetch';
            return this.mapModelsToAvailableModel(modelsToSend, providerId, context);

        } catch (error: any) {
            console.error(`[GetAvailableModelsHandler] Error fetching models for provider ${providerId}:`, error);
            // If fetching fails (and no cache was returned), throw the error
             throw new Error(`Failed to fetch models for ${providerId}: ${error.message}`);
        }
    } // End handle method

    /**
     * Fetches models in the background and sends a push update if they changed.
     */
    private async fetchAndNotifyInBackground(providerId: string, cachedModels: ModelDefinition[], context: HandlerContext): Promise<void> {
         try {
            const freshModels = await context.modelResolver.fetchModelsForProvider(providerId);
            console.log(`[GetAvailableModelsHandler] Background fetch completed for ${providerId}.`);

            const cacheChanged = this.didModelListChange(cachedModels, freshModels);

            if (cacheChanged) {
                console.log(`[GetAvailableModelsHandler] Model list for ${providerId} changed. Pushing update.`);
                context.postMessage({ // Use postMessage for background push update
                    type: 'pushUpdate', // Standard push update type
                    topic: 'providerModelsUpdate', // Specific topic for model updates
                    payload: {
                        providerId: providerId,
                        models: this.mapModelsToAvailableModel(freshModels, providerId, context),
                        source: 'fetch'
                    }
                });
            } else {
                 console.log(`[GetAvailableModelsHandler] Background fetch: Fresh models for ${providerId} match cache. No push needed.`);
            }
        } catch (error: any) {
            console.error(`[GetAvailableModelsHandler] Background fetch error for provider ${providerId}:`, error);
            // Optionally push an error state? For now, just log.
        }
    }

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
