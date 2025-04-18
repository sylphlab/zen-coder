import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';
import { Uri, FileType } from 'vscode';
import path from 'path';

// Define schema for a single copy operation item
const copyItemSchema = z.object({
  sourcePath: z.string().describe('The relative path of the file or folder to copy.'),
  destinationPath: z.string().describe('The relative path where the item should be copied to.'),
});

// Define schema for the result of a single copy operation
const copyItemResultSchema = z.object({
  sourcePath: z.string(),
  destinationPath: z.string(),
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const copyItemsTool = tool({
  description: 'Copy one or more files or folders recursively from source paths to destination paths within the workspace. Use relative paths.',
  parameters: z.object({
    items: z.array(copyItemSchema).min(1).describe('An array of objects, each specifying a sourcePath and destinationPath for copying.'),
    overwrite: z.boolean().optional().default(false).describe('If true, overwrite destination items if they exist. Applies to all items. Use with caution! Defaults to false.'),
  }),
  execute: async ({ items, overwrite = false }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const results: z.infer<typeof copyItemResultSchema>[] = [];

    if (!vscode.workspace.workspaceFolders) {
      return { success: false, error: 'No workspace is open.', results: [] };
    }
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'copyItemsTool', status: 'processing', message: `Starting to copy ${items.length} item(s)... (Overwrite: ${overwrite})` });
    }

    for (const item of items) {
      const { sourcePath, destinationPath } = item;
      let itemResult: z.infer<typeof copyItemResultSchema> = { sourcePath, destinationPath, success: false };
      const operation = `Copying '${sourcePath}' to '${destinationPath}'`;

      // Send status update for the current item
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'copyItemsTool', status: 'processing', message: operation });
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
        // Prevent copying .git or root
        const criticalPaths = ['.git', '.git/', '/', ''];
        if (criticalPaths.includes(sourcePath) || criticalPaths.includes(destinationPath)) {
            throw new Error(`Copying the workspace root or '.git' directory is not allowed.`);
        }
        if (sourcePath.includes('.git/') || destinationPath.includes('.git/')) {
            throw new Error(`Operating within the '.git' directory is not allowed.`);
        }
        if (absoluteSourcePath === absoluteDestPath || absoluteDestPath.startsWith(absoluteSourcePath + path.sep)) {
            // Check if destination is inside source only applies if source is a directory,
            // but fs.copy should handle this. Let's keep the check for safety.
            throw new Error('Destination path cannot be the same as or inside the source path.');
        }
        // --- End Validation ---

        const sourceUri = Uri.joinPath(workspaceUri, sourcePath);
        const destinationUri = Uri.joinPath(workspaceUri, destinationPath);

        // Check if source exists (fs.copy will fail anyway, but good for clearer error)
        let sourceType: FileType | undefined;
        try {
            const stat = await vscode.workspace.fs.stat(sourceUri);
            sourceType = stat.type;
            if (sourceType === FileType.Unknown) {
                 throw new Error(`Source path '${sourcePath}' type is unknown.`);
            }
        } catch (error: any) {
            if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
                throw new Error(`Source path not found at '${sourcePath}'.`);
            }
            throw error; // Re-throw other stat errors
        }

        // Perform the copy operation (fs.copy handles files and recursive folder copy)
        await vscode.workspace.fs.copy(sourceUri, destinationUri, { overwrite: overwrite });

        const itemType = sourceType === FileType.Directory ? 'folder' : 'file';
        const successMessage = `Successfully copied ${itemType} '${sourcePath}' to '${destinationPath}'${overwrite ? ' (destination overwritten)' : ''}.`;
        itemResult = { sourcePath, destinationPath, success: true, message: successMessage };
        if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'copyItemsTool', status: 'processing', message: `Success: ${operation}` });
        }

      } catch (error: any) {
        let errorMessage = `Failed to copy '${sourcePath}' to '${destinationPath}'.`;
         if (error instanceof vscode.FileSystemError && error.code === 'FileExists' && !overwrite) {
            errorMessage = `Error: Destination path '${destinationPath}' already exists. Set overwrite: true to replace it.`;
        } else if (error.message.includes('Access denied') || error.message.includes('not allowed') || error.message.includes('not found') || error.message.includes('inside the source path')) {
            errorMessage = error.message;
        } else if (error instanceof Error) {
          errorMessage += ` Reason: ${error.message}`;
        } else {
          errorMessage += ` Unknown error: ${String(error)}`;
        }
        console.error(`copyItemsTool Error for ${sourcePath} -> ${destinationPath}: ${error}`);
        itemResult = { sourcePath, destinationPath, success: false, error: errorMessage };
        if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'copyItemsTool', status: 'warning', message: `Failed: ${operation}. Reason: ${errorMessage}` });
        }
      }
      results.push(itemResult);
    } // End loop

    // Send final status
    const successfulCopies = results.filter(r => r.success).length;
    const finalMessage = `Finished copying ${successfulCopies}/${items.length} items.`;
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'copyItemsTool', status: 'complete', message: finalMessage });
    }

    // Validate results array before returning
    const validationResult = z.array(copyItemResultSchema).safeParse(results);
    if (!validationResult.success) {
        console.error("copyItemsTool validation error:", validationResult.error);
        return { success: false, error: "Internal error: Failed to format copy results.", results: [] };
    }

    // Determine overall success (e.g., if all copies succeeded)
    const overallSuccess = results.every(r => r.success);

    return { success: overallSuccess, results: validationResult.data };
  },
});