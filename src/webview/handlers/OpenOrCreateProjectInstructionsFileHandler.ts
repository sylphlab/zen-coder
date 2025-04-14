import * as vscode from 'vscode';
import { RequestHandler, HandlerContext } from './RequestHandler'; // Change to RequestHandler

export class OpenOrCreateProjectInstructionsFileHandler implements RequestHandler {
    public readonly requestType = 'openOrCreateProjectInstructionsFile'; // Change messageType to requestType

    // Return a simple success object or throw an error
    public async handle(payload: any, context: HandlerContext): Promise<{ success: boolean }> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            const errorMsg = "Please open a project folder to manage project-specific instructions.";
            vscode.window.showWarningMessage(errorMsg);
            throw new Error(errorMsg); // Throw error
        }

        const projectRootUri = workspaceFolders[0].uri;
        const zenFolderUri = vscode.Uri.joinPath(projectRootUri, '.zen');
        const projectInstructionUri = vscode.Uri.joinPath(zenFolderUri, 'custom_instructions.md');
        const defaultContent = `# Project-Specific Custom Instructions\n\nProvide instructions here that are specific to this project.\nThey will be appended after any global instructions.\nUse Markdown format.\n`;

        try {
            // Ensure .zen directory exists
            try {
                await vscode.workspace.fs.stat(zenFolderUri);
            } catch (error) {
                console.log(`[OpenOrCreateProjectInstructionsFileHandler] .zen directory not found, creating: ${zenFolderUri.fsPath}`);
                await vscode.workspace.fs.createDirectory(zenFolderUri);
            }

            // Check if file exists, create if not
            try {
                await vscode.workspace.fs.stat(projectInstructionUri);
                console.log(`[OpenOrCreateProjectInstructionsFileHandler] Found project instructions file: ${projectInstructionUri.fsPath}`);
            } catch (error) {
                console.log(`[OpenOrCreateProjectInstructionsFileHandler] Project instructions file not found, creating: ${projectInstructionUri.fsPath}`);
                const writeData = Buffer.from(defaultContent, 'utf8');
                await vscode.workspace.fs.writeFile(projectInstructionUri, writeData);
                console.log(`[OpenOrCreateProjectInstructionsFileHandler] Successfully created project instructions file.`);
            }

            // Open the file in the editor
            const document = await vscode.workspace.openTextDocument(projectInstructionUri);
            await vscode.window.showTextDocument(document);
            console.log(`[OpenOrCreateProjectInstructionsFileHandler] Opened project instructions file: ${projectInstructionUri.fsPath}`);
            return { success: true }; // Return success

        } catch (error: any) {
            console.error(`[OpenOrCreateProjectInstructionsFileHandler] Error opening or creating project instructions file ${projectInstructionUri.fsPath}:`, error);
            vscode.window.showErrorMessage(`Failed to open or create project custom instructions file: ${error.message}`);
            throw new Error(`Failed to open or create project custom instructions file: ${error.message}`); // Throw error
        }
    }
}