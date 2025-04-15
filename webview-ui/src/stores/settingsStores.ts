// Stores related to settings page (API keys, provider enablement, etc.)

import { DefaultChatConfig, ToolAuthorizationConfig } from '../../../src/common/types'; // Import required types - Removed CombinedCustomInstructions
import { createStore, StandardStore } from './utils/createStore';
import { createMutationStore } from './utils/createMutationStore';
import { requestData } from '../utils/communication';
// Removed incorrect import: import { GetCustomInstructionsResponse } from '../../../src/webview/handlers/GetCustomInstructionsHandler';

// --- Custom Instructions Store ---

// Type for the update payload pushed via PubSub
type CustomInstructionsUpdatePayload = {
    global?: string;
    project?: string;
    projectPath?: string | null;
};

export const $customInstructions: StandardStore<CustomInstructionsUpdatePayload> = createStore<
    CustomInstructionsUpdatePayload, // TData
    CustomInstructionsUpdatePayload, // TResponse (Use the same type as TData/UUpdateData, as the handler returns this structure)
    {},                       // PPayload (no payload)
    CustomInstructionsUpdatePayload // UUpdateData (backend pushes the full object)
>({
    key: 'customInstructions',
    fetch: {
        requestType: 'getCustomInstructions',
        transformResponse: (response) => response ?? { global: '', project: undefined, projectPath: null }, // Default if null
    },
    subscribe: {
        topic: () => 'customInstructionsUpdate', // Static topic
        handleUpdate: (_currentState, updateData) => updateData, // Update is the new state
    },
    initialData: { global: '', project: undefined, projectPath: null }, // Initial default
});

// --- Mutation Stores for Settings ---

// Set Default Config
type SetDefaultConfigPayload = Partial<DefaultChatConfig>;
// Import $defaultConfig store type
import { $defaultConfig } from './chatStores';

export const $setDefaultConfig = createMutationStore<
  typeof $defaultConfig, // Target store for optimistic update
  DefaultChatConfig | null, // Target store's state type (excluding 'loading'/'error')
  SetDefaultConfigPayload, // Type for payload passed to mutate
  void // Result type from performMutation (usually void for settings)
>({
  targetAtom: $defaultConfig, // Target the defaultConfig store
  performMutation: async (payload: SetDefaultConfigPayload) => {
    await requestData<void>('setDefaultConfig', payload);
    // Backend should trigger a push update via SubscriptionManager upon success
  },
  // Optimistic update: Apply changes directly to the current state
  getOptimisticUpdate: (payload: SetDefaultConfigPayload, currentDataState: DefaultChatConfig | null | 'loading' | 'error') => {
    const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
    return {
      optimisticState: { ...(currentState ?? {}), ...payload } as DefaultChatConfig | null, // Merge payload optimistically
      revertState: currentDataState, // Store original state for potential revert
    };
  },
  // Apply mutation result (optional, as backend push should handle final state)
  // If backend doesn't push, this could return the optimistic state again, but relying on push is better.
   applyMutationResult: (_result: void, currentDataState: DefaultChatConfig | null | 'loading' | 'error', _tempId?: string) => { // Removed unused result variable
        // We rely on the backend push update via the subscription in $defaultConfig store
        // Thus, we don't need to explicitly return a new state here.
        // Return the current state (which might be the optimistic one) to satisfy types.
        const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
        return currentState; // Return current state, actual update comes via PubSub
   }
});

// Set Global Custom Instructions
type SetGlobalCustomInstructionsPayload = { instructions: string };
export const $setGlobalCustomInstructions = createMutationStore<
  typeof $customInstructions,
  CustomInstructionsUpdatePayload,
  SetGlobalCustomInstructionsPayload,
  void
>({
  targetAtom: $customInstructions,
  performMutation: async (payload: SetGlobalCustomInstructionsPayload) => {
    await requestData<void>('setGlobalCustomInstructions', payload);
  },
  getOptimisticUpdate: (payload: SetGlobalCustomInstructionsPayload, currentDataState: CustomInstructionsUpdatePayload | null | 'loading' | 'error') => {
    const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? { global: '', project: undefined, projectPath: null } : (currentDataState ?? { global: '', project: undefined, projectPath: null });
    return {
      optimisticState: { ...currentState, global: payload.instructions },
      revertState: currentDataState,
    };
  },
   applyMutationResult: (_result: void, currentDataState: CustomInstructionsUpdatePayload | null | 'loading' | 'error') => { // Removed unused result variable
       const currentStateValue = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
       return currentStateValue; // Rely on PubSub push
   }
});

// Set Project Custom Instructions
type SetProjectCustomInstructionsPayload = { instructions: string };
export const $setProjectCustomInstructions = createMutationStore<
  typeof $customInstructions,
  CustomInstructionsUpdatePayload,
  SetProjectCustomInstructionsPayload,
  void
>({
  targetAtom: $customInstructions,
  performMutation: async (payload: SetProjectCustomInstructionsPayload) => {
    await requestData<void>('setProjectCustomInstructions', payload);
  },
  getOptimisticUpdate: (payload: SetProjectCustomInstructionsPayload, currentDataState: CustomInstructionsUpdatePayload | null | 'loading' | 'error') => {
    const currentState = (currentDataState === 'loading' || currentDataState === 'error') ? { global: '', project: undefined, projectPath: null } : (currentDataState ?? { global: '', project: undefined, projectPath: null });
    // Note: Optimistic update might not know the projectPath yet if file didn't exist.
    return {
      optimisticState: { ...currentState, project: payload.instructions },
      revertState: currentDataState,
    };
  },
   applyMutationResult: (_result: void, currentDataState: CustomInstructionsUpdatePayload | null | 'loading' | 'error') => { // Removed unused result variable
       const currentStateValue = (currentDataState === 'loading' || currentDataState === 'error') ? null : currentDataState;
       return currentStateValue; // Rely on PubSub push
   }
});

// Open or Create Project Instructions File
export const $openOrCreateProjectInstructionsFile = createMutationStore<
  undefined, any, void, void
>({
  targetAtom: undefined,
  performMutation: async () => {
    await requestData<void>('openOrCreateProjectInstructionsFile');
  }
});

// Set Tool Authorization Config
type SetToolAuthPayload = { config: ToolAuthorizationConfig };
export const $setToolAuthorization = createMutationStore<
  undefined, // No specific target atom for optimistic update of the complex config
  any,
  SetToolAuthPayload,
  void
>({
  targetAtom: undefined,
  performMutation: async (payload: SetToolAuthPayload) => {
    await requestData<void>('setToolAuthorization', payload);
    // Backend should trigger tool status update via SubscriptionManager
  }
  // Optimistic update is complex here, relying on backend push is safer
});
