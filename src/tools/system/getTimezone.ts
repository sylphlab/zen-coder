import { z } from 'zod';
import { tool } from 'ai';

export const getTimezoneTool = tool({
  description: 'Returns the current system timezone identifier (e.g., "Europe/London", "America/New_York").',
  parameters: z.object({}), // No parameters needed
  execute: async () => {
    try {
      // Intl.DateTimeFormat().resolvedOptions().timeZone is the standard way
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return { success: true, timezone };
    } catch (error: any) {
      let errorMessage = `Failed to get system timezone.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`getTimezoneTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});