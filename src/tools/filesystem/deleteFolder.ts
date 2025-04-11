import { z } from 'zod';
import { tool, StreamData } from 'ai'; // Import StreamData
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';

export const deleteFolderTool = tool({
  description: 'Delete a folder and all its contents recursively at the specified path within the workspace. Use relative paths from the workspace root. This action is irreversible.',
  parameters: z.object({
    folderPath: z.string().describe('The relative path to the folder to delete within the workspace.'),
    useTrash: z.boolean().optional().default(true).describe('If true (default), move the folder and its contents to the trash/recycle bin. If false, delete permanently.'),
  }),
  // Modify execute signature
  execute: async ({ folderPath, useTrash = true }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const deleteType = useTrash ? 'Moving to trash' : 'Permanently deleting';
    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteFolderTool', status: 'processing', message: `${deleteType} folder: ${folderPath}` });
    }
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
          throw new Error(`Deleting folders within '.git' directory is not allowed.`);
      }
       if (folderPath === '.' || folderPath === '/' || folderPath === '' || absolutePath === workspaceUri.fsPath) {
          throw new Error(`Deleting the workspace root directory is not allowed.`);
      }

      const folderUri = Uri.joinPath(workspaceUri, folderPath);

      // Check if it exists and is a directory before attempting deletion
      try {
        const stat = await vscode.workspace.fs.stat(folderUri);
        if (stat.type !== vscode.FileType.Directory) {
          throw new Error(`Path '${folderPath}' exists but is not a directory.`);
        }
      } catch (error: any) {
        if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
          // If it doesn't exist, consider it successfully "deleted".
           return { success: true, message: `Folder '${folderPath}' does not exist.` };
           // Alternatively: throw new Error(`Folder not found at path '${folderPath}'.`);
        }
        throw error; // Re-throw other stat errors
      }

      // Delete the folder recursively
      await vscode.workspace.fs.delete(folderUri, { recursive: true, useTrash: useTrash }); // Pass useTrash option

      return { success: true, message: `Folder '${folderPath}' and its contents ${useTrash ? 'moved to trash' : 'deleted permanently'} successfully.` };

    } catch (error: any) {
      let errorMessage = `Failed to delete folder '${folderPath}'.`;
       if (error.message.includes('Access denied') || error.message.includes('not allowed') || error.message.includes('not a directory')) {
          errorMessage = error.message; // Use the specific error message
      } else if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`deleteFolderTool Error: ${error}`);
      // Send error status via stream if possible
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteFolderTool', status: 'error', message: errorMessage });
      }
      return { success: false, error: errorMessage };
    }
  },
});