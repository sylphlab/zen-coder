import { z } from 'zod';
import { tool } from 'ai';
import * as vscode from 'vscode';

export const getOpenTabsTool = tool({
  description: 'Returns a list of currently open file paths in the VS Code editor, relative to the workspace root.',
  parameters: z.object({}), // No parameters needed
  execute: async () => {
    try {
      const openEditorPaths = vscode.window.tabGroups.all
        .flatMap(tabGroup => tabGroup.tabs)
        .map(tab => tab.input)
        .filter((input): input is vscode.TabInputText => input instanceof vscode.TabInputText) // Only text editors
        .map(input => {
            try {
                // Use asRelativePath with suppressWorkspaceFolderNotFound = true
                return vscode.workspace.asRelativePath(input.uri, true);
            } catch (e) {
                // Fallback for files outside workspace (though less likely with TabInputText)
                console.warn(`getOpenTabsTool: Could not get relative path for ${input.uri.fsPath}`, e);
                return input.uri.fsPath; // Return full path as fallback
            }
        });

      if (openEditorPaths.length === 0) {
        return { success: true, openTabs: [], message: "No files are currently open in the editor." };
      }
      return { success: true, openTabs: openEditorPaths };

    } catch (error: any) {
      let errorMessage = `Failed to get open editor tabs.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`getOpenTabsTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});