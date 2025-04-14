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
import { createMutationStore } from './utils/createMutationStore';

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
type RetryMcpConnectionPayload = { serverName: string };
export const $retryMcpConnection = createMutationStore<
  undefined, any, RetryMcpConnectionPayload, void
>({
  performMutation: async (payload: RetryMcpConnectionPayload) => {
    await requestData<void>('retryMcpConnection', payload);
    // State update will happen via $mcpStatus subscription
  },
});
