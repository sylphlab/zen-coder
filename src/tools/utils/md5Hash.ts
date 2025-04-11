import { z } from 'zod';
import { tool } from 'ai';
import * as crypto from 'crypto'; // Use Node.js crypto module

export const md5HashTool = tool({
  description: 'Calculate the MD5 hash of a given string.',
  parameters: z.object({
    inputString: z.string().describe('The string to hash.'),
  }),
  execute: async ({ inputString }) => {
    try {
      const hash = crypto.createHash('md5').update(inputString).digest('hex');
      return { success: true, md5Hash: hash };
    } catch (error: any) {
      let errorMessage = `Failed to calculate MD5 hash.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`md5HashTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});