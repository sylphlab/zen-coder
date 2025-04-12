import { z } from 'zod';
import { tool, StreamData } from 'ai'; // Import StreamData
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';

// Define schema for the result of a single file deletion operation
const deleteFileResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const deleteFileTool = tool({
  description: 'Delete one or more files at the specified paths within the workspace. Use relative paths from the workspace root.',
  parameters: z.object({
    filePaths: z.array(z.string()).min(1).describe('An array of relative paths to the files to delete within the workspace.'),
    useTrash: z.boolean().optional().default(true).describe('If true (default), move the files to the trash/recycle bin. If false, delete permanently.'),
  }),
  // Modify execute signature
  execute: async ({ filePaths, useTrash = true }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const results: z.infer<typeof deleteFileResultSchema>[] = [];
    const deleteType = useTrash ? 'Moving to trash' : 'Permanently deleting';

    if (!vscode.workspace.workspaceFolders) {
      // Return a general error if no workspace is open, affecting all files
      return { success: false, error: 'No workspace is open.', results: [] };
    }
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteFileTool', status: 'processing', message: `${deleteType} ${filePaths.length} file(s)...` });
    }

    for (const filePath of filePaths) {
        let fileResult: z.infer<typeof deleteFileResultSchema> = { path: filePath, success: false };

        // Send status update for the current file
        if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteFileTool', status: 'processing', message: `${deleteType} file: ${filePath}` });
        }
        try {
          // Workspace check moved outside the loop

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
           fileResult = { success: true, path: filePath, message: `File '${filePath}' does not exist.` };
           // Skip to next file in loop if it doesn't exist
           results.push(fileResult);
           continue;
           // Alternatively: throw new Error(`File not found at path '${filePath}'.`);
        }
        throw error; // Re-throw other stat errors
      }

      // Delete the file (non-recursive, fails if it's a directory)
      await vscode.workspace.fs.delete(fileUri, { useTrash: useTrash, recursive: false }); // Pass useTrash option, ensure recursive is false for files

      fileResult = { success: true, path: filePath, message: `File '${filePath}' ${useTrash ? 'moved to trash' : 'deleted permanently'} successfully.` };

        } catch (error: any) {
          let errorMessage = `Failed to delete file '${filePath}'.`;
           if (error.message.includes('Access denied') || error.message.includes('not allowed') || error.message.includes('not a file')) {
              errorMessage = error.message; // Use the specific error message
          } else if (error instanceof Error) {
            errorMessage += ` Reason: ${error.message}`;
          } else {
            errorMessage += ` Unknown error: ${String(error)}`;
          }
          console.error(`deleteFileTool Error for ${filePath}: ${error}`);
          // Send error status via stream if possible
          if (data && toolCallId) {
              data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteFileTool', status: 'error', message: errorMessage });
          }
          fileResult = { success: false, path: filePath, error: errorMessage };
        }
        results.push(fileResult);
    } // End loop

    // Send final status
    const successfulDeletes = results.filter(r => r.success).length;
    const finalMessage = `Processed ${filePaths.length} file deletion requests. Successful: ${successfulDeletes}.`;
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'deleteFileTool', status: 'complete', message: finalMessage });
    }

     // Validate results array before returning
    const validationResult = z.array(deleteFileResultSchema).safeParse(results);
    if (!validationResult.success) {
        console.error("deleteFileTool validation error:", validationResult.error);
        // Return a general error if validation fails
        return { success: false, error: "Internal error: Failed to format delete file results.", results: [] };
    }

    // Determine overall success (e.g., if at least one delete succeeded or file didn't exist)
    const overallSuccess = results.some(r => r.success);

    return { success: overallSuccess, results: validationResult.data };
  },
});