import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';

export const saveActiveFileTool = tool({
  description: 'Saves the currently active text editor.',
  parameters: z.object({}), // No parameters needed
  execute: async ({}, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'saveActiveFileTool', status: 'processing', message: `Attempting to save active file...` });
    }
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        throw new Error('No active text editor found to save.');
      }

      // Save the document
      const success = await editor.document.save();

      if (!success) {
          // This might happen if there are errors preventing save, e.g., file system issues
          throw new Error('Failed to save the document. Check for problems in VS Code.');
      }

      const message = `Successfully saved ${vscode.workspace.asRelativePath(editor.document.uri, false)}.`;
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'saveActiveFileTool', status: 'complete', message: message });
       }
      return { success: true, message: message };

    } catch (error: any) {
      let errorMessage = `Failed to save active file.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`saveActiveFileTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'saveActiveFileTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});