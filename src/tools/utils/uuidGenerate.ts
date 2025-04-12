import { z } from 'zod';
import { tool } from 'ai';
import * as crypto from 'crypto';
import type { ToolExecutionOptions } from 'ai'; // Import standard options type (Removed ToolResultContent)

// --- Types for Progress Update ---
export interface UuidProgressUpdate { // Export interface for use in AiService
    toolCallId: string;
    status: 'start' | 'progress' | 'complete' | 'error';
    current?: number; // Current count for progress
    total?: number;   // Total count for progress
    uuid?: string;    // The UUID generated in this step (for progress)
    uuids?: string[]; // Final array of UUIDs (for complete)
    error?: string;   // Error message
}

// Define the type for the update callback function
export type UuidUpdateCallback = (update: UuidProgressUpdate) => void; // Export type

// --- Core Logic with Progress Callback ---
// Export this function separately
export async function executeUuidGenerateWithProgress(
    { count = 1 }: { count?: number }, // Default count if not provided
    { toolCallId, updateCallback }: { toolCallId: string; updateCallback: UuidUpdateCallback }
// Update return type to include the final uuids array on success
): Promise<{ success: boolean; error?: string; uuids?: string[] }> {
    if (!toolCallId || !updateCallback) {
        console.error("executeUuidGenerateWithProgress Error: Missing toolCallId or updateCallback.");
        // Send error back through callback if possible, otherwise just return error
        if (updateCallback && toolCallId) {
             updateCallback({ toolCallId, status: 'error', error: "Internal error: Missing required context." });
        }
        return { success: false, error: "Internal error: Missing required context." };
    }

    try {
        if (typeof crypto.randomUUID !== 'function') {
            throw new Error('crypto.randomUUID function is not available in this Node.js version.');
        }
        updateCallback({ toolCallId, status: 'start', total: count });
        const uuids: string[] = [];
        for (let i = 0; i < count; i++) {
            // Add a small delay to allow UI to potentially update between progress steps
            // Adjust delay as needed (e.g., 50ms) or remove if UI updates quickly enough
            await new Promise(resolve => setTimeout(resolve, 50));
            const newUuid = crypto.randomUUID();
            uuids.push(newUuid);
            updateCallback({ toolCallId, status: 'progress', current: i + 1, total: count, uuid: newUuid });
        }
        updateCallback({ toolCallId, status: 'complete', uuids: uuids, total: count });
        // Also return the final array along with success status
        return { success: true, uuids: uuids };
    } catch (error: any) {
        let errorMessage = `Failed to generate UUID.`;
        if (error instanceof Error) {
            errorMessage += ` Reason: ${error.message}`;
        } else {
            errorMessage += ` Unknown error: ${String(error)}`;
        }
        console.error(`uuidGenerateTool Logic Error: ${error}`);
        updateCallback({ toolCallId, status: 'error', error: errorMessage, total: count });
        return { success: false, error: errorMessage }; // Return error status
    }
}

// --- Standard Tool Definition for SDK ---
// This execute function will NOT use the callback, just returns the final result.
// It's used by the SDK for schema validation etc., but AiService wrapper will call the function above.
export const uuidGenerateTool = tool({
  description: 'Generate one or more new random UUIDs (Universally Unique Identifier), version 4.',
  parameters: z.object({
      count: z.number().int().positive().optional().default(1).describe('Number of UUIDs to generate (default: 1).')
  }),
  // This standard execute is for the SDK, returns final result directly.
  execute: async ({ count = 1 }) => {
    try {
        if (typeof crypto.randomUUID !== 'function') {
            throw new Error('crypto.randomUUID function is not available in this Node.js version.');
        }
        const uuids: string[] = [];
        for (let i = 0; i < count; i++) {
            uuids.push(crypto.randomUUID());
        }
        // Return final array in the structure expected by the SDK
        return { success: true, uuids: uuids };
    } catch (error: any) {
        let errorMessage = `Failed to generate UUID.`;
        if (error instanceof Error) {
            errorMessage += ` Reason: ${error.message}`;
        } else {
            errorMessage += ` Unknown error: ${String(error)}`;
        }
        console.error(`uuidGenerateTool SDK Execute Error: ${error}`);
        // Return error in a structure the SDK might expect for tool results
        return { success: false, error: errorMessage };
    }
  },
});