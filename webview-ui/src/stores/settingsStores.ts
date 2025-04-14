// No direct CustomInstructions type exported, define it inline based on usage
import { createFetcherStore } from './utils/createFetcherStore';
import { requestData } from '../utils/communication';

/**
 * Define the shape of the custom instructions data
 */
type CustomInstructionsData = { global: string; project: string | null; projectPath: string | null };

/**
 * Represents the raw payload received from the backend for custom instructions.
 * Adjust based on the actual payload structure if needed.
 */
type CustomInstructionsPayload = { payload: CustomInstructionsData | null };

/**
 * Store that fetches and subscribes to custom instructions (global and project).
 * Holds `CustomInstructionsData | null`. Null indicates the initial loading state.
 */
export const $customInstructions = createFetcherStore<CustomInstructionsData | null, CustomInstructionsPayload>(
  'customInstructions',   // Topic to listen for updates
  'getCustomInstructions', // Request type for initial fetch
  {
    initialData: null,    // Start with null
    // Transform the raw { payload: {...} } payload into just the object
    transformFetchResponse: (response) => response?.payload ?? null,
  }
);

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
