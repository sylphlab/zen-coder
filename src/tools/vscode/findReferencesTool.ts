import * as vscode from 'vscode';
import { tool } from 'ai';
import { z } from 'zod';

export const findReferencesTool = tool({
    description: 'Finds all references to the symbol at the current cursor position in the active editor and displays them in the references view. Fails if no symbol is selected or no editor is active.',
    parameters: z.object({}), // No parameters needed
    execute: async () => {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                throw new Error('No active text editor found.');
            }

            // Get the position of the cursor
            const position = activeEditor.selection.active;

            // Execute the find references command.
            // This command typically opens the references view panel.
            // It doesn't directly return the references in a programmatically accessible way easily.
            // We assume success if the command executes without error.
            await vscode.commands.executeCommand('editor.action.findReferences', activeEditor.document.uri, position);

            // Since the command opens a view, we can't easily verify if references were found.
            // We'll assume success if the command didn't throw an error.
            return { success: true, message: 'Find references command executed. Check the references view panel.' };

        } catch (error: any) {
            console.error('Error executing findReferencesTool:', error);
            return { success: false, message: `Failed to find references: ${error.message}` };
        }
    },
});