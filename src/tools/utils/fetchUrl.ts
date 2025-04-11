import { z } from 'zod';
import { tool } from 'ai';
// Use dynamic import for ESM compatibility with node-fetch v3+
const fetch = (...args: any[]) => import('node-fetch').then(({default: fetch}) => (fetch as any)(...args));

export const fetchUrlTool = tool({
  description: 'Fetch content from a given URL. Returns the text content.',
  parameters: z.object({
    url: z.string().url().describe('The URL to fetch content from.'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']).optional().default('GET').describe('HTTP method.'),
    headers: z.record(z.string()).optional().describe('Optional request headers as key-value pairs.'),
    body: z.string().optional().describe('Optional request body (typically for POST/PUT/PATCH).'),
  }),
  execute: async ({ url, method = 'GET', headers, body }) => {
    try {
      const response = await fetch(url, {
        method: method,
        headers: headers,
        body: (method !== 'GET' && method !== 'HEAD' && body) ? body : undefined,
        // Add timeout? Consider security implications (e.g., SSRF) if URL is user-provided.
        // For now, assume URLs are provided by trusted AI or context.
      });

      if (!response.ok) {
        // Attempt to get error details from the response body if possible
        let errorBody = '';
        try {
            errorBody = await response.text();
        } catch (e) {
            // Ignore if reading body fails
        }
        throw new Error(`HTTP error ${response.status} ${response.statusText}. ${errorBody}`.trim());
      }

      const content = await response.text();
      // Limit response size?
      // const MAX_CONTENT_LENGTH = 10000; // Example limit
      // if (content.length > MAX_CONTENT_LENGTH) {
      //   return { success: true, content: content.substring(0, MAX_CONTENT_LENGTH) + '\n... [truncated]' };
      // }
      return { success: true, content };

    } catch (error: any) {
      let errorMessage = `Failed to fetch URL '${url}'.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`fetchUrlTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});