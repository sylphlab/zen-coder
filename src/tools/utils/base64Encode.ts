import { z } from 'zod';
import { tool } from 'ai';
import { Buffer } from 'buffer'; // Use Node.js Buffer

export const base64EncodeTool = tool({
  description: 'Encode a UTF-8 string into Base64.',
  parameters: z.object({
    inputString: z.string().describe('The UTF-8 string to encode.'),
  }),
  execute: async ({ inputString }) => {
    try {
      const encodedString = Buffer.from(inputString, 'utf8').toString('base64');
      return { success: true, encodedString };
    } catch (error: any) {
      let errorMessage = `Failed to encode string to Base64.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`base64EncodeTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});