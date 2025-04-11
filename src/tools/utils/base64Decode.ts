import { z } from 'zod';
import { tool } from 'ai';
import { Buffer } from 'buffer'; // Use Node.js Buffer

export const base64DecodeTool = tool({
  description: 'Decode a Base64 string into a UTF-8 string.',
  parameters: z.object({
    encodedString: z.string().describe('The Base64 encoded string to decode.'),
  }),
  execute: async ({ encodedString }) => {
    try {
      // Basic validation for Base64 format
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encodedString)) {
        throw new Error('Input string does not appear to be valid Base64.');
      }
      const decodedString = Buffer.from(encodedString, 'base64').toString('utf8');
      return { success: true, decodedString };
    } catch (error: any) {
      let errorMessage = `Failed to decode Base64 string.`;
       if (error.message.includes('valid Base64')) {
           errorMessage = error.message;
       } else if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`base64DecodeTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});