import { requestData } from '../utils/communication';
// Removed createFetcherStore import
import { StandardStore, createStore } from './utils/createStore'; // Import createStore and StandardStore

/**
 * Define the shape of the custom instructions data
 */
type CustomInstructionsData = { global: string; project: string | null; projectPath: string | null };

/**
 * Represents the raw payload pushed via updates (if different from fetch).
 * Assuming updates push { payload: CustomInstructionsData | null }
 */
type CustomInstructionsUpdatePayload = { payload: CustomInstructionsData | null }; // Keep for update type checking if needed, but fetch is direct

/**
 * Store that fetches and subscribes to custom instructions (global and project).
 * Holds CustomInstructionsData | null | 'loading' | 'error'.
 */
export const $customInstructions: StandardStore<CustomInstructionsData> = createStore<
    CustomInstructionsData,           // TData: The data structure held by the store
    CustomInstructionsData,           // TResponse: Raw fetch response type
    {},                               // PPayload: Fetch takes no payload
    CustomInstructionsUpdatePayload   // UUpdateData: Type of data from pubsub
>({
    key: 'customInstructions',
    fetch: {
        requestType: 'getCustomInstructions',
        // No payload or transform needed
    },
    subscribe: {
        topic: 'customInstructions',
        handleUpdate: (currentData, updateData) => {
            // Update comes as { payload: CustomInstructionsData | null }
            return updateData?.payload ?? null;
        }
    },
    initialData: null // Explicitly null, createStore handles 'loading'
});

// --- Mutation Stores for Settings ---
import { createMutationStore } from './utils/createMutationStore';
import { DefaultChatConfig } from '../../../src/common/types';

// Set Default Config
type SetDefaultConfigPayload = { config: Partial<DefaultChatConfig> };
export const $setDefaultConfig = createMutationStore<
  undefined, // No specific target atom for optimistic update for now
  any,       // Target Atom's state type (unused)
  SetDefaultConfigPayload, // Payload type
  void       // Result type (assuming no specific result needed)
>({
  performMutation: async (payload: SetDefaultConfigPayload) => {
    await requestData<void>('setDefaultConfig', payload);
    // No return value needed, relies on backend push for $defaultConfig update
  },
  // No optimistic update needed for now
});

// Set Global Custom Instructions
type SetGlobalInstructionsPayload = { instructions: string };
export const $setGlobalCustomInstructions = createMutationStore<
  undefined, any, SetGlobalInstructionsPayload, void
>({
  performMutation: async (payload: SetGlobalInstructionsPayload) => {
    await requestData<void>('setGlobalCustomInstructions', payload);
    // Relies on backend push for $customInstructions update
  },
});

// Set Project Custom Instructions
type SetProjectInstructionsPayload = { instructions: string };
export const $setProjectCustomInstructions = createMutationStore<
  undefined, any, SetProjectInstructionsPayload, void
>({
  performMutation: async (payload: SetProjectInstructionsPayload) => {
    await requestData<void>('setProjectCustomInstructions', payload);
    // Relies on backend push for $customInstructions update
  },
});

// Open or Create Project Instructions File
export const $openOrCreateProjectInstructionsFile = createMutationStore<
  undefined, any, void, void
>({
  performMutation: async () => {
    await requestData<void>('openOrCreateProjectInstructionsFile');
    // This action likely opens a file, no state change expected here.
  },
});
