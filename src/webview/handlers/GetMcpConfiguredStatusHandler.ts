import { RequestHandler, HandlerContext } from './RequestHandler'; // Correct import path

/**
 * Handles the 'getMcpConfiguredStatus' message from the webview.
 * Fetches the configured status (enabled/disabled) of MCP servers from AiService
 * Fetches the configured status (enabled/disabled) of MCP servers from AiService/McpManager
 * and returns it.
 */
export class GetMcpConfiguredStatusHandler implements RequestHandler { // Implement correct interface
    public readonly requestType = 'getMcpConfiguredStatus'; // Use correct property name

    public async handle(payload: any, context: HandlerContext): Promise<{ configuredStatus: any }> { // Update signature and return type
        console.log(`[Handler] Handling ${this.requestType}`); // Use correct property name
        try {
            // Directly call the method on the aiService instance provided in the context
            // Call the correct method on AiService which delegates to McpManager
            const configuredStatus = context.aiService.getMcpStatuses(); // Assuming this is still the correct method
            console.log(`[Handler] Fetched configured status for ${Object.keys(configuredStatus).length} MCP servers.`);

            // Return the status as the result
            return { configuredStatus };
        } catch (error) {
            console.error(`[Handler] Error handling ${this.requestType}:`, error); // Use correct property name
            // Rethrow the error to be handled by the request manager
            throw new Error(`Failed to get MCP server configured status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
