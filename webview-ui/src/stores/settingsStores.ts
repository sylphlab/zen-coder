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
    CustomInstructionsData | null     // UUpdateData: Backend pushes the data directly
>({
    key: 'customInstructions',
    fetch: {
        requestType: 'getCustomInstructions',
        // No payload or transform needed
    },
    subscribe: {
        topic: 'customInstructions',
        handleUpdate: (currentData, updateData: CustomInstructionsData | null) => {
             // Backend pushes CustomInstructionsData | null directly.
            console.log('[$customInstructions handleUpdate] Received updateData:', updateData);
            // Return the received data (or null if that's what was pushed)
            return updateData;
        }
    },
    initialData: null // Explicitly null, createStore handles 'loading'
});

// --- Mutation Stores for Settings ---
import { createMutationStore, OptimisticUpdateResult } from './utils/createMutationStore'; // Import OptimisticUpdateResult
import { DefaultChatConfig } from '../../../src/common/types';
import { $defaultConfig } from './chatStores'; // Import the target store

// Set Default Config
type SetDefaultConfigPayload = { config: Partial<DefaultChatConfig> };
export const $setDefaultConfig = createMutationStore<
  typeof $defaultConfig,       // Target Atom: $defaultConfig
  DefaultChatConfig | null,    // Target Atom's state type (TDataState in createMutationStore)
  SetDefaultConfigPayload,     // Payload type
  void                         // Result type (backend handler returns { success: true }, but mutation doesn't need it)
>({
  targetAtom: $defaultConfig, // Specify the target store
  performMutation: async (payload: SetDefaultConfigPayload) => {
    await requestData<void>('setDefaultConfig', payload);
    // Backend push via SubscriptionManager will eventually confirm, but optimistic update provides immediate feedback.
  },
  getOptimisticUpdate: (
    payload: SetDefaultConfigPayload,
    currentDataState: DefaultChatConfig | null | 'loading' | 'error'
  ): OptimisticUpdateResult<DefaultChatConfig | null> => {
    const currentState = (currentDataState === 'loading' || currentDataState === 'error' || currentDataState === null)
      ? {} // Start from empty if loading/error/null
      : currentDataState;

    const optimisticState: DefaultChatConfig = {
      ...currentState,
      ...payload.config, // Apply the updates optimistically
    };
    console.log('[$setDefaultConfig getOptimisticUpdate] Current:', currentDataState, 'Optimistic:', optimisticState);
    return {
      optimisticState: optimisticState,
      revertState: currentDataState, // Revert to original state ('loading', 'error', null, or data)
    };
  },
   // applyMutationResult can be simple, just confirming the state, as the optimistic one should be correct.
   // The backend push notification will also update the store via its subscribe handler.
   applyMutationResult: (result: void, currentDataState: DefaultChatConfig | null | 'loading' | 'error') => {
       // The optimistic state should already reflect the change.
       // We could potentially refetch here to be 100% sure, but let's rely on the push for now.
       console.log('[$setDefaultConfig applyMutationResult] Mutation successful. State kept as optimistic/updated.');
       // Return the current state (which should be the optimistically updated one)
       // Return the current state (which should be the optimistically updated one)
       // ApplyMutationResult is not strictly needed here as the backend push via subscription handles final state.
       // Removing it simplifies the logic.
       // return (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
   }
   // Let's remove applyMutationResult entirely for this mutation.
});

// Set Global Custom Instructions
type SetGlobalInstructionsPayload = { instructions: string };
export const $setGlobalCustomInstructions = createMutationStore<
  undefined, any, SetGlobalInstructionsPayload, { success: boolean } // Change TResult to { success: boolean }
>({
  performMutation: async (payload: SetGlobalInstructionsPayload): Promise<{ success: boolean }> => {
    // Explicitly return the result, which should be { success: boolean }
    return await requestData<{ success: boolean }>('setGlobalCustomInstructions', payload);
    // Update relies on backend push for $customInstructions store
  },
});

// Set Project Custom Instructions
type SetProjectInstructionsPayload = { instructions: string };
export const $setProjectCustomInstructions = createMutationStore<
  undefined, any, SetProjectInstructionsPayload, { success: boolean } // Change TResult to { success: boolean }
>({
  performMutation: async (payload: SetProjectInstructionsPayload): Promise<{ success: boolean }> => {
    // Explicitly return the result, which should be { success: boolean }
    return await requestData<{ success: boolean }>('setProjectCustomInstructions', payload);
    // Update relies on backend push for $customInstructions store
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
