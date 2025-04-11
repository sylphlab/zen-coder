import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as vscode from 'vscode';

// Define the schema for Quick Pick items more strictly
const quickPickItemSchema = z.object({
    label: z.string(),
    description: z.string().optional(),
    detail: z.string().optional(),
    picked: z.boolean().optional(),
    alwaysShow: z.boolean().optional(),
    // We cannot serialize functions, so command execution needs separate handling if needed
});

export const showQuickPickTool = tool({
  description: 'Shows a selection list (Quick Pick) to the user, allowing them to select one or multiple items. Returns the selected item(s) or undefined if cancelled.',
  parameters: z.object({
    items: z.array(quickPickItemSchema).min(1).describe('An array of items (or item labels as strings) to show in the Quick Pick list.'),
    // Options for Quick Pick
    canPickMany: z.boolean().optional().default(false).describe('Set to true to allow multiple selections.'),
    ignoreFocusOut: z.boolean().optional().default(true).describe('Set to true (default) to keep the Quick Pick open when focus moves.'),
    matchOnDescription: z.boolean().optional().default(true).describe('Set to true (default) to match on item descriptions.'),
    matchOnDetail: z.boolean().optional().default(true).describe('Set to true (default) to match on item details.'),
    placeHolder: z.string().optional().describe('An optional placeholder text for the Quick Pick input.'),
    title: z.string().optional().describe('An optional title for the Quick Pick window.'),
  }),
  execute: async (options, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'showQuickPickTool', status: 'processing', message: `Showing Quick Pick: "${options.title ?? options.placeHolder ?? 'Select item'}..."` });
    }
    try {
      // Show the Quick Pick list
      // Need to handle both string arrays and object arrays for items
      const selectedItem = await vscode.window.showQuickPick(
          options.items, // Pass the validated items
          {
              canPickMany: options.canPickMany,
              ignoreFocusOut: options.ignoreFocusOut,
              matchOnDescription: options.matchOnDescription,
              matchOnDetail: options.matchOnDetail,
              placeHolder: options.placeHolder,
              title: options.title,
          }
      );

      const message = selectedItem === undefined ? 'Quick Pick cancelled by user.' : 'User made a selection.';
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'showQuickPickTool', status: 'complete', message: message });
       }
      // Return the selected item(s) (could be string, object, array, or undefined)
      return { success: true, selectedItem: selectedItem, message: message };

    } catch (error: any) {
      let errorMessage = `Failed to show Quick Pick.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`showQuickPickTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'showQuickPickTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});