import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';
import path from 'path';

export const openFileTool = tool({
  description: 'Opens a specified file in the VS Code editor. Use relative paths from the workspace root.',
  parameters: z.object({
    filePath: z.string().describe('The relative path to the file within the workspace to open.'),
    // Optional: Add options like viewColumn, preview, selection later
    // viewColumn: z.enum(['Active', 'Beside', 'One', 'Two', 'Three', ...]).optional(),
    // preview: z.boolean().optional(),
    // selection: z.object({ startLine: z.number(), startChar: z.number(), endLine: z.number(), endChar: z.number() }).optional(),
  }),
  execute: async ({ filePath /*, viewColumn, preview, selection */ }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'openFileTool', status: 'processing', message: `Attempting to open file: ${filePath}...` });
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

      const fileUri = vscode.Uri.joinPath(workspaceUri, filePath);

      // Check if file exists before trying to open
      try {
          await vscode.workspace.fs.stat(fileUri);
      } catch (error: any) {
           if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
              throw new Error(`File not found at path '${filePath}'. Cannot open.`);
          }
          throw error; // Re-throw other stat errors
      }

      // Open the document
      const document = await vscode.workspace.openTextDocument(fileUri);
      // Show the document in an editor
      await vscode.window.showTextDocument(document /*, { viewColumn: vscode.ViewColumn[viewColumn], preview: preview, selection: selection ? new vscode.Range(...) : undefined } */);

      const message = `Successfully opened file: ${filePath}`;
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'openFileTool', status: 'complete', message: message });
       }
      return { success: true, message: message };

    } catch (error: any) {
      let errorMessage = `Failed to open file '${filePath}'.`;
      if (error.message.includes('not found')) {
          errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`openFileTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'openFileTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});