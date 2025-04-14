import { AllToolsStatusInfo } from '../../../src/common/types';
import { createFetcherStore } from './utils/createFetcherStore'; // Renamed import path and function

/**
 * Atom that fetches and subscribes to the status of all tools (standard and MCP).
 * It holds `AllToolsStatusInfo | null`. Null indicates the initial loading state.
 */
export const $allToolsStatus = createFetcherStore<AllToolsStatusInfo | null>( // Renamed variable and function call
  'allToolsStatusUpdate', // Topic to listen for updates
  'getAllToolsStatus',    // Request type for initial fetch
  {
    initialData: null, // Start with null
    // No transformer needed as the fetch response is the correct type
  }
);

// --- Mutation Store for Tool Authorization ---
import { createMutationStore } from './utils/createMutationStore';
import { ToolAuthorizationConfig } from '../../../src/common/types'; // Import the config type
import { requestData } from '../utils/communication'; // Add missing import

type SetToolAuthPayload = { config: Partial<ToolAuthorizationConfig> }; // Allow partial updates

export const $setToolAuthorization = createMutationStore<
  undefined, // No optimistic update for now
  any,
  SetToolAuthPayload,
  void // Assuming no return value needed
>({
  performMutation: async (payload: SetToolAuthPayload) => {
    await requestData<void>('setToolAuthorization', payload);
    // Relies on backend push via $allToolsStatus update
  },
});

// Potential future atoms related to tools can be added here.
