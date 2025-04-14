import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler
import { AvailableModel } from '../../common/types'; // Import return type

export class GetAvailableProvidersHandler implements RequestHandler {
    public readonly requestType = 'getAvailableProviders'; // Change messageType to requestType

    // Return the list of providers or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<AvailableModel[]> {
        console.log(`[${this.requestType}] Handling request...`);
        try {
            // Use ModelResolver to get available providers
            const providers = await context.modelResolver.getAvailableProviders();

            console.log(`[${this.requestType}] Returning ${providers.length} available providers.`);
            // Return the payload directly for requestData
            return providers;
        } catch (error: any) {
            console.error(`[${this.requestType}] Error fetching available providers:`, error);
            // Throw error to reject the requestData promise
            throw new Error(`Failed to fetch available providers: ${error.message}`);
        }
    }
}