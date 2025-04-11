import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';

export const showInformationMessageTool = tool({
  description: 'Displays an informational message to the user in the VS Code notification area.',
  parameters: z.object({
    message: z.string().describe('The message to display.'),
    // Optional: Add modal and items later if needed for more complex interactions
    // modal: z.boolean().optional().default(false).describe('Whether the message should be modal.'),
    // items: z.array(z.string()).optional().describe('Optional action items (buttons) to show with the message.')
  }),
  execute: async ({ message /*, modal = false, items */ }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'showInformationMessageTool', status: 'processing', message: `Showing info message: "${message.substring(0, 50)}..."` });
    }
    try {
      // For simplicity, not handling items or modal return values currently
      await vscode.window.showInformationMessage(message /*, { modal: modal }, ...(items || []) */);

       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'showInformationMessageTool', status: 'complete', message: `Info message shown.` });
       }
      return { success: true, message: 'Information message displayed successfully.' };

    } catch (error: any) {
      let errorMessage = `Failed to show information message.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`showInformationMessageTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'showInformationMessageTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});