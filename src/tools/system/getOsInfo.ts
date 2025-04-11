import { z } from 'zod';
import { tool } from 'ai';
import * as os from 'os'; // Use Node.js os module

export const getOsInfoTool = tool({
  description: 'Get basic information about the host operating system.',
  parameters: z.object({}), // No parameters needed
  execute: async () => {
    try {
      const osInfo = {
        platform: os.platform(), // e.g., 'win32', 'darwin', 'linux'
        release: os.release(),   // e.g., '10.0.19044' (Windows), '21.6.0' (macOS)
        arch: os.arch(),         // e.g., 'x64'
        // hostname: os.hostname(), // Potentially sensitive? Omit for now.
        // userInfo: os.userInfo(), // Definitely sensitive, omit.
        // totalmem: os.totalmem(), // System resource info, maybe less relevant for AI tool
        // freemem: os.freemem(),
      };
      return { success: true, osInfo };
    } catch (error: any) {
      let errorMessage = `Failed to get OS information.`;
      if (error instanceof Error) {
        errorMessage += ` Reason: ${error.message}`;
      } else {
        errorMessage += ` Unknown error: ${String(error)}`;
      }
      console.error(`getOsInfoTool Error: ${error}`);
      return { success: false, error: errorMessage };
    }
  },
});