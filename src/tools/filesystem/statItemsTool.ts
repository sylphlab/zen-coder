import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';
import { Uri, FileType } from 'vscode';
import path from 'path';

// Define the structure for file/directory stats
const fileStatSchema = z.object({
  name: z.string().describe('The name of the file or directory.'),
  path: z.string().describe('The relative path provided.'),
  type: z.enum(['file', 'directory', 'symbolic_link', 'unknown']),
  size: z.number().optional().describe('Size in bytes (only for files)'),
  mtime: z.number().optional().describe('Modification time (Unix timestamp ms)'),
});

// Define schema for the result of a single stat operation
const statResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  stat: fileStatSchema.optional(),
  error: z.string().optional(),
});

export const statItemsTool = tool({
  description: 'Get status information (type, size, modification time) for one or more files or directories in the workspace. Use relative paths.',
  parameters: z.object({
    paths: z.array(z.string()).min(1).describe('An array of relative paths to the files or directories within the workspace.'),
  }),
  execute: async ({ paths }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const results: z.infer<typeof statResultSchema>[] = [];

    if (!vscode.workspace.workspaceFolders) {
      return { success: false, error: 'No workspace is open.', results: [] };
    }
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'statItemsTool', status: 'processing', message: `Getting stats for ${paths.length} item(s)...` });
    }

    for (const itemPath of paths) {
      let itemResult: z.infer<typeof statResultSchema> = { path: itemPath, success: false };

      // Send status update for the current item
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'statItemsTool', status: 'processing', message: `Getting stat for: ${itemPath}` });
      }

      try {
        // Ensure the path is relative and within the workspace
        const absolutePath = path.resolve(workspaceUri.fsPath, itemPath);
        if (!absolutePath.startsWith(workspaceUri.fsPath)) {
            throw new Error(`Access denied: Path '${itemPath}' is outside the workspace.`);
        }

        const itemUri = Uri.joinPath(workspaceUri, itemPath);
        const stat = await vscode.workspace.fs.stat(itemUri);

        let fileTypeString: 'file' | 'directory' | 'symbolic_link' | 'unknown' = 'unknown';
        let size: number | undefined = undefined;
        switch (stat.type) {
            case FileType.File: fileTypeString = 'file'; size = stat.size; break;
            case FileType.Directory: fileTypeString = 'directory'; break;
            case FileType.SymbolicLink: fileTypeString = 'symbolic_link'; break;
            default: fileTypeString = 'unknown';
        }

        const statData: z.infer<typeof fileStatSchema> = {
            name: path.basename(itemPath), // Use basename for the name field
            path: itemPath, // Keep the original relative path
            type: fileTypeString,
            size: size,
            mtime: stat.mtime,
        };

        // Validate stat before adding
        const statValidation = fileStatSchema.safeParse(statData);
        if (!statValidation.success) {
            console.warn(`statItemsTool: Stat validation failed for ${itemPath}:`, statValidation.error);
            throw new Error(`Internal error: Failed to format stat data for ${itemPath}.`);
        }

        itemResult = { success: true, path: itemPath, stat: statValidation.data };

      } catch (error: any) {
        let errorMessage = `Failed to get stat for '${itemPath}'.`;
        if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
          errorMessage = `Error: File or directory not found at path '${itemPath}'.`;
        } else if (error.message.includes('Access denied')) {
            errorMessage = error.message; // Use the specific access denied message
        } else if (error instanceof Error) {
          errorMessage += ` Reason: ${error.message}`;
        } else {
          errorMessage += ` Unknown error: ${String(error)}`;
        }
        console.error(`statItemsTool Error for ${itemPath}: ${error}`);
        itemResult = { success: false, path: itemPath, error: errorMessage };
      }
      results.push(itemResult);
    } // End loop

    // Send final status
    const successfulStats = results.filter(r => r.success).length;
    const finalMessage = `Got stats for ${successfulStats}/${paths.length} items.`;
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'statItemsTool', status: 'complete', message: finalMessage });
    }

    // Validate results array before returning
    const validationResult = z.array(statResultSchema).safeParse(results);
    if (!validationResult.success) {
        console.error("statItemsTool validation error:", validationResult.error);
        return { success: false, error: "Internal error: Failed to format stat results.", results: [] };
    }

    // Determine overall success
    const overallSuccess = results.some(r => r.success);

    return { success: overallSuccess, results: validationResult.data };
  },
});