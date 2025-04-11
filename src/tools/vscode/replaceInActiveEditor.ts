import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';

export const replaceInActiveEditorTool = tool({
  description: 'Replaces the currently selected text in the active editor with the provided new text. If no text is selected, it inserts the text at the cursor position.',
  parameters: z.object({
      newText: z.string().describe('The text to replace the selection with or insert.'),
      // Optional: Add range parameter for more specific replacements later
      // range: z.object({
      //     startLine: z.number().int(),
      //     startChar: z.number().int(),
      //     endLine: z.number().int(),
      //     endChar: z.number().int(),
      // }).optional().describe('Specific range to replace. If omitted, uses current selection.')
  }),
  execute: async ({ newText /*, range */ }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'replaceInActiveEditorTool', status: 'processing', message: `Preparing to replace text in active editor...` });
    }
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        throw new Error('No active text editor found.');
      }

      // Determine the range to replace: either the provided range or the current selection
      // const targetRange = range
      //     ? new vscode.Range(range.startLine, range.startChar, range.endLine, range.endChar)
      //     : editor.selection;

      const targetRange = editor.selection; // Use current selection for now

      // Perform the edit
      const success = await editor.edit(editBuilder => {
          editBuilder.replace(targetRange, newText);
      });

      if (!success) {
          throw new Error('Failed to apply edit to the document.');
      }

      const message = targetRange.isEmpty
          ? `Inserted text successfully at cursor position.`
          : `Replaced selection successfully.`;

       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'replaceInActiveEditorTool', status: 'complete', message: message });
       }
      return { success: true, message: message };

    } catch (error: any) {
      let errorMessage = `Failed to replace text in active editor.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`replaceInActiveEditorTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'replaceInActiveEditorTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});