import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as crypto from 'crypto'; // Use Node.js crypto module

export const sha256HashTool = tool({
  description: 'Calculate the SHA-256 hash of a given string.',
  parameters: z.object({
    inputString: z.string().describe('The string to hash.'),
  }),
  execute: async ({ inputString }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'sha256HashTool', status: 'processing', message: `Calculating SHA-256 hash...` });
    }
    try {
      const hash = crypto.createHash('sha256').update(inputString).digest('hex');
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'sha256HashTool', status: 'complete', message: `SHA-256 hash calculated.` });
       }
      return { success: true, sha256Hash: hash };
    } catch (error: any) {
      let errorMessage = `Failed to calculate SHA-256 hash.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`sha256HashTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'sha256HashTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});