import { z } from 'zod';
import { tool, StreamData } from 'ai'; // Import StreamData
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
    recursive: z.boolean().optional().default(false).describe('Whether to list files recursively.'),
    maxDepth: z.number().int().positive().optional().default(5).describe('Maximum recursion depth if recursive is true. Defaults to 5.'),
  }),
  // Modify execute signature to accept context including StreamData and toolCallId
  execute: async ({ dirPath = '.', recursive = false, maxDepth = 5 }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
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

      // Send initial status
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'listFilesTool', status: 'processing', message: `Starting listing for: ${dirPath} (Recursive: ${recursive}, Max Depth: ${maxDepth})` });
      }

      const allEntries: z.infer<typeof fileStatSchema>[] = [];
      let totalProcessed = 0;

      // Recursive function to list directory contents
      const listDirRecursive = async (currentUri: Uri, currentRelativePath: string, currentDepth: number) => {
          if (currentDepth > maxDepth) {
              if (data && toolCallId) {
                  data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'listFilesTool', status: 'warning', message: `Max depth (${maxDepth}) reached at: ${currentRelativePath}` });
              }
              return; // Stop recursion if max depth is exceeded
          }

          let entries: [string, FileType][];
          try {
              entries = await vscode.workspace.fs.readDirectory(currentUri);
          } catch (readDirError: any) {
               console.error(`listFilesTool: Error reading directory ${currentRelativePath}: ${readDirError}`);
               if (data && toolCallId) {
                   data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'listFilesTool', status: 'warning', message: `Error reading directory: ${currentRelativePath}` });
               }
               return; // Stop processing this branch
          }

          for (const [name, type] of entries) {
              const entryUri = Uri.joinPath(currentUri, name);
              // Construct the relative path from the *original* dirPath requested by the user
              const entryRelativePath = path.join(currentRelativePath, name).replace(/\\/g, '/');
              let fileTypeString: 'file' | 'directory' | 'symbolic_link' | 'unknown' = 'unknown';
              let size: number | undefined = undefined;
              let mtime: number | undefined = undefined;

              try {
                  const stat = await vscode.workspace.fs.stat(entryUri);
                  switch (stat.type) {
                      case FileType.File: fileTypeString = 'file'; size = stat.size; break;
                      case FileType.Directory: fileTypeString = 'directory'; break;
                      case FileType.SymbolicLink: fileTypeString = 'symbolic_link'; break;
                      default: fileTypeString = 'unknown';
                  }
                  mtime = stat.mtime;
              } catch (statError) {
                  console.error(`listFilesTool: Could not stat ${entryRelativePath}: ${statError}`);
                  switch (type) { // Fallback
                      case FileType.File: fileTypeString = 'file'; break;
                      case FileType.Directory: fileTypeString = 'directory'; break;
                      case FileType.SymbolicLink: fileTypeString = 'symbolic_link'; break;
                      default: fileTypeString = 'unknown';
                  }
              }

              // Add the entry using the calculated relative path
              allEntries.push({ name: entryRelativePath, type: fileTypeString, size, mtime });
              totalProcessed++;

              // Send progress update periodically
              if (totalProcessed % 50 === 0 && data && toolCallId) {
                  data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'listFilesTool', status: 'processing', message: `Processed ${totalProcessed} entries...` });
              }

              // Recurse if it's a directory and recursive flag is set
              if (fileTypeString === 'directory' && recursive) {
                  await listDirRecursive(entryUri, entryRelativePath, currentDepth + 1);
              }
          }
      };

      // Start the recursive listing from the initial directory URI and relative path
      await listDirRecursive(directoryUri, dirPath === '.' ? '' : dirPath, 1);

      // Send final count status
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'listFilesTool', status: 'processing', message: `Finished processing. Found ${allEntries.length} total entries.` });
      }

      // Validate the output against the schema before returning
      const validationResult = z.array(fileStatSchema).safeParse(allEntries);
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