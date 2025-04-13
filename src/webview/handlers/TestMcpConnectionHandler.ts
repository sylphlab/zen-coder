import { MessageHandler, HandlerContext } from './MessageHandler';
import { McpServerTestResult } from '../../ai/aiService'; // Import the result type

/**
 * Handles the 'testMcpConnection' message from the webview.
 * Triggers a connection test for a specific MCP server using AiService
 * and sends the result back to the webview.
 */
export class TestMcpConnectionHandler implements MessageHandler {
    public messageType = 'testMcpConnection';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        const serverName = message.payload?.serverName;
        if (typeof serverName !== 'string' || !serverName) {
            console.error(`[Handler] Invalid or missing serverName in ${this.messageType} message payload:`, message.payload);
            context.postMessage({
                type: 'error',
                payload: 'Invalid request: Missing server name for connection test.'
            });
            return;
        }

        console.log(`[Handler] Handling ${this.messageType} for server: ${serverName}`);
        try {
            // Directly call the method on the aiService instance provided in the context
            // const testResult: McpServerTestResult = await context.aiService.testMcpServerConnection(serverName); // Method removed
            console.log(`[Handler] Test connection logic for ${serverName} is disabled as it's redundant.`);

            // Send a placeholder result back to the webview, indicating the test is no longer performed
            context.postMessage({
                type: 'updateMcpTestResult', // Message type for the webview to listen for
                payload: {
                    serverName: serverName,
                    result: {
                        success: false, // Indicate test didn't run successfully in the old sense
                        error: "Test function removed. Connection status shown directly.",
                        toolCount: 0,
                        durationMs: 0
                    } satisfies McpServerTestResult // Ensure structure matches
                }
            });
        } catch (error) {
            console.error(`[Handler] Error handling ${this.messageType} for ${serverName}:`, error);
            // Send error back to the webview, associated with the server name
            context.postMessage({
                type: 'updateMcpTestResult',
                payload: {
                    serverName: serverName,
                    result: {
                        success: false,
                        error: `Failed to run test: ${error instanceof Error ? error.message : 'Unknown error'}`
                    }
                }
            });
        }
    }
}