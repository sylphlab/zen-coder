import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';

export const formatDocumentTool = tool({
  description: 'Formats the currently active text editor using the configured default formatter.',
  parameters: z.object({}), // No parameters needed
  execute: async ({}, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'formatDocumentTool', status: 'processing', message: `Attempting to format active document...` });
    }
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        throw new Error('No active text editor found to format.');
      }

      // Execute the formatting command
      await vscode.commands.executeCommand('editor.action.formatDocument');

      // It's hard to know if formatting actually happened or if a formatter is configured.
      // We just know the command was executed.
      const message = `Formatting command executed for ${vscode.workspace.asRelativePath(editor.document.uri, false)}.`;
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'formatDocumentTool', status: 'complete', message: message });
       }
      return { success: true, message: message };

    } catch (error: any) {
      let errorMessage = `Failed to execute document formatting command.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`formatDocumentTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'formatDocumentTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});