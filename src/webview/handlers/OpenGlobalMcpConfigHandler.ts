import * as vscode from 'vscode';
import { getGlobalMcpConfigUri } from '../../ai/mcpConfigUtils'; // Correct function name
import { RequestHandler, HandlerContext } from './RequestHandler'; // Import HandlerContext
import { existsSync } from 'fs';
import { dirname } from 'path';
import { mkdir } from 'fs/promises';

/**
 * Handles the 'openGlobalMcpConfig' request from the webview.
 * Opens the global MCP server configuration file in the editor.
 * Creates the directory if it doesn't exist.
 */
export class OpenGlobalMcpConfigHandler implements RequestHandler { // Remove generic types
    public readonly requestType = 'openGlobalMcpConfig';

    // The handle method signature comes from the RequestHandler interface definition
    public async handle(payload: any, context: HandlerContext): Promise<void> {
        // We expect no payload for this handler
        console.log('[Handler] Handling openGlobalMcpConfig request...');
        const fileUri = getGlobalMcpConfigUri(context.extensionContext); // Use correct function and get context from HandlerContext
        const filePath = fileUri.fsPath;
        console.log(`[Handler] Global MCP config path: ${filePath}`);

        try {
            const dirPath = dirname(filePath); // Use filePath for dirname
            if (!existsSync(dirPath)) {
                console.log(`[Handler] Directory does not exist, creating: ${dirPath}`);
                await mkdir(dirPath, { recursive: true });
            }
            // Let vscode handle creating the file on open if needed.

            await vscode.commands.executeCommand('vscode.open', fileUri, { preview: false }); // Use fileUri directly
            console.log(`[Handler] Opened global MCP config file: ${filePath}`);
        } catch (error: any) {
            console.error(`[Handler] Error opening global MCP config file ${filePath}:`, error);
            vscode.window.showErrorMessage(`Failed to open global MCP config file: ${error.message}`);
            // Re-throw or handle as appropriate for the request/response model
            throw error;
        }
    }
}
