import { z } from 'zod';
import { tool, StreamData } from 'ai'; // Import StreamData
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';
import { Buffer } from 'buffer'; // Needed for hex/base64 encoding

// Define schema for individual file write operation
const fileWriteSchema = z.object({
  path: z.string().describe('The relative path to the file within the workspace.'),
  content: z.string().describe('The content to write or append.'),
});

// Define schema for the result of a single file write operation
const writeFileResultSchema = z.object({
  path: z.string(),
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});


export const writeFilesTool = tool({
  description: 'Write or append content to one or more files in the workspace using specified encoding. Creates files if they do not exist. Use relative paths.',
  parameters: z.object({
    items: z.array(fileWriteSchema).min(1).describe('An array of file objects, each specifying a path and content.'),
    encoding: z.enum(['utf8', 'hex', 'base64']).optional().default('utf8').describe("Encoding for the input content for ALL files. Defaults to 'utf8'."),
    append: z.boolean().optional().default(false).describe('If true, append content to the files. If false (default), overwrite the files.'),
  }),
  // Modify execute signature
  execute: async ({ items, encoding = 'utf8', append = false }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const results: z.infer<typeof writeFileResultSchema>[] = [];
    const operation = append ? 'Appending to' : 'Writing to';

    if (!vscode.workspace.workspaceFolders) {
      // Return a general error if no workspace is open, affecting all files
      return { success: false, error: 'No workspace is open.', results: [] };
    }
    const workspaceUri = vscode.workspace.workspaceFolders[0].uri;

    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'writeFilesTool', status: 'processing', message: `${operation} ${items.length} item(s)... (Encoding: ${encoding})` });
    }

    for (const item of items) {
        const { path: filePath, content } = item;
        let fileResult: z.infer<typeof writeFileResultSchema> = { path: filePath, success: false };

        // Send status update for the current file
        if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'writeFilesTool', status: 'processing', message: `${operation} file: ${filePath}` });
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
          throw new Error(`Writing to '.git' directory is not allowed.`);
      }

      const fileUri = Uri.joinPath(workspaceUri, filePath);
      let uint8Array: Uint8Array;

      // Encode content based on specified encoding
      try {
        if (encoding === 'utf8') {
          uint8Array = new TextEncoder().encode(content);
        } else if (encoding === 'hex' || encoding === 'base64') {
          // Use Buffer for hex/base64 encoding
          uint8Array = Buffer.from(content, encoding);
        } else {
            // Should not happen due to zod enum, but as fallback:
             throw new Error(`Unsupported encoding: ${encoding}`);
        }
      } catch (encodeError: any) {
        throw new Error(`Invalid content for encoding '${encoding}': ${encodeError.message}`);
      }

      if (append) {
        // Read existing content, append new content, then write
        let existingContent = new Uint8Array();
        try {
          existingContent = await vscode.workspace.fs.readFile(fileUri);
           if (data && toolCallId) {
               data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'writeFilesTool', status: 'processing', message: `Read existing content from ${filePath}` });
           }
        } catch (readError: any) {
          // If file not found, it's okay, we'll create it by writing
          if (!(readError instanceof vscode.FileSystemError && readError.code === 'FileNotFound')) {
            throw readError; // Re-throw other read errors
          }
           if (data && toolCallId) {
               data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'writeFilesTool', status: 'processing', message: `File ${filePath} not found, creating new file.` });
           }
        }
        // Combine existing and new content
        const combinedContent = new Uint8Array(existingContent.length + uint8Array.length);
        combinedContent.set(existingContent, 0);
        combinedContent.set(uint8Array, existingContent.length);
        await vscode.workspace.fs.writeFile(fileUri, combinedContent);
        fileResult = { success: true, path: filePath, message: `Content appended to '${filePath}' successfully.` };
      } else {
        // Overwrite mode
        await vscode.workspace.fs.writeFile(fileUri, uint8Array);
        fileResult = { success: true, path: filePath, message: `File '${filePath}' written successfully (overwritten).` };
      }
        } catch (error: any) {
          let errorMessage = `Failed to ${append ? 'append to' : 'write'} file '${filePath}'.`;
           if (error.message.includes('Access denied') || error.message.includes('not allowed') || error.message.startsWith('Invalid content for encoding')) {
              errorMessage = error.message; // Use the specific error message
          } else if (error instanceof Error) {
            errorMessage += ` Reason: ${error.message}`;
          } else {
            errorMessage += ` Unknown error: ${String(error)}`;
          }
          console.error(`writeFilesTool Error for ${filePath}: ${error}`);
          // Send error status via stream if possible
           if (data && toolCallId) {
               data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'writeFilesTool', status: 'error', message: errorMessage });
           }
          fileResult = { success: false, path: filePath, error: errorMessage };
        }
        results.push(fileResult);
    } // End loop

    // Send final status
    const successfulWrites = results.filter(r => r.success).length;
    const finalMessage = `${append ? 'Appended' : 'Wrote'} ${successfulWrites}/${items.length} items.`;
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'writeFilesTool', status: 'complete', message: finalMessage });
    }

     // Validate results array before returning
    const validationResult = z.array(writeFileResultSchema).safeParse(results);
    if (!validationResult.success) {
        console.error("writeFilesTool validation error:", validationResult.error);
        // Return a general error if validation fails
        return { success: false, error: "Internal error: Failed to format write results.", results: [] };
    }

    // Determine overall success (e.g., if at least one write succeeded)
    const overallSuccess = results.some(r => r.success);

    return { success: overallSuccess, results: validationResult.data };
  },
});