import { z } from 'zod';
import { tool } from 'ai';
import { Buffer } from 'buffer'; // Use Node.js Buffer

type DecodeResult = {
  success: boolean;
  results: Array<{
    input: string;
    decoded?: string;
    success: boolean;
    error?: string;
  }>;
  error?: string;
};

export const base64DecodeTool = tool({
  description: 'Decode one or more Base64 strings into UTF-8 strings.',
  parameters: z.object({
    encodedStrings: z.array(z.string()).describe('Array of Base64 encoded strings to decode.')
  }),
  execute: async ({ encodedStrings }): Promise<DecodeResult> => {
    try {
      if (encodedStrings.length === 0) {
        return {
          success: false,
          results: [],
          error: 'No input strings provided'
        };
      }

      const results = encodedStrings.map(encodedString => {
        try {
          // Basic validation for Base64 format
          if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encodedString)) {
            throw new Error('Input string does not appear to be valid Base64.');
          }
          const decodedString = Buffer.from(encodedString, 'base64').toString('utf8');
          return {
            input: encodedString,
            decoded: decodedString,
            success: true
          };
        } catch (error: any) {
          return {
            input: encodedString,
            success: false,
            error: error.message.includes('valid Base64')
              ? error.message
              : `Failed to decode string: ${error.message || String(error)}`
          };
        }
      });

      const hasFailures = results.some(r => !r.success);
      return {
        success: !hasFailures, // Return true only when all succeed
        results,
        ...(hasFailures && { error: 'Some strings failed to decode.' })
      };
    } catch (error: any) {
      let errorMessage = `Failed to decode Base64 strings.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`base64DecodeTool Error: ${error}`);
      return { success: false, error: errorMessage, results: [] };
    }
  },
});