import * as vscode from 'vscode';
import { tool } from 'ai';
import { z } from 'zod';

export const goToDefinitionTool = tool({
    description: 'Navigates to the definition of the symbol at the current cursor position in the active editor. Fails if no definition is found or no editor is active.',
    parameters: z.object({}), // No parameters needed
    execute: async () => {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                throw new Error('No active text editor found.');
            }

            // Store current position to check if navigation happened
            const initialPosition = activeEditor.selection.active;

            // Execute the command
            await vscode.commands.executeCommand('editor.action.revealDefinition');

            // Add a small delay to allow VS Code to process the command and potentially change the editor/position
            await new Promise(resolve => setTimeout(resolve, 200));

            // Check if the position actually changed
            const finalEditor = vscode.window.activeTextEditor;
            if (!finalEditor || finalEditor.document.uri.toString() !== activeEditor.document.uri.toString()) {
                 // Editor changed, assume success (might have opened definition in new tab/split)
                 return { success: true, message: 'Navigated to definition (potentially in a different editor).' };
            }

            const finalPosition = finalEditor.selection.active;

            if (initialPosition.line === finalPosition.line && initialPosition.character === finalPosition.character) {
                 // Position didn't change, likely no definition found
                 return { success: false, message: 'Could not find definition or already at the definition.' };
            }

            return { success: true, message: 'Successfully navigated to definition.' };
        } catch (error: any) {
            console.error('Error executing goToDefinitionTool:', error);
            return { success: false, message: `Failed to navigate to definition: ${error.message}` };
        }
    },
});