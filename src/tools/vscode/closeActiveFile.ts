import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';

export const closeActiveFileTool = tool({
  description: 'Closes the currently active text editor tab. If the file has unsaved changes, the user might be prompted by VS Code.',
  parameters: z.object({}), // No parameters needed
  execute: async ({}, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'closeActiveFileTool', status: 'processing', message: `Attempting to close active file...` });
    }
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        // If no editor is active, consider it a success (nothing to close)
         if (data && toolCallId) {
             data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'closeActiveFileTool', status: 'complete', message: 'No active editor to close.' });
         }
        return { success: true, message: 'No active editor to close.' };
      }

      const fileName = vscode.workspace.asRelativePath(editor.document.uri, false);

      // Execute the command to close the active editor
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

      // We assume the command succeeded, though VS Code might prompt the user for unsaved changes.
      const message = `Close command executed for active editor (${fileName}).`;
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'closeActiveFileTool', status: 'complete', message: message });
       }
      return { success: true, message: message };

    } catch (error: any) {
      let errorMessage = `Failed to execute close active editor command.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`closeActiveFileTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'closeActiveFileTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});