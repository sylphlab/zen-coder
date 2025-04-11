import { z } from 'zod';
import { tool } from 'ai';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';

export const moveRenameTool = tool({
  description: 'Move or rename a file or folder within the workspace. Use relative paths from the workspace root. This operation fails if the destination path already exists.',
  parameters: z.object({
    sourcePath: z.string().describe('The current relative path of the file or folder to move/rename.'),
    destinationPath: z.string().describe('The new relative path for the file or folder.'),
  }),
  execute: async ({ sourcePath, destinationPath }) => {
    try {
      if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace is open.');
      }
      const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

      // --- Path Validation and Safety Checks ---
      const absoluteSourcePath = path.resolve(workspaceUri.fsPath, sourcePath);
      const absoluteDestPath = path.resolve(workspaceUri.fsPath, destinationPath);

      if (!absoluteSourcePath.startsWith(workspaceUri.fsPath)) {
        throw new Error(`Access denied: Source path '${sourcePath}' is outside the workspace.`);
      }
      if (!absoluteDestPath.startsWith(workspaceUri.fsPath)) {
        throw new Error(`Access denied: Destination path '${destinationPath}' is outside the workspace.`);
      }

      // Prevent operating on critical paths
      const criticalPaths = ['.git', '.git/', '/', ''];
      if (criticalPaths.includes(sourcePath) || criticalPaths.includes(destinationPath)) {
          throw new Error(`Moving or renaming the workspace root or '.git' directory is not allowed.`);
      }
       if (sourcePath.includes('.git/') || destinationPath.includes('.git/')) {
          throw new Error(`Operating within the '.git' directory is not allowed.`);
      }
      // --- End Safety Checks ---

      const sourceUri = Uri.joinPath(workspaceUri, sourcePath);
      const destinationUri = Uri.joinPath(workspaceUri, destinationPath);

      // Check if source exists before attempting rename
      try {
        await vscode.workspace.fs.stat(sourceUri);
      } catch (error: any) {
        if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
          throw new Error(`Source path '${sourcePath}' not found.`);
        }
        throw error; // Re-throw other stat errors
      }

      // Perform the rename/move operation. Fails if destination exists.
      await vscode.workspace.fs.rename(sourceUri, destinationUri, { overwrite: false });

      return { success: true, message: `Successfully moved/renamed '${sourcePath}' to '${destinationPath}'.` };

    } catch (error: any) {
      let errorMessage = `Failed to move/rename '${sourcePath}' to '${destinationPath}'.`;
       if (error instanceof vscode.FileSystemError && error.code === 'FileExists') {
          errorMessage = `Error: Destination path '${destinationPath}' already exists. Cannot overwrite.`;
      } else if (error.message.includes('Access denied') || error.message.includes('not allowed') || error.message.includes('not found')) {
          errorMessage = error.message; // Use the specific error message
      } else if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`moveRenameTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});