import { z } from 'zod';
import { tool } from 'ai';
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';

// Define schema for the result of a single folder creation operation
const createFolderResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const createFolderTool = tool({
  description: 'Create one or more new folders (and any necessary parent folders) at the specified paths within the workspace. Use relative paths from the workspace root.',
  parameters: z.object({
    folderPaths: z.array(z.string()).min(1).describe('An array of relative paths for the new folders within the workspace.'),
  }),
  execute: async ({ folderPaths }) => {
    const results: z.infer<typeof createFolderResultSchema>[] = [];

    if (!vscode.workspace.workspaceFolders) {
      // Return a general error if no workspace is open, affecting all folders
      return { success: false, error: 'No workspace is open.', results: [] };
    }
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

    for (const folderPath of folderPaths) {
        let fileResult: z.infer<typeof createFolderResultSchema> = { path: folderPath, success: false };
        try {
          // Workspace check moved outside the loop

      // Ensure the path is relative and within the workspace
      const absolutePath = path.resolve(workspaceUri.fsPath, folderPath);
      if (!absolutePath.startsWith(workspaceUri.fsPath)) {
          throw new Error(`Access denied: Path '${folderPath}' is outside the workspace.`);
      }

      // Basic check for potentially dangerous paths
      if (folderPath.includes('.git/') || folderPath.startsWith('.git')) {
          throw new Error(`Creating folders within '.git' directory is not allowed.`);
      }

      const folderUri = Uri.joinPath(workspaceUri, folderPath);

      // Check if it already exists and is a directory
      try {
        const stat = await vscode.workspace.fs.stat(folderUri);
        if (stat.type === vscode.FileType.Directory) {
          fileResult = { success: true, path: folderPath, message: `Folder '${folderPath}' already exists.` };
        } else {
          // It exists but is not a directory (e.g., a file)
          throw new Error(`Path '${folderPath}' already exists but is not a directory.`);
        }
      } catch (error: any) {
        // If stat fails with FileNotFound, that's expected, proceed to create.
        // Otherwise, re-throw other stat errors.
        if (!(error instanceof vscode.FileSystemError && error.code === 'FileNotFound')) {
          throw error; // Re-throw unexpected stat errors
        }
      }

      // Create the directory (recursive is default behavior)
      await vscode.workspace.fs.createDirectory(folderUri);

      fileResult = { success: true, path: folderPath, message: `Folder '${folderPath}' created successfully.` };

        } catch (error: any) {
          let errorMessage = `Failed to create folder '${folderPath}'.`;
           if (error.message.includes('Access denied') || error.message.includes('not allowed') || error.message.includes('already exists but is not a directory')) {
              errorMessage = error.message; // Use the specific error message
          } else if (error instanceof Error) {
            errorMessage += ` Reason: ${error.message}`;
          } else {
            errorMessage += ` Unknown error: ${String(error)}`;
          }
          console.error(`createFolderTool Error for ${folderPath}: ${error}`);
          fileResult = { success: false, path: folderPath, error: errorMessage };
        }
        results.push(fileResult);
    } // End loop

     // Validate results array before returning
    const validationResult = z.array(createFolderResultSchema).safeParse(results);
    if (!validationResult.success) {
        console.error("createFolderTool validation error:", validationResult.error);
        // Return a general error if validation fails
        return { success: false, error: "Internal error: Failed to format create folder results.", results: [] };
    }

    // Determine overall success (e.g., if at least one creation succeeded)
    const overallSuccess = results.some(r => r.success);

    return { success: overallSuccess, results: validationResult.data };
  },
});