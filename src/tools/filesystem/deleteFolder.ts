import { z } from 'zod';
import { tool, StreamData } from 'ai'; // Import StreamData
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';

// Define schema for the result of a single folder deletion operation
const deleteFolderResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const deleteFolderTool = tool({
  description: 'Delete one or more folders and their contents recursively at the specified paths within the workspace. Use relative paths from the workspace root.',
  parameters: z.object({
    folderPaths: z.array(z.string()).min(1).describe('An array of relative paths to the folders to delete within the workspace.'),
    useTrash: z.boolean().optional().default(true).describe('If true (default), move the folders and their contents to the trash/recycle bin. If false, delete permanently.'),
  }),
  // Modify execute signature
  execute: async ({ folderPaths, useTrash = true }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const results: z.infer<typeof deleteFolderResultSchema>[] = [];
    const deleteType = useTrash ? 'Moving to trash' : 'Permanently deleting';

    if (!vscode.workspace.workspaceFolders) {
      // Return a general error if no workspace is open, affecting all folders
      return { success: false, error: 'No workspace is open.', results: [] };
    }
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

     // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteFolderTool', status: 'processing', message: `${deleteType} ${folderPaths.length} folder(s)...` });
    }

    for (const folderPath of folderPaths) {
        let fileResult: z.infer<typeof deleteFolderResultSchema> = { path: folderPath, success: false };

        // Send status update for the current folder
        if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteFolderTool', status: 'processing', message: `${deleteType} folder: ${folderPath}` });
        }
        try {
          // Workspace check moved outside the loop

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
           fileResult = { success: true, path: folderPath, message: `Folder '${folderPath}' does not exist.` };
           // Skip to next folder in loop if it doesn't exist
           results.push(fileResult);
           continue;
           // Alternatively: throw new Error(`Folder not found at path '${folderPath}'.`);
        }
        throw error; // Re-throw other stat errors
      }

      // Delete the folder recursively
      await vscode.workspace.fs.delete(folderUri, { recursive: true, useTrash: useTrash }); // Pass useTrash option

      fileResult = { success: true, path: folderPath, message: `Folder '${folderPath}' and its contents ${useTrash ? 'moved to trash' : 'deleted permanently'} successfully.` };

        } catch (error: any) {
          let errorMessage = `Failed to delete folder '${folderPath}'.`;
           if (error.message.includes('Access denied') || error.message.includes('not allowed') || error.message.includes('not a directory')) {
              errorMessage = error.message; // Use the specific error message
          } else if (error instanceof Error) {
            errorMessage += ` Reason: ${error.message}`;
          } else {
            errorMessage += ` Unknown error: ${String(error)}`;
          }
          console.error(`deleteFolderTool Error for ${folderPath}: ${error}`);
           // Send error status via stream if possible
          if (data && toolCallId) {
              data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteFolderTool', status: 'error', message: errorMessage });
          }
          fileResult = { success: false, path: folderPath, error: errorMessage };
        }
        results.push(fileResult);
    } // End loop

    // Send final status
    const successfulDeletes = results.filter(r => r.success).length;
    const finalMessage = `Processed ${folderPaths.length} folder deletion requests. Successful: ${successfulDeletes}.`;
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteFolderTool', status: 'complete', message: finalMessage });
    }

     // Validate results array before returning
    const validationResult = z.array(deleteFolderResultSchema).safeParse(results);
    if (!validationResult.success) {
        console.error("deleteFolderTool validation error:", validationResult.error);
        // Return a general error if validation fails
        return { success: false, error: "Internal error: Failed to format delete folder results.", results: [] };
    }

    // Determine overall success (e.g., if at least one delete succeeded or folder didn't exist)
    const overallSuccess = results.some(r => r.success);

    return { success: overallSuccess, results: validationResult.data };
  },
});