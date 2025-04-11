import { z } from 'zod';
import { tool, StreamData } from 'ai';

export const jsonStringifyTool = tool({
  description: 'Convert a JavaScript object or array into a JSON string.',
  parameters: z.object({
    // Using z.any() is generally discouraged, but necessary here for arbitrary objects.
    // Consider adding more specific schemas if the input structure is known.
    inputObject: z.any().describe('The JavaScript object or array to stringify.'),
    space: z.union([z.string(), z.number().int()]).optional().describe('A String or Number object that\'s used to insert white space into the output JSON string for readability purposes. If this is a Number, it indicates the number of space characters to use as white space; this number is capped at 10. If it\'s a String, the string (or the first 10 characters of the string, if it\'s longer than that) is used as white space.'),
  }),
  execute: async ({ inputObject, space }, { data, toolCallId }: { data?: StreamData, toolCallId?: string }) => {
     if (data && toolCallId) {
        data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'jsonStringifyTool', status: 'processing', message: `Stringifying object...` });
    }
    try {
      // Basic check for circular references (JSON.stringify throws)
      const jsonString = JSON.stringify(inputObject, null, space);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'jsonStringifyTool', status: 'complete', message: `Object stringified successfully.` });
       }
      return { success: true, jsonString: jsonString };
    } catch (error: any) {
      let errorMessage = `Failed to stringify object to JSON.`;
      if (error instanceof TypeError && error.message.includes('circular structure')) {
          errorMessage += ` Reason: Circular reference detected.`;
      } else if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`jsonStringifyTool Error: ${error}`);
       if (data && toolCallId) {
           data.appendMessageAnnotation({ type: 'tool-status', toolCallId, toolName: 'jsonStringifyTool', status: 'error', message: errorMessage });
       }
      return { success: false, error: errorMessage };
    }
  },
});