import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler
import { ProviderInfoAndStatus } from '../../common/types'; // Import return type

export class GetProviderStatusHandler implements RequestHandler {
    public readonly requestType = 'getProviderStatus'; // Change messageType to requestType

    // Return the status list or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<ProviderInfoAndStatus[]> {
        console.log(`[${this.requestType}] Handling request...`);
        try {
            // Use ProviderStatusManager
            const statusList = await context.providerStatusManager.getProviderStatus(
                context.aiService.allProviders,
                context.aiService.providerMap
            );

            console.log(`[${this.requestType}] Returning status for ${statusList.length} providers.`);
            // Return the payload directly for requestData
            return statusList;
        } catch (error: any) {
            console.error(`[${this.requestType}] Error fetching provider status:`, error);
            // Throw error to reject the requestData promise
            throw new Error(`Failed to fetch provider status: ${error.message}`);
        }
    }
}