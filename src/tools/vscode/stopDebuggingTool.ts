import * as vscode from 'vscode';
import { tool } from 'ai';
import { z } from 'zod';

export const stopDebuggingTool = tool({
    description: 'Stops the currently active debugging session. Fails if no debugging session is active.',
    parameters: z.object({
        // Optional: sessionId - to stop a specific session if multiple are active.
        // For simplicity, we'll stop the active one or the first one if multiple are somehow active without a clear 'active' one.
        // sessionId: z.string().optional().describe('The ID of the debug session to stop. If omitted, stops the active session.'),
    }),
    execute: async (/*{ sessionId }*/) => {
        try {
            const activeSession = vscode.debug.activeDebugSession;
            if (!activeSession) {
                 return { success: false, message: 'No active debugging session found to stop.' };
            }

            // Stop the active session
            // Stop the active session if found
            await vscode.debug.stopDebugging(activeSession);
            return { success: true, message: `Stopped the active debugging session "${activeSession.name}" (ID: ${activeSession.id}).` };

        } catch (error: any) {
            console.error('Error executing stopDebuggingTool:', error);
            return { success: false, message: `Failed to stop debugging session: ${error.message}` };
        }
    },
});