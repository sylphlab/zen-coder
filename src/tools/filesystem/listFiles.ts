import { z } from 'zod';
import { tool } from 'ai';
import * as vscode from 'vscode';
import { FileType, Uri } from 'vscode';
import path from 'path';

// Define the structure for file/directory stats
const fileStatSchema = z.object({
  name: z.string(),
  type: z.enum(['file', 'directory', 'symbolic_link', 'unknown']),
  size: z.number().optional().describe('Size in bytes (only for files)'),
  mtime: z.number().optional().describe('Modification time (Unix timestamp ms)'),
  // ctime: z.number().optional().describe('Creation time (Unix timestamp ms)'), // ctime might not be reliable across platforms
});

export const listFilesTool = tool({
  description: 'List files and directories within a specified path in the workspace, including basic stats (type, size, mtime). Use relative paths from the workspace root. Defaults to listing the workspace root if no path is provided.',
  parameters: z.object({
    dirPath: z.string().optional().default('.').describe('The relative path to the directory within the workspace. Defaults to the workspace root.'),
  }),
  execute: async ({ dirPath = '.' }) => {
    try {
      if (!vscode.workspace.workspaceFolders) {
        throw new Error('No workspace is open.');
      }
      const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

      // Ensure the path is relative and within the workspace
      const absolutePath = path.resolve(workspaceUri.fsPath, dirPath);
      if (!absolutePath.startsWith(workspaceUri.fsPath)) {
          throw new Error(`Access denied: Path '${dirPath}' is outside the workspace.`);
      }

      const directoryUri = Uri.joinPath(workspaceUri, dirPath);
      const entries = await vscode.workspace.fs.readDirectory(directoryUri);

      const detailedEntries = await Promise.all(
        entries.map(async ([name, type]) => {
          const entryUri = Uri.joinPath(directoryUri, name);
          let fileTypeString: 'file' | 'directory' | 'symbolic_link' | 'unknown' = 'unknown';
          let size: number | undefined = undefined;
          let mtime: number | undefined = undefined;

          try {
              const stat = await vscode.workspace.fs.stat(entryUri);
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
              mtime = stat.mtime;
              // ctime = stat.ctime; // Optional: include if needed and reliable
          } catch (statError) {
              console.error(`listFilesTool: Could not stat ${name}: ${statError}`);
              // Fallback based on readDirectory type if stat fails
               switch (type) {
                  case FileType.File: fileTypeString = 'file'; break;
                  case FileType.Directory: fileTypeString = 'directory'; break;
                  case FileType.SymbolicLink: fileTypeString = 'symbolic_link'; break;
                  default: fileTypeString = 'unknown';
              }
          }


          return { name, type: fileTypeString, size, mtime };
        })
      );

      // Validate the output against the schema before returning
      const validationResult = z.array(fileStatSchema).safeParse(detailedEntries);
      if (!validationResult.success) {
          console.error("listFilesTool validation error:", validationResult.error);
          throw new Error("Internal error: Failed to format directory listing.");
      }

      return { success: true, entries: validationResult.data };

    } catch (error: any) {
      let errorMessage = `Failed to list files in '${dirPath}'.`;
       if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
        errorMessage = `Error: Directory not found at path '${dirPath}'.`;
      } else if (error.message.includes('Access denied')) {
          errorMessage = error.message; // Use the specific access denied message
      } else if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`listFilesTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});