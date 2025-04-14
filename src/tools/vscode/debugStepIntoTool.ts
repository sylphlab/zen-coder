import * as vscode from 'vscode';
import { tool } from 'ai';
import { z } from 'zod';

export const debugStepIntoTool = tool({
    description: 'Performs a "Step Into" action in the currently active debugging session. Fails if no debugging session is active or if the session is not paused.',
    parameters: z.object({}), // No parameters needed
    execute: async () => {
        try {
            const activeSession = vscode.debug.activeDebugSession;
            if (!activeSession) {
                throw new Error('No active debugging session found.');
            }
            // Note: We cannot easily check if the session is paused programmatically in a stable way.
            // We rely on the command itself to handle the state or potentially throw an error.
            await vscode.commands.executeCommand('workbench.action.debug.stepInto');
            return { success: true, message: 'Executed debug step into command.' };
        } catch (error: any) {
            console.error('Error executing debugStepIntoTool:', error);
            // Provide a more specific message if possible
            let message = `Failed to execute debug step into: ${error.message}`;
            if (error.message.includes('command \'workbench.action.debug.stepInto\' not found')) {
                 message = 'Failed to execute debug step into: Command not available.';
            } else if (error.message.includes('not in debug mode')) { // Heuristic check
                 message = 'Failed to execute debug step into: No active debug session or session not paused.';
            }
            return { success: false, message: message };
        }
    },
});