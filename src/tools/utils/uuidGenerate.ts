import { z } from 'zod';
import { tool, StreamData } from 'ai';
import * as crypto from 'crypto'; // Use Node.js crypto module for randomUUID

export const uuidGenerateTool = tool({
  description: 'Generate a new random UUID (Universally Unique Identifier), version 4.',
  parameters: z.object({}), // No parameters needed
  execute: async ({}, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'uuidGenerateTool', status: 'processing', message: `Generating UUID...` });
    }
    try {
      // crypto.randomUUID() is available in Node.js >= 14.17.0
      if (typeof crypto.randomUUID !== 'function') {
          throw new Error('crypto.randomUUID function is not available in this Node.js version.');
      }
      const uuid = crypto.randomUUID();
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'uuidGenerateTool', status: 'complete', message: `UUID generated.` });
       }
      return { success: true, uuid: uuid };
    } catch (error: any) {
      let errorMessage = `Failed to generate UUID.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`uuidGenerateTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'uuidGenerateTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});