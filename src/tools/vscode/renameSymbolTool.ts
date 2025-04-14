import * as vscode from 'vscode';
import { tool } from 'ai';
import { z } from 'zod';

export const renameSymbolTool = tool({
    description: 'Initiates the rename process for the symbol at the current cursor position in the active editor. This opens the rename input box for the user to confirm the new name. Fails if no symbol is selected or no editor is active.',
    parameters: z.object({
        // Although the command itself takes a newName parameter,
        // invoking it without one typically opens the interactive rename UI,
        // which is safer and preferred for AI interaction.
        // We don't need parameters here.
    }),
    execute: async () => {
        try {
            const activeEditor = vscode.window.activeTextEditor;
            if (!activeEditor) {
                throw new Error('No active text editor found.');
            }

            // Execute the rename command. This usually opens an input box for the user.
            await vscode.commands.executeCommand('editor.action.rename');

            // We assume the command succeeded if no error was thrown.
            // The actual rename is handled by the user via the VS Code UI.
            return { success: true, message: 'Rename process initiated. User needs to confirm the new name in the input box.' };

        } catch (error: any) {
            console.error('Error executing renameSymbolTool:', error);
            // Check for specific errors if possible, e.g., "command 'editor.action.rename' not found"
            // or errors indicating no symbol was selected.
            let message = `Failed to initiate rename: ${error.message}`;
            if (error.message.includes('cannot execute rename')) { // Heuristic check
                message = 'Failed to initiate rename: Ensure the cursor is on a valid symbol that can be renamed.';
            }
            return { success: false, message: message };
        }
    },
});