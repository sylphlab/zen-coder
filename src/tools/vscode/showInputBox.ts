import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';

export const showInputBoxTool = tool({
  description: 'Shows an input box to the user, allowing them to enter text. Returns the entered text or undefined if cancelled.',
  parameters: z.object({
    prompt: z.string().optional().describe('An optional prompt message to display.'),
    placeHolder: z.string().optional().describe('An optional placeholder text in the input box.'),
    value: z.string().optional().describe('An optional pre-filled value for the input box.'),
    password: z.boolean().optional().default(false).describe('Set to true to mask the input (for passwords).'),
    ignoreFocusOut: z.boolean().optional().default(true).describe('Set to true (default) to keep the input box open when focus moves.'),
  }),
  execute: async (options, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'showInputBoxTool', status: 'processing', message: `Showing input box: "${options.prompt?.substring(0, 30) ?? ''}..."` });
    }
    try {
      // Show the input box and wait for user input
      const userInput = await vscode.window.showInputBox({
          prompt: options.prompt,
          placeHolder: options.placeHolder,
          value: options.value,
          password: options.password,
          ignoreFocusOut: options.ignoreFocusOut,
      });

      const message = userInput === undefined ? 'Input box cancelled by user.' : 'User provided input.';
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'showInputBoxTool', status: 'complete', message: message });
       }
      // Return the user's input (which could be undefined if they cancelled)
      return { success: true, value: userInput, message: message };

    } catch (error: any) {
      let errorMessage = `Failed to show input box.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`showInputBoxTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'showInputBoxTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});