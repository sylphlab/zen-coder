import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';
import { Uri, FileType } from 'vscode'; // Import FileType for potential future checks, though rename handles both
import path from 'path';

// Define schema for a single move/rename operation item
const moveRenameItemSchema = z.object({
  sourcePath: z.string().describe('The current relative path of the file or folder to move/rename.'),
  destinationPath: z.string().describe('The new relative path for the item.'),
});

// Define schema for the result of a single move/rename operation
const moveRenameItemResultSchema = z.object({
  sourcePath: z.string(),
  destinationPath: z.string(),
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const moveRenameItemsTool = tool({
  description: 'Move or rename one or more files or folders within the workspace. Use relative paths.',
  parameters: z.object({
    items: z.array(moveRenameItemSchema).min(1).describe('An array of objects, each specifying a sourcePath and destinationPath for moving/renaming.'),
    overwrite: z.boolean().optional().default(false).describe('If true, overwrite the destination path if it already exists. Applies to all items. Use with caution! Defaults to false.'),
  }),
  execute: async ({ items, overwrite = false }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const results: z.infer<typeof moveRenameItemResultSchema>[] = [];

    if (!vscode.workspace.workspaceFolders) {
      return { success: false, error: 'No workspace is open.', results: [] };
    }
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'moveRenameItemsTool', status: 'processing', message: `Starting to move/rename ${items.length} item(s)... (Overwrite: ${overwrite})` });
    }

    for (const item of items) {
      const { sourcePath, destinationPath } = item;
      let itemResult: z.infer<typeof moveRenameItemResultSchema> = { sourcePath, destinationPath, success: false };
      const operation = `Moving/Renaming '${sourcePath}' to '${destinationPath}'`;

      // Send status update for the current item
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'moveRenameItemsTool', status: 'processing', message: operation });
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
        // Prevent operating on critical paths
        const criticalPaths = ['.git', '.git/', '/', ''];
        if (criticalPaths.includes(sourcePath) || criticalPaths.includes(destinationPath)) {
            throw new Error(`Moving or renaming the workspace root or '.git' directory is not allowed.`);
        }
        if (sourcePath.includes('.git/') || destinationPath.includes('.git/')) {
            throw new Error(`Operating within the '.git' directory is not allowed.`);
        }
         if (sourcePath === destinationPath) {
            // While technically possible on some systems, it's usually an error.
            throw new Error('Source and destination paths cannot be the same for move/rename.');
        }
        // Note: Unlike copy, moving an item *into* itself is inherently impossible and rename handles this.
        // --- End Validation ---

        const sourceUri = Uri.joinPath(workspaceUri, sourcePath);
        const destinationUri = Uri.joinPath(workspaceUri, destinationPath);

        // Check if source exists before attempting rename (rename fails anyway, but gives clearer error)
        try {
          await vscode.workspace.fs.stat(sourceUri);
        } catch (error: any) {
          if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
            throw new Error(`Source path '${sourcePath}' not found.`);
          }
          throw error; // Re-throw other stat errors
        }

        // Perform the rename/move operation (fs.rename handles both files and folders)
        await vscode.workspace.fs.rename(sourceUri, destinationUri, { overwrite: overwrite });

        const successMessage = `Successfully moved/renamed '${sourcePath}' to '${destinationPath}'${overwrite ? ' (destination overwritten)' : ''}.`;
        itemResult = { sourcePath, destinationPath, success: true, message: successMessage };
        if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'moveRenameItemsTool', status: 'processing', message: `Success: ${operation}` });
        }

      } catch (error: any) {
        let errorMessage = `Failed to move/rename '${sourcePath}' to '${destinationPath}'.`;
         if (error instanceof vscode.FileSystemError && error.code === 'FileExists' && !overwrite) {
            // Note: The default behavior of rename is NOT to overwrite. This error occurs if overwrite=false and dest exists.
            errorMessage = `Error: Destination path '${destinationPath}' already exists. Set overwrite: true to replace it.`;
        } else if (error.message.includes('Access denied') || error.message.includes('not allowed') || error.message.includes('not found')) {
            errorMessage = error.message;
        } else if (error instanceof Error) {
          errorMessage += ` Reason: ${error.message}`;
        } else {
          errorMessage += ` Unknown error: ${String(error)}`;
        }
        console.error(`moveRenameItemsTool Error for ${sourcePath} -> ${destinationPath}: ${error}`);
        itemResult = { sourcePath, destinationPath, success: false, error: errorMessage };
        if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'moveRenameItemsTool', status: 'warning', message: `Failed: ${operation}. Reason: ${errorMessage}` });
        }
      }
      results.push(itemResult);
    } // End loop

    // Send final status
    const successfulMoves = results.filter(r => r.success).length;
    const finalMessage = `Finished moving/renaming ${successfulMoves}/${items.length} items.`;
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'moveRenameItemsTool', status: 'complete', message: finalMessage });
    }

    // Validate results array before returning
    const validationResult = z.array(moveRenameItemResultSchema).safeParse(results);
    if (!validationResult.success) {
        console.error("moveRenameItemsTool validation error:", validationResult.error);
        return { success: false, error: "Internal error: Failed to format move/rename results.", results: [] };
    }

    // Determine overall success (e.g., if all moves succeeded)
    const overallSuccess = results.every(r => r.success);

    return { success: overallSuccess, results: validationResult.data };
  },
});