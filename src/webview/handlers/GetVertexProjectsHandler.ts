import { RequestHandler, HandlerContext } from './RequestHandler';
import { VertexProvider } from '../../ai/providers/vertexProvider'; // Import specific provider

export class GetVertexProjectsHandler implements RequestHandler {
    public readonly requestType = 'getVertexProjects';

    public async handle(payload: any, context: HandlerContext): Promise<{ id: string; name: string }[]> {
        console.log(`[${this.requestType}] Handling request...`);
        const vertexProvider = context.aiService.providerManager.providerMap.get('vertex') as VertexProvider | undefined;

        if (!vertexProvider) {
            console.error(`[${this.requestType}] VertexProvider not found.`);
            throw new Error('VertexProvider not configured.');
        }

        try {
            // Get the stored credentials string using extensionContext
            const credentialsString = await vertexProvider.getApiKey(context.extensionContext.secrets);
            if (!credentialsString) {
                console.warn(`[${this.requestType}] Vertex credentials not set.`);
                // Return empty list or throw error? Let's return empty for now.
                return [];
            }

            // Call the provider method
            const projects = await vertexProvider.getAvailableProjects(credentialsString);
            console.log(`[${this.requestType}] Returning ${projects.length} projects.`);
            return projects;
        } catch (error: any) {
            console.error(`[${this.requestType}] Error fetching Vertex projects:`, error);
            throw new Error(`Failed to fetch Vertex projects: ${error.message}`);
        }
    }
}