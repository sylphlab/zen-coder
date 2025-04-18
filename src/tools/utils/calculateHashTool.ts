import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as crypto from 'crypto'; // Use Node.js crypto module

// Define supported hash algorithms
const hashAlgorithmEnum = z.enum(['sha256', 'sha512', 'md5']); // Added sha512
type HashAlgorithm = z.infer<typeof hashAlgorithmEnum>;

export const calculateHashTool = tool({
  description: 'Calculate the hash of a given string using a specified algorithm (sha256, sha512, or md5). WARNING: MD5 is cryptographically broken and should NOT be used for security purposes; prefer sha256 or sha512 unless required for non-security reasons like legacy compatibility or simple checksums.', // Updated description
  parameters: z.object({
    inputString: z.string().describe('The string to hash.'),
    algorithm: hashAlgorithmEnum.describe('The hash algorithm to use (sha256, sha512, md5). WARNING: md5 is insecure.'), // Updated description
  }),
  execute: async ({ inputString, algorithm }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
    if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'calculateHashTool', status: 'processing', message: `Calculating ${algorithm.toUpperCase()} hash...` });
    }
    try {
      // Zod already validates the algorithm is one of the enum values.
      // No need for the extra if check here.

      const hash = crypto.createHash(algorithm).update(inputString).digest('hex');

      let message = `${algorithm.toUpperCase()} hash calculated successfully.`;
      if (algorithm === 'md5') {
          message += ' WARNING: MD5 is insecure and should not be used for security purposes.';
      }

       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'calculateHashTool', status: 'complete', message: message });
       }
      return { success: true, hashValue: hash, algorithmUsed: algorithm };

    } catch (error: any) {
      let errorMessage = `Failed to calculate ${algorithm.toUpperCase()} hash.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`calculateHashTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'calculateHashTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});