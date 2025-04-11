import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';

export const showWarningMessageTool = tool({
  description: 'Displays a warning message to the user in the VS Code notification area.',
  parameters: z.object({
    message: z.string().describe('The warning message to display.'),
    // Optional: Add modal and items later
  }),
  execute: async ({ message }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'showWarningMessageTool', status: 'processing', message: `Showing warning message: "${message.substring(0, 50)}..."` });
    }
    try {
      await vscode.window.showWarningMessage(message); // Simplified call

       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'showWarningMessageTool', status: 'complete', message: `Warning message shown.` });
       }
      return { success: true, message: 'Warning message displayed successfully.' };

    } catch (error: any) {
      let errorMessage = `Failed to show warning message.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`showWarningMessageTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'showWarningMessageTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});