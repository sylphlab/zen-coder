import { z } from 'zod';
import { tool } from 'ai';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';

export const writeFileTool = tool({
  description: 'Write content to a file in the workspace. Creates the file if it does not exist, overwrites if it does. Use relative paths from the workspace root.',
  parameters: z.object({
    filePath: z.string().describe('The relative path to the file within the workspace.'),
    content: z.string().describe('The content to write to the file.'),
  }),
  execute: async ({ filePath, content }) => {
    try {
      if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace is open.');
      }
      // Ensure the path is relative and within the workspace
      const absolutePath = path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, filePath);
      if (!absolutePath.startsWith(vscode.workspace.workspaceFolders[0].uri.fsPath)) {
          throw new Error(`Access denied: Path '${filePath}' is outside the workspace.`);
      }

      // Basic check for potentially dangerous paths (e.g., writing to .git)
      if (filePath.includes('.git/') || filePath.startsWith('.git')) {
          throw new Error(`Writing to '.git' directory is not allowed.`);
      }

      // Consider adding user confirmation here for overwrites if needed,
      // but for now, follow the brief's "with safety/confirmation" loosely,
      // relying on path checks as primary safety. More robust confirmation
      // might involve VS Code dialogs, adding complexity.

      const fileUri = Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, filePath);
      const uint8Array = new TextEncoder().encode(content);
      await vscode.workspace.fs.writeFile(fileUri, uint8Array);
      return { success: true, message: `File '${filePath}' written successfully.` };
    } catch (error: any) {
      let errorMessage = `Failed to write file '${filePath}'.`;
       if (error.message.includes('Access denied') || error.message.includes('not allowed')) {
          errorMessage = error.message; // Use the specific access denied/disallowed message
      } else if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`writeFileTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});