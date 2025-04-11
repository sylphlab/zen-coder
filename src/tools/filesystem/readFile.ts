import { z } from 'zod';
import { tool } from 'ai';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';

export const readFileTool = tool({
  description: 'Read the content of a file in the workspace. Use relative paths from the workspace root.',
  parameters: z.object({
    filePath: z.string().describe('The relative path to the file within the workspace.'),
  }),
  execute: async ({ filePath }) => {
    try {
      if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace is open.');
      }
      // Ensure the path is relative and within the workspace
      const absolutePath = path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, filePath);
      if (!absolutePath.startsWith(vscode.workspace.workspaceFolders[0].uri.fsPath)) {
          throw new Error(`Access denied: Path '${filePath}' is outside the workspace.`);
      }

      const fileUri = Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, filePath);
      const uint8Array = await vscode.workspace.fs.readFile(fileUri);
      const content = new TextDecoder().decode(uint8Array);
      return { success: true, content };
    } catch (error: any) {
      // Provide more specific error messages
      let errorMessage = `Failed to read file '${filePath}'.`;
      if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
        errorMessage = `Error: File not found at path '${filePath}'.`;
      } else if (error.message.includes('Access denied')) {
          errorMessage = error.message; // Use the specific access denied message
      } else if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      // Log the full error for debugging on the extension side if needed
      console.error(`readFileTool Error: ${error}`);
      // Return a structured error for the AI
      return { success: false, error: errorMessage };
    }
  },
});