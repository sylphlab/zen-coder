import { createFetcherStore } from './utils/createFetcherStore';
import { McpConfiguredStatusPayload } from '../../../src/common/types';
import { requestData } from '../utils/communication';

/**
 * Store that fetches and subscribes to the status of configured MCP servers.
 * Holds `McpConfiguredStatusPayload | null`. Null indicates the initial loading state.
 */
export const $mcpStatus = createFetcherStore<McpConfiguredStatusPayload | null>(
  'mcpStatus',           // Topic to listen for updates
  'getMcpStatus',        // Request type for initial fetch
  {
    initialData: null,    // Start with null
    // Payload type is directly McpConfiguredStatusPayload | null, no transformation needed?
    // If the backend wraps it like { payload: ... }, uncomment the transformer:
    // transformFetchResponse: (response) => response?.payload ?? null,
  }
);

// --- Mutation Stores for MCP Actions ---
import { createMutationStore, OptimisticUpdateResult } from './utils/createMutationStore';
import { McpServerStatus } from '../../../src/ai/mcpManager'; // Import McpServerStatus

// Open Global MCP Config File
export const $openGlobalMcpConfig = createMutationStore<
  undefined, any, void, void
>({
  performMutation: async () => {
    await requestData<void>('openGlobalMcpConfig');
    // This action likely opens a file, no state change expected here.
  },
});

// Open Project MCP Config File
export const $openProjectMcpConfig = createMutationStore<
  undefined, any, void, void
>({
  performMutation: async () => {
    await requestData<void>('openProjectMcpConfig');
    // This action likely opens a file, no state change expected here.
  },
});

// Retry MCP Connection
// Corrected payload type to use 'identifier'
type RetryMcpConnectionPayload = { identifier: string };
export const $retryMcpConnection = createMutationStore<
  undefined, // Result type (no specific result needed)
  McpConfiguredStatusPayload | null, // Type of the store being updated ($mcpStatus)
  RetryMcpConnectionPayload, // Payload type for the mutation
  void // Return type of performMutation
>({
  performMutation: async (payload: RetryMcpConnectionPayload) => {
    // Pass the payload with the 'identifier' key
    await requestData<void>('retryMcpConnection', { identifier: payload.identifier });
    // Actual state update will happen via $mcpStatus subscription push
  },
  getOptimisticUpdate: (
    payload: RetryMcpConnectionPayload,
    currentDataState: McpConfiguredStatusPayload | null // Use the provided current state
  ): OptimisticUpdateResult<McpConfiguredStatusPayload | null> => {
    // Use 'identifier' from payload to find the server
    if (!currentDataState || !currentDataState[payload.identifier]) {
      // If no current state or server not found, don't apply optimistic update
      return { optimisticState: currentDataState, revertState: currentDataState };
    }

    // Create a deep copy for the optimistic state
    const optimisticState: McpConfiguredStatusPayload = JSON.parse(JSON.stringify(currentDataState));

    // Update the specific server's state optimistically using 'identifier'
    const serverToUpdate = optimisticState[payload.identifier] as McpServerStatus;
    serverToUpdate.isConnected = false; // Assume disconnection while retrying
    serverToUpdate.lastError = 'Retrying...'; // Set status text
    serverToUpdate.tools = {}; // Clear tools while retrying

    // Return the optimistic state and the original state for reverting
    return {
      optimisticState: optimisticState,
      revertState: currentDataState, // Revert back to the state before the optimistic update
    };
  }
});
