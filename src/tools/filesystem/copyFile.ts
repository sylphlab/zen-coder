import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';

export const copyFileTool = tool({
  description: 'Copy a file from a source path to a destination path within the workspace. Use relative paths.',
  parameters: z.object({
    sourcePath: z.string().describe('The relative path of the file to copy.'),
    destinationPath: z.string().describe('The relative path where the file should be copied to.'),
    overwrite: z.boolean().optional().default(false).describe('If true, overwrite the destination file if it exists. Defaults to false.'),
  }),
  execute: async ({ sourcePath, destinationPath, overwrite = false }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const operation = `Copying '${sourcePath}' to '${destinationPath}' (Overwrite: ${overwrite})`;
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'copyFileTool', status: 'processing', message: operation });
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
      if (sourcePath.includes('.git/') || destinationPath.includes('.git/')) {
          throw new Error(`Operating within the '.git' directory is not allowed.`);
      }
      if (sourcePath === destinationPath) {
          throw new Error('Source and destination paths cannot be the same.');
      }
      // --- End Validation ---

      const sourceUri = Uri.joinPath(workspaceUri, sourcePath);
      const destinationUri = Uri.joinPath(workspaceUri, destinationPath);

      // Check if source exists and is a file
      try {
          const stat = await vscode.workspace.fs.stat(sourceUri);
          if (stat.type !== vscode.FileType.File) {
              throw new Error(`Source path '${sourcePath}' is not a file.`);
          }
      } catch (error: any) {
          if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
              throw new Error(`Source file not found at path '${sourcePath}'.`);
          }
          throw error; // Re-throw other stat errors
      }

      // Perform the copy operation
      await vscode.workspace.fs.copy(sourceUri, destinationUri, { overwrite: overwrite });

      const successMessage = `Successfully copied '${sourcePath}' to '${destinationPath}'${overwrite ? ' (destination overwritten)' : ''}.`;
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'copyFileTool', status: 'complete', message: successMessage });
      }
      return { success: true, message: successMessage };

    } catch (error: any) {
      let errorMessage = `Failed to copy '${sourcePath}' to '${destinationPath}'.`;
       if (error instanceof vscode.FileSystemError && error.code === 'FileExists' && !overwrite) {
          errorMessage = `Error: Destination path '${destinationPath}' already exists. Set overwrite: true to replace it.`;
      } else if (error.message.includes('Access denied') || error.message.includes('not allowed') || error.message.includes('not a file') || error.message.includes('not found')) {
          errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`copyFileTool Error: ${error}`);
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'copyFileTool', status: 'error', message: errorMessage });
      }
      return { success: false, error: errorMessage };
    }
  },
});