import * as vscode from 'vscode';
import { MessageHandler, HandlerContext } from './MessageHandler';

export class GetCustomInstructionsHandler implements MessageHandler {
    public readonly messageType = 'settingsPageReady'; // Re-use settingsPageReady to send initial data

    public async handle(message: any, context: HandlerContext): Promise<void> {
        console.log('[GetCustomInstructionsHandler] Handling settingsPageReady, fetching instructions...');
        let globalInstructions = '';
        let projectInstructions = '';
        let projectPath: string | null = null;

        // 1. Get Global Instructions
        try {
            globalInstructions = vscode.workspace.getConfiguration('zencoder.customInstructions').get<string>('global', '');
        } catch (error) {
            console.error('[GetCustomInstructionsHandler] Error reading global instructions setting:', error);
        }

        // 2. Get Project Instructions
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const projectInstructionUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.zen', 'custom_instructions.md');
            projectPath = projectInstructionUri.fsPath; // Store path to display
            try {
                const fileContent = await vscode.workspace.fs.readFile(projectInstructionUri);
                projectInstructions = Buffer.from(fileContent).toString('utf8');
            } catch (error: any) {
                if (error.code !== 'FileNotFound') {
                    console.error(`[GetCustomInstructionsHandler] Error reading project instructions file ${projectPath}:`, error);
                    // Don't show error to user, just won't populate the field
                }
            }
        }

        // Send combined data back to the webview
        context.postMessage({
            type: 'updateCustomInstructions',
            payload: {
                global: globalInstructions,
                project: projectInstructions,
                projectPath: projectPath // Send the path too
            }
        });
        console.log('[GetCustomInstructionsHandler] Sent custom instructions to webview.');

        // --- Also trigger fetching tool status ---
        // This handler re-uses 'settingsPageReady', so we need to trigger the tool status fetch here as well.
        // Ideally, 'settingsPageReady' might be split or handled differently, but this works for now.
        try {
            // Directly call the method on AiService
            const allToolsStatus = await context.aiService.getAllToolsWithStatus();
            context.postMessage({ type: 'updateAllToolsStatus', payload: allToolsStatus });
            console.log("[GetCustomInstructionsHandler] Sent all tools status to webview:", Object.keys(allToolsStatus).length, "tools");
        } catch (error) {
            console.error("[GetCustomInstructionsHandler] Error getting or sending all tools status:", error);
            vscode.window.showErrorMessage("Failed to load tool information.");
        }
    }

}
// Removed outdated helper function and its imports