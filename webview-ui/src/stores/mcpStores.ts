// Removed createFetcherStore import
import { McpConfiguredStatusPayload } from '../../../src/common/types';
import { requestData } from '../utils/communication';
import { StandardStore, createStore } from './utils/createStore'; // Import createStore and StandardStore
import { McpServerStatus } from '../../../src/ai/mcpManager';
import { createMutationStore, OptimisticUpdateResult } from './utils/createMutationStore';


/**
 * Store that fetches and subscribes to the status of configured MCP servers.
 * Holds McpConfiguredStatusPayload | null | 'loading' | 'error'.
 */
export const $mcpStatus: StandardStore<McpConfiguredStatusPayload> = createStore<
    McpConfiguredStatusPayload, // TData: The map of server statuses
    McpConfiguredStatusPayload, // TResponse: Fetch response type
    {},                         // PPayload: Fetch takes no payload
    McpConfiguredStatusPayload  // UUpdateData: PubSub pushes the full map
>({
    key: 'mcpStatus',
    fetch: {
        requestType: 'getMcpStatus',
        // No payload or transform needed
    },
    subscribe: {
        topic: 'mcpStatus',
        handleUpdate: (currentData, updateData) => {
            // Update comes as the full McpConfiguredStatusPayload structure
            return updateData ?? null;
        }
    },
    initialData: null // Explicitly null, createStore handles 'loading'
});


// --- Mutation Stores for MCP Actions ---

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
type RetryMcpConnectionPayload = { identifier: string };
export const $retryMcpConnection = createMutationStore<
  typeof $mcpStatus,               // Target atom type
  McpConfiguredStatusPayload,      // TData matches StandardStore
  RetryMcpConnectionPayload,       // Payload type
  void                             // performMutation return type
>({
  targetAtom: $mcpStatus, // Target the new store
  performMutation: async (payload: RetryMcpConnectionPayload) => {
    await requestData<void>('retryMcpConnection', { identifier: payload.identifier });
    // Actual state update will happen via $mcpStatus subscription push
  },
  getOptimisticUpdate: (
    payload: RetryMcpConnectionPayload,
    currentState: McpConfiguredStatusPayload | null | 'loading' | 'error'
  ): OptimisticUpdateResult<McpConfiguredStatusPayload> => { // Return TData type
    // Check if currentState is actually the data type
    if (currentState === 'loading' || currentState === 'error' || currentState === null || !currentState[payload.identifier]) {
       // Return placeholder empty object if cannot update
       const placeholderState: McpConfiguredStatusPayload = {};
       return { optimisticState: placeholderState, revertState: placeholderState };
    }
    // Now TypeScript knows currentState is McpConfiguredStatusPayload
    const currentDataState = currentState;

    // Create a deep copy for the optimistic state
    const optimisticState: McpConfiguredStatusPayload = JSON.parse(JSON.stringify(currentDataState));

    // Update the specific server's state optimistically using 'identifier'
    const serverToUpdate = optimisticState[payload.identifier] as McpServerStatus;
    serverToUpdate.isConnected = false; // Assume disconnection while retrying
    serverToUpdate.lastError = 'Retrying...'; // Set status text
    serverToUpdate.tools = {}; // Clear tools while retrying

    // Return the optimistic state and the original state for reverting
    return {
      optimisticState: optimisticState, // TData
      revertState: currentDataState,    // TData
    };
  },
  applyMutationResult: (result: void, currentState: McpConfiguredStatusPayload | null | 'loading' | 'error') => {
      // Type expected: TData | null = McpConfiguredStatusPayload | null
      // Return the current state only if it's data, otherwise null.
      return currentState !== 'loading' && currentState !== 'error' && currentState !== null ? currentState : null;
  }
});
