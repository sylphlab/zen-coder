import { z } from 'zod';
import { tool } from 'ai';
// Use dynamic import for ESM compatibility with node-fetch v3+
const fetch = (...args: any[]) => import('node-fetch').then(({default: fetch}) => (fetch as any)(...args));

export const getPublicIpTool = tool({
  description: 'Gets the public IP address of the machine running the extension by querying an external service (api.ipify.org).',
  parameters: z.object({}), // No parameters needed
  execute: async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status} ${response.statusText}`);
      }
      const data: any = await response.json();
      if (typeof data?.ip !== 'string') {
          throw new Error('Invalid response format from IP service.');
      }
      const publicIp = data.ip;
      return { success: true, publicIp };
    } catch (error: any) {
      let errorMessage = `Failed to get public IP address.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`getPublicIpTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});