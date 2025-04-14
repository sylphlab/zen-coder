import * as vscode from 'vscode';
import { tool } from 'ai';
import { z } from 'zod';

export const startDebuggingTool = tool({
    description: 'Starts a debugging session using a predefined launch configuration name from .vscode/launch.json. Fails if the configuration name is not found or the workspace folder is missing.',
    parameters: z.object({
        configurationName: z.string().describe('The name of the launch configuration to start (must exist in .vscode/launch.json).'),
    }),
    execute: async ({ configurationName }) => {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                throw new Error('No workspace folder is open. Cannot start debugging.');
            }
            const workspaceFolder = workspaceFolders[0]; // Assume the first folder

            // Check if the configuration exists (optional but good practice)
            const launchConfig = vscode.workspace.getConfiguration('launch', workspaceFolder.uri);
            const configurations = launchConfig.get<vscode.DebugConfiguration[]>('configurations');
            if (!configurations || !configurations.some(conf => conf.name === configurationName)) {
                 throw new Error(`Launch configuration named "${configurationName}" not found in .vscode/launch.json.`);
            }

            // Start debugging
            const success = await vscode.debug.startDebugging(workspaceFolder, configurationName);

            if (success) {
                return { success: true, message: `Successfully started debugging session "${configurationName}".` };
            } else {
                // startDebugging returns false if it fails to start for some reason (e.g., config error, preLaunchTask failure)
                throw new Error(`Failed to start debugging session "${configurationName}". Check debug console for details.`);
            }
        } catch (error: any) {
            console.error('Error executing startDebuggingTool:', error);
            return { success: false, message: `Failed to start debugging: ${error.message}` };
        }
    },
});