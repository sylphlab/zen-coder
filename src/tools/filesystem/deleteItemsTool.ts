import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';
import { Uri, FileType } from 'vscode';
import path from 'path';

// Schema for the result of a single delete operation
const deleteResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const deleteItemsTool = tool({
  description: 'Delete specified files or directories within the workspace. Supports glob patterns and moving to trash or permanent deletion.',
  parameters: z.object({
    paths: z.array(z.string()).min(1).describe("An array of relative paths or glob patterns specifying the items to delete within the workspace."),
    recursive: z.boolean().optional().default(true).describe('For directories, delete recursively. Defaults to true. Ignored for files.'),
    useTrash: z.boolean().optional().default(true).describe('Move items to the trash instead of permanently deleting them. Defaults to true.'),
  }),
  execute: async ({ paths, recursive = true, useTrash = true }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const results: z.infer<typeof deleteResultSchema>[] = [];
    const operationDesc = useTrash ? 'Moving to trash' : 'Deleting permanently';

    if (!vscode.workspace.workspaceFolders) {
      return { success: false, error: 'No workspace is open.', results: [] };
    }
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteItemsTool', status: 'processing', message: `${operationDesc} items matching ${paths.join(', ')}...` });
    }

    // 1. Find matching items
    const foundItemsUris: Set<string> = new Set();
    let itemsProcessedCount = 0;

    for (const pattern of paths) {
        try {
            // Resolve the pattern relative to the workspace root
            // Note: findFiles might not be ideal for finding *directories* matching a pattern,
            // but it's the best built-in tool for glob matching files.
            // We might need to stat results to differentiate files/dirs if the pattern is ambiguous.
            // Let's assume findFiles gives us a starting point.
            const uris = await vscode.workspace.findFiles(pattern, undefined, undefined);
            uris.forEach(uri => foundItemsUris.add(uri.toString()));

            // Attempt to stat the pattern directly in case it's an explicit directory path not found by findFiles
             try {
                const directPathUri = Uri.joinPath(workspaceUri, pattern);
                const stat = await vscode.workspace.fs.stat(directPathUri);
                 if (stat.type === FileType.Directory) {
                    foundItemsUris.add(directPathUri.toString());
                }
            } catch (statError) {
                // Ignore if stat fails (means it's likely not a direct directory path or doesn't exist)
            }

        } catch (globError: any) {
             console.error(`deleteItemsTool: Error finding items for pattern "${pattern}": ${globError}`);
             if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteItemsTool', status: 'warning', message: `Error processing glob pattern "${pattern}": ${globError.message}` });
            }
        }
    }
    const uniqueItemUris = Array.from(foundItemsUris).map(uriStr => Uri.parse(uriStr));

     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteItemsTool', status: 'processing', message: `Found ${uniqueItemUris.length} unique items matching patterns. Starting deletion...` });
    }

    // 2. Process each found item
    for (const itemUri of uniqueItemUris) {
      const relativePath = path.relative(workspaceUri.fsPath, itemUri.fsPath).replace(/\\/g, '/');
      const itemResult: z.infer<typeof deleteResultSchema> = { path: relativePath, success: false };
      itemsProcessedCount++;

       if (data && toolCallId && itemsProcessedCount % 10 === 0) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteItemsTool', status: 'processing', message: `Processed ${itemsProcessedCount}/${uniqueItemUris.length} items...` });
        }

      try {
        // Security Check: Prevent deleting workspace root
        if (itemUri.fsPath === workspaceUri.fsPath || relativePath === '' || relativePath === '.') {
             throw new Error(`Deleting the workspace root directory is not allowed.`);
        }
         // Security Check: Prevent deleting outside workspace (double check)
         const absolutePath = path.resolve(workspaceUri.fsPath, relativePath);
         if (!absolutePath.startsWith(workspaceUri.fsPath)) {
             throw new Error(`Access denied: Path '${relativePath}' is outside the workspace.`);
         }
         // Security Check: Prevent deleting .git
         if (relativePath.includes('.git/') || relativePath.startsWith('.git')) {
             throw new Error(`Deleting items within '.git' directory is not allowed.`);
         }


        await vscode.workspace.fs.delete(itemUri, { recursive: recursive, useTrash: useTrash });
        itemResult.success = true;
        itemResult.message = `Item '${relativePath}' ${useTrash ? 'moved to trash' : 'deleted permanently'}.`;

      } catch (error: any) {
        let errorMessage = `Failed to delete item '${relativePath}'.`;
         if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
             // If findFiles found it but delete fails with FileNotFound, it's strange, but report as non-existent.
             itemResult.success = true; // Consider it success as the item is gone.
             itemResult.message = `Item '${relativePath}' does not exist or was already deleted.`;
         } else if (error.message.includes('Access denied') || error.message.includes('not allowed')) {
            errorMessage = error.message;
        } else if (error instanceof Error) {
          errorMessage += ` Reason: ${error.message}`;
        } else {
          errorMessage += ` Unknown error: ${String(error)}`;
        }

        if (!itemResult.success) { // Only set error if it wasn't handled as success (e.g., FileNotFound)
             console.error(`deleteItemsTool Error for ${relativePath}: ${error}`);
             itemResult.error = errorMessage;
             if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteItemsTool', status: 'warning', message: `Error deleting ${relativePath}: ${itemResult.error}` });
            }
        }
      }
      results.push(itemResult);
    } // End loop through items

    // Send final status
    const successfulDeletes = results.filter(r => r.success).length;
    const filesWithErrors = results.filter(r => !r.success).length;
    const finalMessage = `Deletion complete. Processed ${uniqueItemUris.length} items. Successfully deleted/trashed ${successfulDeletes}. Encountered errors with ${filesWithErrors}.`;
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteItemsTool', status: 'complete', message: finalMessage });
    }

    // Validate results array before returning
    const validationResult = z.array(deleteResultSchema).safeParse(results);
     if (!validationResult.success) {
        console.error("deleteItemsTool validation error:", validationResult.error);
        return { success: false, error: "Internal error: Failed to format delete results.", results: [] };
    }

    // Overall success means no errors occurred
    const overallSuccess = !results.some(r => !r.success);

    return { success: overallSuccess, results: validationResult.data };
  },
});