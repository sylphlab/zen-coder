import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler
import { McpConfiguredStatusPayload } from '../../common/types'; // Import return type

export class GetMcpStatusHandler implements RequestHandler {
    public readonly requestType = 'getMcpStatus'; // Change messageType to requestType

    // Return the MCP status payload or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<McpConfiguredStatusPayload> {
        console.log(`[${this.requestType}] Handling request...`);
        try {
            // Use McpManager to get the configured status
            const mcpStatus = context.mcpManager.getMcpServerConfiguredStatus();

            console.log(`[${this.requestType}] Returning status for ${Object.keys(mcpStatus).length} MCP servers.`);
            // Return the payload directly for requestData
            return mcpStatus;
        } catch (error: any) {
            console.error(`[${this.requestType}] Error fetching MCP status:`, error);
            // Throw error to reject the requestData promise
            throw new Error(`Failed to fetch MCP status: ${error.message}`);
        }
    }
}