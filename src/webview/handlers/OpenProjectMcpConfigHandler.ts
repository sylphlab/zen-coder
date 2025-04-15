import * as vscode from 'vscode';
import { getProjectMcpConfigUri } from '../../ai/mcpConfigUtils';
import { RequestHandler, HandlerContext } from './RequestHandler';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { mkdir } from 'fs/promises';

/**
 * Handles the 'openProjectMcpConfig' request from the webview.
 * Opens the project-specific MCP server configuration file in the editor.
 * Creates the directory if it doesn't exist. Errors if no workspace is open.
 */
export class OpenProjectMcpConfigHandler implements RequestHandler {
    public readonly requestType = 'openProjectMcpConfig';

    public async handle(payload: any, context: HandlerContext): Promise<void> {
        console.log('[Handler] Handling openProjectMcpConfig request...');
        const fileUri = getProjectMcpConfigUri(); // No context needed here

        if (!fileUri) {
            const errorMsg = 'No workspace folder found. Cannot open project MCP config.';
            console.error(`[Handler] ${errorMsg}`);
            vscode.window.showErrorMessage(errorMsg);
            throw new Error(errorMsg);
        }

        const filePath = fileUri.fsPath;
        console.log(`[Handler] Project MCP config path: ${filePath}`);

        try {
            const dirPath = dirname(filePath);
            if (!existsSync(dirPath)) {
                console.log(`[Handler] Directory does not exist, creating: ${dirPath}`);
                await mkdir(dirPath, { recursive: true });
            }
            // Let vscode handle creating the file on open if needed.

            await vscode.commands.executeCommand('vscode.open', fileUri, { preview: false });
            console.log(`[Handler] Opened project MCP config file: ${filePath}`);
        } catch (error: any) {
            console.error(`[Handler] Error opening project MCP config file ${filePath}:`, error);
            vscode.window.showErrorMessage(`Failed to open project MCP config file: ${error.message}`);
            throw error;
        }
    }
}
