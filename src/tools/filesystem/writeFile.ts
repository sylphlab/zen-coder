import { z } from 'zod';
import { tool, StreamData } from 'ai'; // Import StreamData
import * as vscode from 'vscode';
import { Uri } from 'vscode';
import path from 'path';
import { Buffer } from 'buffer'; // Needed for hex/base64 encoding

export const writeFileTool = tool({
  description: 'Write or append content to a file in the workspace using specified encoding. Creates the file if it does not exist. Use relative paths.',
  parameters: z.object({
    filePath: z.string().describe('The relative path to the file within the workspace.'),
    content: z.string().describe('The content to write or append.'),
    encoding: z.enum(['utf8', 'hex', 'base64']).optional().default('utf8').describe("Encoding for the input content. Defaults to 'utf8'."),
    append: z.boolean().optional().default(false).describe('If true, append content to the file. If false (default), overwrite the file.'),
  }),
  // Modify execute signature
  execute: async ({ filePath, content, encoding = 'utf8', append = false }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const operation = append ? 'Appending to' : 'Writing to';
    // Send initial status
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'writeFileTool', status: 'processing', message: `${operation} file: ${filePath} (Encoding: ${encoding})` });
    }

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
               data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'writeFileTool', status: 'processing', message: `Read existing content from ${filePath}` });
           }
        } catch (readError: any) {
          // If file not found, it's okay, we'll create it by writing
          if (!(readError instanceof vscode.FileSystemError && readError.code === 'FileNotFound')) {
            throw readError; // Re-throw other read errors
          }
           if (data && toolCallId) {
               data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'writeFileTool', status: 'processing', message: `File ${filePath} not found, creating new file.` });
           }
        }
        // Combine existing and new content
        const combinedContent = new Uint8Array(existingContent.length + uint8Array.length);
        combinedContent.set(existingContent, 0);
        combinedContent.set(uint8Array, existingContent.length);
        await vscode.workspace.fs.writeFile(fileUri, combinedContent);
        return { success: true, message: `Content appended to '${filePath}' successfully.` };
      } else {
        // Overwrite mode
        await vscode.workspace.fs.writeFile(fileUri, uint8Array);
        return { success: true, message: `File '${filePath}' written successfully (overwritten).` };
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
      console.error(`writeFileTool Error: ${error}`);
      // Send error status via stream if possible
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'writeFileTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});