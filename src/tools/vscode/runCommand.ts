import { z } from 'zod';
import { tool } from 'ai'; // Removed StreamData import, restored original imports
import * as vscode from 'vscode';
import * as path from 'path'; // Import path for cwd resolution

// Define the type for the standard tool execution options provided by the SDK
import type { ToolExecutionOptions } from 'ai';

export const runCommandTool = tool({
  description: 'Executes a shell command in a new integrated terminal after user confirmation. Does not return command output, only confirmation of execution.', // Reverted description
  parameters: z.object({
      command: z.string().describe('The shell command to execute.'),
      cwd: z.string().optional().describe('Optional workspace-relative path to run the command in. Defaults to workspace root.'),
      env: z.record(z.string()).optional().describe('Optional environment variables to set for the command execution (key-value pairs).'),
  }),
  // Reverted execute signature to standard ToolExecutionOptions
  execute: async ({ command, cwd: relativeCwd, env }, options: ToolExecutionOptions) => {
    const toolCallId = options?.toolCallId; // Get toolCallId from options
    // --- User Confirmation ---
    // No initial status message here as StreamData is removed
    // --- User Confirmation ---
    const confirmation = await vscode.window.showWarningMessage(
      `Allow AI to run the following command in a new terminal?\n\n${command}`, // Restored original message
      { modal: true }, // Modal ensures user interaction before proceeding
      'Allow'
    );

    if (confirmation !== 'Allow') {
        // No cancelled status message here
        return { success: false, error: 'Command execution cancelled by user.' };
    }

    try {
      // --- Resolve Working Directory ---
      // --- Resolve Working Directory ---
      let workingDirectoryUri: vscode.Uri | undefined;
      if (relativeCwd && vscode.workspace.workspaceFolders) {
          const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
          const absoluteWdPath = path.resolve(workspaceUri.fsPath, relativeCwd);
          if (absoluteWdPath.startsWith(workspaceUri.fsPath)) {
              workingDirectoryUri = vscode.Uri.joinPath(workspaceUri, relativeCwd);
              // No status message here
          } else {
              throw new Error(`Working directory '${relativeCwd}' is outside the workspace.`);
          }
      } else if (relativeCwd) {
           throw new Error('Cannot resolve relative working directory without an open workspace.');
      }
      // If no relativeCwd or no workspace, workingDirectoryUri remains undefined,
      // and createTerminal will use VS Code's default behavior.

      // --- Create Terminal Options ---
      const terminalOptions: vscode.TerminalOptions = {
          name: `ZenCoder: ${command.substring(0, 30)}...`,
          cwd: workingDirectoryUri, // Use the resolved URI
          env: env, // Pass environment variables
      };
      const terminal = vscode.window.createTerminal(terminalOptions);
      terminal.show(); // Bring the terminal into view
      terminal.sendText(command); // Send the command for execution

      // Note: We don't easily capture the output here.
      // The tool's purpose is to *initiate* the command execution.
      // No status messages here as StreamData is removed
      const successMessage = `Command "${command}" sent to terminal ${terminal.name} for execution.`;
      return { success: true, message: successMessage, terminalName: terminal.name };

    } catch (error: any) {
      let errorMessage = `Failed to run command "${command}".`;
      if (error instanceof Error) { // Check if it's an Error object
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`runCommandTool Error: ${error}`);
      // No error status message here
      return { success: false, error: errorMessage };
    }
  },
});