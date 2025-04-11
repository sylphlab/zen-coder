import { z } from 'zod';
import { tool } from 'ai';
import * as vscode from 'vscode';

export const runCommandTool = tool({
  description: 'Executes a shell command in a new integrated terminal after user confirmation. Does not return command output, only confirmation of execution.',
  parameters: z.object({
      command: z.string().describe('The shell command to execute.'),
      // Optional: Add working directory parameter if needed later
      // workingDirectory: z.string().optional().describe('Optional workspace-relative path to run the command in.')
  }),
  execute: async ({ command /*, workingDirectory */ }) => {
    // CRUCIAL: User Confirmation
    const confirmation = await vscode.window.showWarningMessage(
      `Allow AI to run the following command in a new terminal?\n\n${command}`,
      { modal: true }, // Modal ensures user interaction before proceeding
      'Allow'
    );

    if (confirmation !== 'Allow') {
      return { success: false, error: 'Command execution cancelled by user.' };
    }

    try {
      // TODO: Handle workingDirectory if added later
      // let shellPath: string | undefined;
      // let cwd: vscode.Uri | undefined;
      // if (workingDirectory && vscode.workspace.workspaceFolders) {
      //     const workspaceUri = vscode.workspace.workspaceFolders[0].uri;
      //     const absoluteWdPath = path.resolve(workspaceUri.fsPath, workingDirectory);
      //     if (absoluteWdPath.startsWith(workspaceUri.fsPath)) {
      //         cwd = vscode.Uri.joinPath(workspaceUri, workingDirectory);
      //     } else {
      //         throw new Error(`Working directory '${workingDirectory}' is outside the workspace.`);
      //     }
      // }

      // Create a new terminal for the command
      const terminalOptions: vscode.TerminalOptions = {
          name: `AI Task: ${command.substring(0, 30)}...`,
          // cwd: cwd, // Add if working directory is implemented
      };
      const terminal = vscode.window.createTerminal(terminalOptions);
      terminal.show(); // Bring the terminal into view
      terminal.sendText(command); // Send the command for execution

      // Note: We don't easily capture the output here.
      // The tool's purpose is to *initiate* the command execution.
      return { success: true, message: `Command "${command}" sent to a new terminal for execution.` };

    } catch (error: any) {
      let errorMessage = `Failed to run command "${command}".`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`runCommandTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});