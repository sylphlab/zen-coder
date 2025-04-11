import { z } from 'zod';
import { tool, StreamData } from 'ai'; // Import StreamData
import * as vscode from 'vscode';
import * as path from 'path'; // Import path for cwd resolution

export const runCommandTool = tool({
  description: 'Executes a shell command in a new integrated terminal after user confirmation. Does not return command output, only confirmation of execution.',
  parameters: z.object({
      command: z.string().describe('The shell command to execute.'),
      cwd: z.string().optional().describe('Optional workspace-relative path to run the command in. Defaults to workspace root.'),
      env: z.record(z.string()).optional().describe('Optional environment variables to set for the command execution (key-value pairs).'),
  }),
  // Modify execute signature
  execute: async ({ command, cwd: relativeCwd, env }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'runCommandTool', status: 'processing', message: `Requesting confirmation to run: ${command}` });
    }
    // --- User Confirmation ---
    const confirmation = await vscode.window.showWarningMessage(
      `Allow AI to run the following command in a new terminal?\n\n${command}`,
      { modal: true }, // Modal ensures user interaction before proceeding
      'Allow'
    );

    if (confirmation !== 'Allow') {
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'runCommandTool', status: 'cancelled', message: 'User cancelled command execution.' });
      }
      return { success: false, error: 'Command execution cancelled by user.' };
    }

    try {
      // --- Resolve Working Directory ---
      let workingDirectoryUri: vscode.Uri | undefined;
      if (relativeCwd && vscode.workspace.workspaceFolders) {
          const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
          const absoluteWdPath = path.resolve(workspaceUri.fsPath, relativeCwd);
          if (absoluteWdPath.startsWith(workspaceUri.fsPath)) {
              workingDirectoryUri = vscode.Uri.joinPath(workspaceUri, relativeCwd);
              if (data && toolCallId) {
                  data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'runCommandTool', status: 'processing', message: `Using working directory: ${relativeCwd}` });
              }
          } else {
              throw new Error(`Working directory '${relativeCwd}' is outside the workspace.`);
          }
      } else if (relativeCwd) {
           throw new Error('Cannot resolve relative working directory without an open workspace.');
      }

      // --- Create Terminal Options ---
      const terminalOptions: vscode.TerminalOptions = {
          name: `ZenCoder: ${command.substring(0, 30)}...`,
          cwd: workingDirectoryUri,
          env: env, // Pass environment variables
      };
      const terminal = vscode.window.createTerminal(terminalOptions);
      terminal.show(); // Bring the terminal into view
      terminal.sendText(command); // Send the command for execution

      // Note: We don't easily capture the output here.
      // The tool's purpose is to *initiate* the command execution.
      // Send success status
      const successMessage = `Command "${command}" sent to terminal ${terminal.name} for execution.`;
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'runCommandTool', status: 'complete', message: successMessage });
      }
      return { success: true, message: successMessage, terminalName: terminal.name };

    } catch (error: any) {
      let errorMessage = `Failed to run command "${command}".`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`runCommandTool Error: ${error}`);
      // Send error status via stream if possible
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'runCommandTool', status: 'error', message: errorMessage });
      }
      return { success: false, error: errorMessage };
    }
  },
});