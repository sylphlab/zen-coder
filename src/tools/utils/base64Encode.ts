import { z } from 'zod';
import { tool } from 'ai';
import { Buffer } from 'buffer'; // Use Node.js Buffer

type EncodeResult = {
  success: boolean;
  results: Array<{
    input: string;
    encoded?: string;
    success: boolean;
    error?: string;
  }>;
  error?: string;
};

export const base64EncodeTool = tool({
  description: 'Encode one or more UTF-8 strings into Base64.',
  parameters: z.object({
    input: z.array(z.string()).describe('Array of UTF-8 strings to encode.')
  }),
  execute: async ({ input }: { input: string[] }): Promise<EncodeResult> => {
    try {
      if (input.length === 0) {
        return {
          success: false,
          results: [],
          error: 'No input strings provided'
        };
      }

      const results = input.map(str => {
        try {
          return {
            input: str,
            encoded: Buffer.from(str, 'utf8').toString('base64'),
            success: true
          };
        } catch (error: any) {
          return {
            input: str,
            success: false,
            error: `Failed to encode string: ${error.message || String(error)}`
          };
        }
      });

      const hasFailures = results.some(r => !r.success);
      return {
        success: !hasFailures,
        results,
        ...(hasFailures && { error: 'Some strings failed to encode.' })
      };
    } catch (error: any) {
      let errorMessage = `Failed to encode strings to Base64.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`base64EncodeTool Error: ${error}`);
      return { success: false, error: errorMessage, results: [] };
    }
  },
});