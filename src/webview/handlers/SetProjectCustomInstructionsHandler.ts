import * as vscode from 'vscode';
import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler

export class SetProjectCustomInstructionsHandler implements RequestHandler {
    public readonly requestType = 'setProjectCustomInstructions'; // Change messageType to requestType

    // Return a simple success object or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> {
        const instructions = payload?.instructions;
        if (typeof instructions !== 'string') {
            console.error('[SetProjectCustomInstructionsHandler] Invalid payload. Expected instructions string.');
            throw new Error('Invalid payload for setProjectCustomInstructions request.'); // Throw error
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showWarningMessage("Please open a project folder to save project-specific instructions.");
            throw new Error("Please open a project folder to save project-specific instructions."); // Throw error
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

            // Removed direct postMessage update. Pub/Sub handles this.

            // Trigger notification via AiService method
            context.aiService.triggerCustomInstructionsNotification(); // Use public trigger method
            return { success: true }; // Return success

        } catch (error: any) {
            console.error(`[SetProjectCustomInstructionsHandler] Error writing project custom instructions file ${projectInstructionUri.fsPath}:`, error);
            vscode.window.showErrorMessage(`Failed to save project custom instructions: ${error.message}`);
            throw new Error(`Failed to save project custom instructions: ${error.message}`); // Throw error
        }
    }
}
