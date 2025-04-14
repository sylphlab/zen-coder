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

// Potential future atoms related to tools can be added here.
