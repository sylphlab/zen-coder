import { z } from 'zod';
import { tool } from 'ai';

export const getCurrentTimeTool = tool({
  description: 'Returns the current date and time in ISO 8601 format.',
  parameters: z.object({}), // No parameters needed
  execute: async () => {
    try {
      const currentTime = new Date().toISOString();
      return { success: true, currentTime };
    } catch (error: any) {
      let errorMessage = `Failed to get current time.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`getCurrentTimeTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});