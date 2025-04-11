import { z } from 'zod';
import { tool } from 'ai';
import * as vscode from 'vscode';

// Define the structure for terminal info
const terminalInfoSchema = z.object({
  id: z.number().int().positive().describe('A unique identifier for the terminal instance within the current session.'),
  name: z.string().describe('The display name of the terminal.'),
  // processId: z.number().int().positive().optional().describe('The process ID of the terminal shell process.'), // processId requires async lookup
});

export const getActiveTerminalsTool = tool({
  description: 'Returns a list of active VS Code terminal instances, including their session ID and name.',
  parameters: z.object({}), // No parameters needed
  execute: async () => {
    try {
      // Map terminals to a simpler structure immediately
      const activeTerminals = vscode.window.terminals.map((t, index) => ({
        id: index + 1, // Simple 1-based ID for reference during this session
        name: t.name,
        // Getting processId requires an async call per terminal, might slow things down.
        // Omit for now unless specifically needed.
        // processId: await t.processId // Example if needed
      }));

      // Validate the output against the schema
      const validationResult = z.array(terminalInfoSchema).safeParse(activeTerminals);
      if (!validationResult.success) {
          console.error("getActiveTerminalsTool validation error:", validationResult.error);
          throw new Error("Internal error: Failed to format terminal list.");
      }


      if (validationResult.data.length === 0) {
        return { success: true, terminals: [], message: "No active terminals found." };
      }
      return { success: true, terminals: validationResult.data };

    } catch (error: any) {
      let errorMessage = `Failed to get active terminals.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`getActiveTerminalsTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});