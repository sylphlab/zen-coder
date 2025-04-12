import { z } from 'zod';
import { tool, StreamData } from 'ai'; // Import StreamData for potential future status updates
import * as vscode from 'vscode';
import { FileType, Uri } from 'vscode';
import path from 'path';

// Reusing the stat schema structure
const fileStatSchema = z.object({
  name: z.string().describe('The name of the file or directory.'),
  path: z.string().describe('The relative path provided.'),
  type: z.enum(['file', 'directory', 'symbolic_link', 'unknown']),
  size: z.number().optional().describe('Size in bytes (only for files)'),
  mtime: z.number().optional().describe('Modification time (Unix timestamp ms)'),
  // ctime: z.number().optional().describe('Creation time (Unix timestamp ms)'), // Optional
});

// Define schema for the result of a single stat operation
const statItemResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  stat: fileStatSchema.optional(), // Include the actual stat info on success
  error: z.string().optional(),
});


export const statItemsTool = tool({
  description: 'Get status information (type, size, modification time) for one or more files or directories within the workspace. Use relative paths from the workspace root.',
  parameters: z.object({
    paths: z.array(z.string()).min(1).describe('An array of relative paths to the files or directories within the workspace.'),
  }),
  // Modify execute signature to accept context including StreamData and toolCallId
  execute: async ({ paths }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const results: z.infer<typeof statItemResultSchema>[] = [];

    if (!vscode.workspace.workspaceFolders) {
      // Return a general error if no workspace is open, affecting all paths
      return { success: false, error: 'No workspace is open.', results: [] };
    }
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

    // Send initial status (optional, but good practice)
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'statItemsTool', status: 'processing', message: `Getting stats for ${paths.length} item(s)...` });
    }

    for (const filePath of paths) {
        let fileResult: z.infer<typeof statItemResultSchema> = { path: filePath, success: false };
        try {
          // Workspace check moved outside the loop

      // Ensure the path is relative and within the workspace
      const absolutePath = path.resolve(workspaceUri.fsPath, filePath);
      if (!absolutePath.startsWith(workspaceUri.fsPath)) {
          throw new Error(`Access denied: Path '${filePath}' is outside the workspace.`);
      }

      // Send status update for the current item (optional)
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'statItemsTool', status: 'processing', message: `Getting stat for: ${filePath}` });
       }


      const targetUri = Uri.joinPath(workspaceUri, filePath);
      const stat = await vscode.workspace.fs.stat(targetUri);

      let fileTypeString: 'file' | 'directory' | 'symbolic_link' | 'unknown' = 'unknown';
      let size: number | undefined = undefined;

      switch (stat.type) {
        case FileType.File:
          fileTypeString = 'file';
          size = stat.size;
          break;
        case FileType.Directory:
          fileTypeString = 'directory';
          break;
        case FileType.SymbolicLink:
          fileTypeString = 'symbolic_link';
          break;
        default:
          fileTypeString = 'unknown';
      }

      const resultData = {
          name: path.basename(filePath),
          path: filePath, // Keep the original relative path
          type: fileTypeString,
          size: size,
          mtime: stat.mtime,
          // ctime: stat.ctime, // Optional
      };

      // Validate before returning
      const validationResult = fileStatSchema.safeParse(resultData);
       if (!validationResult.success) {
          console.error("statItemsTool validation error:", validationResult.error);
          throw new Error("Internal error: Failed to format stat result.");
      }

      fileResult = { success: true, path: filePath, stat: validationResult.data };

        } catch (error: any) {
          let errorMessage = `Failed to get stat for '${filePath}'.`;
           if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
            errorMessage = `Error: File or directory not found at path '${filePath}'.`;
          } else if (error.message.includes('Access denied')) {
              errorMessage = error.message; // Use the specific access denied message
          } else if (error instanceof Error) {
            errorMessage += ` Reason: ${error.message}`;
          } else {
            errorMessage += ` Unknown error: ${String(error)}`;
          }
          console.error(`statItemsTool Error for ${filePath}: ${error}`);
          fileResult = { success: false, path: filePath, error: errorMessage };
        }
        results.push(fileResult);
    } // End loop

    // Send final status (optional)
    const successfulStats = results.filter(r => r.success).length;
    const finalMessage = `Got stats for ${successfulStats}/${paths.length} items.`;
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'statItemsTool', status: 'complete', message: finalMessage });
    }

     // Validate results array before returning
    const validationResult = z.array(statItemResultSchema).safeParse(results);
    if (!validationResult.success) {
        console.error("statItemsTool validation error:", validationResult.error);
        // Return a general error if validation fails
        return { success: false, error: "Internal error: Failed to format stat results.", results: [] };
    }

    // Determine overall success (e.g., if at least one stat succeeded)
    const overallSuccess = results.some(r => r.success);

    return { success: overallSuccess, results: validationResult.data };
  },
});