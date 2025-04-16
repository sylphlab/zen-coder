import { RequestHandler, HandlerContext } from './RequestHandler';
import { VertexProvider } from '../../ai/providers/vertexProvider'; // Import specific provider

// Define the expected payload structure
interface GetVertexLocationsPayload {
    projectId?: string; // Project ID is needed to list locations
}

export class GetVertexLocationsHandler implements RequestHandler<GetVertexLocationsPayload, { id: string; name: string }[]> {
    public readonly requestType = 'getVertexLocations';

    public async handle(payload: GetVertexLocationsPayload, context: HandlerContext): Promise<{ id: string; name: string }[]> {
        console.log(`[${this.requestType}] Handling request with payload:`, payload);
        const vertexProvider = context.aiService.providerManager.providerMap.get('vertex') as VertexProvider | undefined;

        if (!vertexProvider) {
            console.error(`[${this.requestType}] VertexProvider not found.`);
            throw new Error('VertexProvider not configured.');
        }

        // Extract projectId from payload
        const projectId = payload?.projectId;
        // if (!projectId) {
        //     console.warn(`[${this.requestType}] Project ID is required to fetch locations.`);
        //     // Return empty list if no project ID is provided in the payload
        //     return [];
        // }

        try {
            // Get the stored credentials string
            const credentialsString = await vertexProvider.getApiKey(context.extensionContext.secrets);
            if (!credentialsString) {
                console.warn(`[${this.requestType}] Vertex credentials not set.`);
                return []; // Return empty if no credentials
            }

            // Call the provider method, passing the projectId from the payload
            const locations = await vertexProvider.getAvailableLocations(credentialsString, projectId);
            console.log(`[${this.requestType}] Returning ${locations.length} locations for project ${projectId}.`);
            return locations;
        } catch (error: any) {
            console.error(`[${this.requestType}] Error fetching Vertex locations for project ${projectId}:`, error);
            throw new Error(`Failed to fetch Vertex locations: ${error.message}`);
        }
    }
}