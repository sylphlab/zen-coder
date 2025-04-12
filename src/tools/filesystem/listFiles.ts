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
  description: 'List files and directories within one or more specified paths in the workspace. Use relative paths. Can list recursively and optionally include stats.',
  parameters: z.object({
    paths: z.array(z.string()).min(1).describe('An array of relative directory paths within the workspace.'),
    recursive: z.boolean().optional().default(false).describe('Whether to list files recursively for each path.'),
    maxDepth: z.number().int().positive().optional().default(5).describe('Maximum recursion depth if recursive is true. Defaults to 5.'),
    includeStats: z.boolean().optional().default(true).describe('Whether to include file status information (type, size, mtime) in the result. Defaults to true.'),
  }),
  // Modify execute signature to accept context including StreamData and toolCallId
  execute: async ({ paths, recursive = false, maxDepth = 5, includeStats = true }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const resultsByPath: { [key: string]: { success: boolean; entries?: z.infer<typeof fileStatSchema>[]; error?: string } } = {};

    if (!vscode.workspace.workspaceFolders) {
      return { success: false, error: 'No workspace is open.', results: {} };
    }
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'listFilesTool', status: 'processing', message: `Starting listing for ${paths.length} path(s)... (Recursive: ${recursive}, Stats: ${includeStats})` });
    }

    for (const dirPath of paths) {
        try {
            // Ensure the path is relative and within the workspace for each path
            const absolutePath = path.resolve(workspaceUri.fsPath, dirPath);
            if (!absolutePath.startsWith(workspaceUri.fsPath)) {
                throw new Error(`Access denied: Path '${dirPath}' is outside the workspace.`);
            }

            const directoryUri = Uri.joinPath(workspaceUri, dirPath);

            // Send status update for the current path
            if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'listFilesTool', status: 'processing', message: `Listing path: ${dirPath}` });
            }

            const pathEntries: z.infer<typeof fileStatSchema>[] = [];
            let pathProcessed = 0;

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

              if (includeStats) {
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
                      // Fallback type determination if stat fails but readDirectory succeeded
                      switch (type) {
                          case FileType.File: fileTypeString = 'file'; break;
                          case FileType.Directory: fileTypeString = 'directory'; break;
                          case FileType.SymbolicLink: fileTypeString = 'symbolic_link'; break;
                          default: fileTypeString = 'unknown';
                      }
                  }
              } else {
                   // Determine type without stat if stats are not included
                   switch (type) {
                       case FileType.File: fileTypeString = 'file'; break;
                       case FileType.Directory: fileTypeString = 'directory'; break;
                       case FileType.SymbolicLink: fileTypeString = 'symbolic_link'; break;
                       default: fileTypeString = 'unknown';
                   }
              }

              // Add the entry using the calculated relative path
              // Add the entry using the calculated relative path
              const entryData: z.infer<typeof fileStatSchema> = {
                  name: entryRelativePath, // Use relative path as name for uniqueness across recursive calls
                  type: fileTypeString,
                  ...(includeStats && { size: size }), // Conditionally include size
                  ...(includeStats && { mtime: mtime }), // Conditionally include mtime
              };
              pathEntries.push(entryData);
              pathProcessed++;

              // Send progress update periodically for the current path
              if (pathProcessed % 50 === 0 && data && toolCallId) {
                  data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'listFilesTool', status: 'processing', message: `Path ${dirPath}: Processed ${pathProcessed} entries...` });
              }

              // Recurse if it's a directory and recursive flag is set
              if (fileTypeString === 'directory' && recursive) {
                  await listDirRecursive(entryUri, entryRelativePath, currentDepth + 1);
              }
          }
      };

      // Start the recursive listing from the initial directory URI and relative path
            // Start the recursive listing for the current path
            await listDirRecursive(directoryUri, dirPath === '.' ? '' : dirPath, 1);

            // Validate the output for the current path
            const validationResult = z.array(fileStatSchema).safeParse(pathEntries);
            if (!validationResult.success) {
                console.error(`listFilesTool validation error for path ${dirPath}:`, validationResult.error);
                throw new Error(`Internal error: Failed to format directory listing for path ${dirPath}.`);
            }

            resultsByPath[dirPath] = { success: true, entries: validationResult.data };

             // Send path completion status
            if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'listFilesTool', status: 'processing', message: `Path ${dirPath}: Finished. Found ${pathEntries.length} entries.` });
            }

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
            console.error(`listFilesTool Error for path ${dirPath}: ${error}`);
            resultsByPath[dirPath] = { success: false, error: errorMessage };
             // Send path error status
            if (data && toolCallId) {
                data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'listFilesTool', status: 'error', message: `Error listing path ${dirPath}: ${errorMessage}` });
            }
        }
    } // End loop over paths

    // Send final overall status
    const successfulPaths = Object.values(resultsByPath).filter(r => r.success).length;
    const finalMessage = `Finished listing ${successfulPaths}/${paths.length} paths.`;
     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'listFilesTool', status: 'complete', message: finalMessage });
    }

    // Determine overall success (e.g., if at least one path succeeded)
    const overallSuccess = Object.values(resultsByPath).some(r => r.success);

    return { success: overallSuccess, results: resultsByPath };
  },
});