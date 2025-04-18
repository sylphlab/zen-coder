import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';

// Define schema for a single copy operation item
const copyFileItemSchema = z.object({
  sourcePath: z.string().describe('The relative path of the file to copy.'),
  destinationPath: z.string().describe('The relative path where the file should be copied to.'),
});

// Define schema for the result of a single copy operation
const copyFileResultSchema = z.object({
  sourcePath: z.string(),
  destinationPath: z.string(),
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const copyFileTool = tool({
  description: 'Copy one or more files from source paths to destination paths within the workspace. Use relative paths.',
  parameters: z.object({
    items: z.array(copyFileItemSchema).min(1).describe('An array of objects, each specifying a sourcePath and destinationPath for copying.'),
    overwrite: z.boolean().optional().default(false).describe('If true, overwrite destination files if they exist. Applies to all items. Defaults to false.'),
  }),
  execute: async ({ items, overwrite = false }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const results: z.infer<typeof copyFileResultSchema>[] = [];

    if (!vscode.workspace.workspaceFolders) {
      return { success: false, error: 'No workspace is open.', results: [] };
    }
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'copyFileTool', status: 'processing', message: `Starting to copy ${items.length} file(s)... (Overwrite: ${overwrite})` });
    }

    for (const item of items) {
      const { sourcePath, destinationPath } = item;
      let itemResult: z.infer<typeof copyFileResultSchema> = { sourcePath, destinationPath, success: false };
      const operation = `Copying '${sourcePath}' to '${destinationPath}'`;

      // Send status update for the current item
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'copyFileTool', status: 'processing', message: operation });
      }

      try {
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
        itemResult = { sourcePath, destinationPath, success: true, message: successMessage };
        if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'copyFileTool', status: 'processing', message: `Success: ${operation}` }); // Changed status to processing for individual success
        }

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
        console.error(`copyFileTool Error for ${sourcePath} -> ${destinationPath}: ${error}`);
        itemResult = { sourcePath, destinationPath, success: false, error: errorMessage };
        if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'copyFileTool', status: 'warning', message: `Failed: ${operation}. Reason: ${errorMessage}` }); // Changed status to warning for individual failure
        }
      }
      results.push(itemResult);
    } // End loop

    // Send final status
    const successfulCopies = results.filter(r => r.success).length;
    const finalMessage = `Finished copying ${successfulCopies}/${items.length} files.`;
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'copyFileTool', status: 'complete', message: finalMessage });
    }

    // Validate results array before returning
    const validationResult = z.array(copyFileResultSchema).safeParse(results);
    if (!validationResult.success) {
        console.error("copyFileTool validation error:", validationResult.error);
        return { success: false, error: "Internal error: Failed to format copy file results.", results: [] };
    }

    // Determine overall success (e.g., if all copies succeeded)
    const overallSuccess = results.every(r => r.success);

    return { success: overallSuccess, results: validationResult.data };
  },
});