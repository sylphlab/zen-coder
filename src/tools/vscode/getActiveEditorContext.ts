import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';

export const getActiveEditorContextTool = tool({
  description: 'Gets information about the currently active text editor, including its file path, language ID, and the currently selected text.',
  parameters: z.object({}), // No parameters needed
  execute: async ({}, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'getActiveEditorContextTool', status: 'processing', message: `Getting active editor context...` });
    }
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        if (data && toolCallId) {
            data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'getActiveEditorContextTool', status: 'complete', message: `No active text editor found.` });
        }
        return { success: true, context: null, message: 'No active text editor found.' };
      }

      const document = editor.document;
      const selection = editor.selection;
      const selectedText = document.getText(selection);
      const relativePath = vscode.workspace.asRelativePath(document.uri, false);

      const contextInfo = {
        filePath: relativePath,
        languageId: document.languageId,
        selectedText: selectedText,
        selection: { // Provide detailed selection range
            startLine: selection.start.line,
            startChar: selection.start.character,
            endLine: selection.end.line,
            endChar: selection.end.character,
            isEmpty: selection.isEmpty
        }
      };

      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'getActiveEditorContextTool', status: 'complete', message: `Context retrieved for ${relativePath}.` });
      }
      return { success: true, context: contextInfo };

    } catch (error: any) {
      let errorMessage = `Failed to get active editor context.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`getActiveEditorContextTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'getActiveEditorContextTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});