import * as vscode from 'vscode';
import { tool } from 'ai';
import { z } from 'zod';

export const debugStepOverTool = tool({
    description: 'Performs a "Step Over" action in the currently active debugging session. Fails if no debugging session is active or if the session is not paused.',
    parameters: z.object({}), // No parameters needed
    execute: async () => {
        try {
            const activeSession = vscode.debug.activeDebugSession;
            if (!activeSession) {
                throw new Error('No active debugging session found.');
            }
            // Note: We cannot easily check if the session is paused programmatically in a stable way.
            // We rely on the command itself to handle the state or potentially throw an error.
            await vscode.commands.executeCommand('workbench.action.debug.stepOver');
            return { success: true, message: 'Executed debug step over command.' };
        } catch (error: any) {
            console.error('Error executing debugStepOverTool:', error);
            // Provide a more specific message if possible
            let message = `Failed to execute debug step over: ${error.message}`;
            if (error.message.includes('command \'workbench.action.debug.stepOver\' not found')) {
                 message = 'Failed to execute debug step over: Command not available.';
            } else if (error.message.includes('not in debug mode')) { // Heuristic check
                 message = 'Failed to execute debug step over: No active debug session or session not paused.';
            }
            return { success: false, message: message };
        }
    },
});