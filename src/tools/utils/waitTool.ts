import { z } from 'zod';
import { tool, StreamData } from 'ai';

export const waitTool = tool({
  description: 'Waits for a specified number of seconds before proceeding. Useful for allowing time for asynchronous external processes (like builds or deployments) to complete before checking their status.',
  parameters: z.object({
    durationSeconds: z.number().int().positive().describe('The number of seconds to wait.'),
  }),
  execute: async ({ durationSeconds }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    const milliseconds = durationSeconds * 1000;
    const message = `Waiting for ${durationSeconds} second(s)...`;

    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'waitTool', status: 'processing', message: message });
    }
    console.log(`waitTool: ${message}`); // Log start

    try {
      await new Promise(resolve => setTimeout(resolve, milliseconds));

      const successMessage = `Successfully waited for ${durationSeconds} second(s).`;
      if (data && toolCallId) {
          data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'waitTool', status: 'complete', message: successMessage });
      }
      console.log(`waitTool: ${successMessage}`); // Log end
      return { success: true, message: successMessage };

    } catch (error: any) {
      // This catch block might be less likely to trigger for setTimeout, but included for robustness
      let errorMessage = `An error occurred during the wait period.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`waitTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'waitTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});