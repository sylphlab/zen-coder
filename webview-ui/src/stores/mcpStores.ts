import { McpConfiguredStatusPayload } from '../../../src/common/types';
import { Operation } from 'fast-json-patch'; // Import Operation directly
import { requestData } from '../utils/communication';
import { StandardStore, createStore } from './utils/createStore'; // Import createStore and StandardStore
import { McpServerStatus } from '../../../src/ai/mcpManager';
import { createMutationStore } from './utils/createMutationStore'; // Removed OptimisticUpdateResult import

/**
 * Store that fetches and subscribes to the status of configured MCP servers.
 * Holds McpConfiguredStatusPayload | null | 'loading' | 'error'.
 */
export const $mcpStatus: StandardStore<McpConfiguredStatusPayload> = createStore<
    McpConfiguredStatusPayload, // TData: The map of server statuses
    McpConfiguredStatusPayload, // TResponse: Fetch response type
    {},                         // PPayload: Fetch takes no payload
    Operation[]                 // UUpdateData: Expecting JSON Patch array
>({
    key: 'mcpStatus',
    fetch: {
        requestType: 'getMcpStatus',
        // No payload or transform needed
    },
    subscribe: {
        topic: 'mcpStatus',
        // handleUpdate is now handled internally by createStore for JSON patches
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
  StandardStore<McpConfiguredStatusPayload>, // Use StandardStore type
  McpConfiguredStatusPayload,      // TData matches StandardStore
  RetryMcpConnectionPayload,       // Payload type
  void                             // performMutation return type
>({
  targetAtom: $mcpStatus, // Keep targetAtom for potential optimistic patch
  performMutation: async (payload: RetryMcpConnectionPayload) => {
    await requestData<void>('retryMcpConnection', { identifier: payload.identifier });
    // Actual state update will happen via $mcpStatus subscription push (as JSON Patch)
  },
  // Removed getOptimisticUpdate and applyMutationResult
  // If optimistic update is needed later, calculate patch and pass via mutate options
});
