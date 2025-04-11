import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';

export const showErrorMessageTool = tool({
  description: 'Displays an error message to the user in the VS Code notification area.',
  parameters: z.object({
    message: z.string().describe('The error message to display.'),
    // Optional: Add modal and items later
  }),
  execute: async ({ message }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'showErrorMessageTool', status: 'processing', message: `Showing error message: "${message.substring(0, 50)}..."` });
    }
    try {
      await vscode.window.showErrorMessage(message); // Simplified call

       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'showErrorMessageTool', status: 'complete', message: `Error message shown.` });
       }
      return { success: true, message: 'Error message displayed successfully.' };

    } catch (error: any) {
      let errorMessage = `Failed to show error message.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`showErrorMessageTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'showErrorMessageTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});