import { z } from 'zod';
import { tool } from 'ai';
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

export const getStatTool = tool({
  description: 'Get status information (type, size, modification time) for a specific file or directory within the workspace. Use relative paths from the workspace root.',
  parameters: z.object({
    filePath: z.string().describe('The relative path to the file or directory within the workspace.'),
  }),
  execute: async ({ filePath }) => {
    try {
      if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace is open.');
      }
      const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

      // Ensure the path is relative and within the workspace
      const absolutePath = path.resolve(workspaceUri.fsPath, filePath);
      if (!absolutePath.startsWith(workspaceUri.fsPath)) {
          throw new Error(`Access denied: Path '${filePath}' is outside the workspace.`);
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
          path: filePath,
          type: fileTypeString,
          size: size,
          mtime: stat.mtime,
          // ctime: stat.ctime, // Optional
      };

      // Validate before returning
      const validationResult = fileStatSchema.safeParse(resultData);
       if (!validationResult.success) {
          console.error("getStatTool validation error:", validationResult.error);
          throw new Error("Internal error: Failed to format stat result.");
      }

      return { success: true, stat: validationResult.data };

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
      console.error(`getStatTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});