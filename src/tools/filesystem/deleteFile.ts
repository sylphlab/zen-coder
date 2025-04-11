import { z } from 'zod';
import { tool, StreamData } from 'ai'; // Import StreamData
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';

export const deleteFileTool = tool({
  description: 'Delete a file at the specified path within the workspace. Use relative paths from the workspace root. This action is irreversible.',
  parameters: z.object({
    filePath: z.string().describe('The relative path to the file to delete within the workspace.'),
    useTrash: z.boolean().optional().default(true).describe('If true (default), move the file to the trash/recycle bin. If false, delete permanently.'),
  }),
  // Modify execute signature
  execute: async ({ filePath, useTrash = true }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const deleteType = useTrash ? 'Moving to trash' : 'Permanently deleting';
    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteFileTool', status: 'processing', message: `${deleteType} file: ${filePath}` });
    }
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
      await vscode.workspace.fs.delete(fileUri, { useTrash: useTrash, recursive: false }); // Pass useTrash option, ensure recursive is false for files

      return { success: true, message: `File '${filePath}' ${useTrash ? 'moved to trash' : 'deleted permanently'} successfully.` };

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
      // Send error status via stream if possible
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteFileTool', status: 'error', message: errorMessage });
      }
      return { success: false, error: errorMessage };
    }
  },
});