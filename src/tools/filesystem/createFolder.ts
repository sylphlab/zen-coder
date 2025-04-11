import { z } from 'zod';
import { tool } from 'ai';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';

export const createFolderTool = tool({
  description: 'Create a new folder (and any necessary parent folders) at the specified path within the workspace. Use relative paths from the workspace root.',
  parameters: z.object({
    folderPath: z.string().describe('The relative path for the new folder within the workspace.'),
  }),
  execute: async ({ folderPath }) => {
    try {
      if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace is open.');
      }
      const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

      // Ensure the path is relative and within the workspace
      const absolutePath = path.resolve(workspaceUri.fsPath, folderPath);
      if (!absolutePath.startsWith(workspaceUri.fsPath)) {
          throw new Error(`Access denied: Path '${folderPath}' is outside the workspace.`);
      }

      // Basic check for potentially dangerous paths
      if (folderPath.includes('.git/') || folderPath.startsWith('.git')) {
          throw new Error(`Creating folders within '.git' directory is not allowed.`);
      }

      const folderUri = Uri.joinPath(workspaceUri, folderPath);

      // Check if it already exists and is a directory
      try {
        const stat = await vscode.workspace.fs.stat(folderUri);
        if (stat.type === vscode.FileType.Directory) {
          return { success: true, message: `Folder '${folderPath}' already exists.` };
        } else {
          // It exists but is not a directory (e.g., a file)
          throw new Error(`Path '${folderPath}' already exists but is not a directory.`);
        }
      } catch (error: any) {
        // If stat fails with FileNotFound, that's expected, proceed to create.
        // Otherwise, re-throw other stat errors.
        if (!(error instanceof vscode.FileSystemError && error.code === 'FileNotFound')) {
          throw error; // Re-throw unexpected stat errors
        }
      }

      // Create the directory (recursive is default behavior)
      await vscode.workspace.fs.createDirectory(folderUri);

      return { success: true, message: `Folder '${folderPath}' created successfully.` };

    } catch (error: any) {
      let errorMessage = `Failed to create folder '${folderPath}'.`;
       if (error.message.includes('Access denied') || error.message.includes('not allowed') || error.message.includes('already exists but is not a directory')) {
          errorMessage = error.message; // Use the specific error message
      } else if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`createFolderTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});