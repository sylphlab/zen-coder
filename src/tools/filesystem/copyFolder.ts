import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';
import { Uri, FileType } from 'vscode'; // Import FileType
import path from 'path';

export const copyFolderTool = tool({
  description: 'Copy a folder and its contents recursively from a source path to a destination path within the workspace. Use relative paths.',
  parameters: z.object({
    sourcePath: z.string().describe('The relative path of the folder to copy.'),
    destinationPath: z.string().describe('The relative path where the folder should be copied to. The destination folder itself will be created if it doesn\'t exist.'),
    overwrite: z.boolean().optional().default(false).describe('If true, overwrite the destination folder and its contents if it exists. Use with caution! Defaults to false.'),
  }),
  execute: async ({ sourcePath, destinationPath, overwrite = false }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const operation = `Copying folder '${sourcePath}' to '${destinationPath}' (Overwrite: ${overwrite})`;
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'copyFolderTool', status: 'processing', message: operation });
    }

    try {
      if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace is open.');
      }
      const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

      // --- Path Validation ---
      const absoluteSourcePath = path.resolve(workspaceUri.fsPath, sourcePath);
      const absoluteDestPath = path.resolve(workspaceUri.fsPath, destinationPath);
      if (!absoluteSourcePath.startsWith(workspaceUri.fsPath)) {
        throw new Error(`Access denied: Source path '${sourcePath}' is outside the workspace.`);
      }
      if (!absoluteDestPath.startsWith(workspaceUri.fsPath)) {
        throw new Error(`Access denied: Destination path '${destinationPath}' is outside the workspace.`);
      }
       // Prevent copying .git or root
      const criticalPaths = ['.git', '.git/', '/', ''];
      if (criticalPaths.includes(sourcePath) || criticalPaths.includes(destinationPath)) {
          throw new Error(`Copying the workspace root or '.git' directory is not allowed.`);
      }
      if (sourcePath.includes('.git/') || destinationPath.includes('.git/')) {
          throw new Error(`Operating within the '.git' directory is not allowed.`);
      }
      if (absoluteSourcePath === absoluteDestPath || absoluteDestPath.startsWith(absoluteSourcePath + path.sep)) {
          throw new Error('Destination path cannot be the same as or inside the source path.');
      }
      // --- End Validation ---

      const sourceUri = Uri.joinPath(workspaceUri, sourcePath);
      const destinationUri = Uri.joinPath(workspaceUri, destinationPath);

      // Check if source exists and is a directory
      try {
          const stat = await vscode.workspace.fs.stat(sourceUri);
          if (stat.type !== FileType.Directory) { // Check for Directory type
              throw new Error(`Source path '${sourcePath}' is not a directory.`);
          }
      } catch (error: any) {
          if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
              throw new Error(`Source folder not found at path '${sourcePath}'.`);
          }
          throw error; // Re-throw other stat errors
      }

      // Perform the copy operation (recursive for directories)
      // Note: fs.copy handles recursive copy implicitly when source is a directory.
      await vscode.workspace.fs.copy(sourceUri, destinationUri, { overwrite: overwrite });

      const successMessage = `Successfully copied folder '${sourcePath}' to '${destinationPath}'${overwrite ? ' (destination overwritten)' : ''}.`;
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'copyFolderTool', status: 'complete', message: successMessage });
      }
      return { success: true, message: successMessage };

    } catch (error: any) {
      let errorMessage = `Failed to copy folder '${sourcePath}' to '${destinationPath}'.`;
       if (error instanceof vscode.FileSystemError && error.code === 'FileExists' && !overwrite) {
          errorMessage = `Error: Destination path '${destinationPath}' already exists. Set overwrite: true to replace it.`;
      } else if (error.message.includes('Access denied') || error.message.includes('not allowed') || error.message.includes('not a directory') || error.message.includes('not found') || error.message.includes('inside the source path')) {
          errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`copyFolderTool Error: ${error}`);
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'copyFolderTool', status: 'error', message: errorMessage });
      }
      return { success: false, error: errorMessage };
    }
  },
});