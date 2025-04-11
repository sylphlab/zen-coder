import { z } from 'zod';
import { tool, StreamData } from 'ai';

export const jsonParseTool = tool({
  description: 'Parse a JSON string into a JavaScript object or array.',
  parameters: z.object({
    jsonString: z.string().describe('The JSON string to parse.'),
  }),
  execute: async ({ jsonString }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'jsonParseTool', status: 'processing', message: `Parsing JSON string...` });
    }
    try {
      const parsedObject = JSON.parse(jsonString);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'jsonParseTool', status: 'complete', message: `JSON parsed successfully.` });
       }
      // Note: Returning complex objects directly might be problematic for some LLMs or serialization.
      // Consider returning a string representation if issues arise, or ensure the calling context handles objects.
      return { success: true, result: parsedObject };
    } catch (error: any) {
      let errorMessage = `Failed to parse JSON string.`;
      if (error instanceof SyntaxError) {
          errorMessage += ` Reason: Invalid JSON format - ${error.message}`;
      } else if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`jsonParseTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'jsonParseTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});