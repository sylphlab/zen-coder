import * as vscode from 'vscode';
import { MessageHandler, HandlerContext } from './MessageHandler';

export class SetProjectCustomInstructionsHandler implements MessageHandler {
    public readonly messageType = 'setProjectCustomInstructions';

    public async handle(message: any, context: HandlerContext): Promise<void> {
        const instructions = message.payload?.instructions;
        if (typeof instructions !== 'string') {
            console.error('[SetProjectCustomInstructionsHandler] Invalid payload. Expected instructions string.');
            vscode.window.showErrorMessage('Failed to save project instructions: Invalid data received.');
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showWarningMessage("Please open a project folder to save project-specific instructions.");
            return;
        }

        const projectRootUri = workspaceFolders[0].uri;
        const zenFolderUri = vscode.Uri.joinPath(projectRootUri, '.zen');
        const projectInstructionUri = vscode.Uri.joinPath(zenFolderUri, 'custom_instructions.md');

        try {
            // Ensure .zen directory exists
            try {
                await vscode.workspace.fs.stat(zenFolderUri);
            } catch (error) {
                console.log(`[SetProjectCustomInstructionsHandler] .zen directory not found, creating: ${zenFolderUri.fsPath}`);
                await vscode.workspace.fs.createDirectory(zenFolderUri);
            }

            // Write the file
            const writeData = Buffer.from(instructions, 'utf8');
            await vscode.workspace.fs.writeFile(projectInstructionUri, writeData);
            console.log(`[SetProjectCustomInstructionsHandler] Project custom instructions saved to: ${projectInstructionUri.fsPath}`);
            vscode.window.showInformationMessage('Project custom instructions saved.'); // Provide feedback

            // Optionally, inform the webview that the save was successful and maybe re-send the path
            context.postMessage({
                type: 'updateCustomInstructions', // Re-use update message
                payload: {
                    project: instructions, // Send back the saved content
                    projectPath: projectInstructionUri.fsPath // Confirm the path
                    // Note: We don't re-send global instructions here, webview keeps its state
                }
            });

        } catch (error: any) {
            console.error(`[SetProjectCustomInstructionsHandler] Error writing project custom instructions file ${projectInstructionUri.fsPath}:`, error);
            vscode.window.showErrorMessage(`Failed to save project custom instructions: ${error.message}`);
        }
    }
}