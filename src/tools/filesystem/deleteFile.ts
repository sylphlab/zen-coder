import { z } from 'zod';
import { tool } from 'ai';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';

export const deleteFileTool = tool({
  description: 'Delete a file at the specified path within the workspace. Use relative paths from the workspace root. This action is irreversible.',
  parameters: z.object({
    filePath: z.string().describe('The relative path to the file to delete within the workspace.'),
    // Optional: Add a confirmation flag if direct deletion feels too risky,
    // though the description already warns about irreversibility.
    // confirm: z.boolean().optional().default(false).describe('Set to true to confirm deletion.')
  }),
  execute: async ({ filePath /*, confirm */ }) => {
    // if (!confirm) {
    //   return { success: false, error: 'Deletion not confirmed. Set confirm: true to proceed.' };
    // }
    try {
      if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace is open.');
      }
      const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

      // Ensure the path is relative and within the workspace
      const absolutePath = path.resolve(workspaceUri.fsPath, filePath);
      if (!absolutePath.startsWith(workspaceUri.fsPath)) {
          throw new Error(`Access denied: Path '${filePath}' is outside the workspace.`);
      }

      // Basic check for potentially dangerous paths
      if (filePath.includes('.git/') || filePath.startsWith('.git')) {
          throw new Error(`Deleting files within '.git' directory is not allowed.`);
      }
      if (filePath === '.' || filePath === '/' || filePath === '') {
          throw new Error(`Deleting the workspace root is not allowed.`);
      }


      const fileUri = Uri.joinPath(workspaceUri, filePath);

      // Check if it exists and is a file before attempting deletion
      try {
        const stat = await vscode.workspace.fs.stat(fileUri);
        if (stat.type !== vscode.FileType.File) {
          throw new Error(`Path '${filePath}' exists but is not a file.`);
        }
      } catch (error: any) {
        if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
          // If it doesn't exist, consider it successfully "deleted" or handle as error?
          // Let's return success as the state matches the desired outcome.
           return { success: true, message: `File '${filePath}' does not exist.` };
           // Alternatively: throw new Error(`File not found at path '${filePath}'.`);
        }
        throw error; // Re-throw other stat errors
      }

      // Delete the file (non-recursive, fails if it's a directory)
      await vscode.workspace.fs.delete(fileUri, { useTrash: false }); // useTrash: false for permanent delete

      return { success: true, message: `File '${filePath}' deleted successfully.` };

    } catch (error: any) {
      let errorMessage = `Failed to delete file '${filePath}'.`;
       if (error.message.includes('Access denied') || error.message.includes('not allowed') || error.message.includes('not a file')) {
          errorMessage = error.message; // Use the specific error message
      } else if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`deleteFileTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});