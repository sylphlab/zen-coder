import { AllToolsStatusInfo, ToolCategoryInfo, ToolAuthorizationConfig, CategoryStatus, ToolStatus } from '../../../src/common/types';
import { Operation } from 'fast-json-patch'; // Import Operation directly
import { StandardStore, createStore } from './utils/createStore'; // Import createStore and StandardStore
import { WritableAtom } from 'nanostores';
import { createMutationStore } from './utils/createMutationStore'; // Removed OptimisticUpdateResult import as it's no longer used here
import { requestData } from '../utils/communication';

type SetToolAuthPayload = { config: Partial<ToolAuthorizationConfig> };

// --- $allToolsStatus Store (Refactored using createStore) ---
export const $allToolsStatus: StandardStore<AllToolsStatusInfo> = createStore<
    AllToolsStatusInfo, // TData: The data structure held by the store
    AllToolsStatusInfo, // TResponse: Raw fetch response type
    {},                 // PPayload: Fetch takes no payload
    Operation[]         // UUpdateData: Expecting JSON Patch array
>({
    key: 'allToolsStatus',
    fetch: {
        requestType: 'getAllToolsStatus',
        // No payload or transform needed
    },
    subscribe: {
        topic: 'allToolsStatusUpdate',
        // handleUpdate is now handled internally by createStore for JSON patches
    },
    initialData: [], // Start with empty array
});

// Helper to resolve tool status based on override and category status (Keep for potential optimistic patch calculation)
const resolveToolStatus = (toolOverride: ToolStatus, categoryStatus: CategoryStatus): CategoryStatus => {
    if (toolOverride === ToolStatus.Inherited) {
        return categoryStatus;
    }
    switch (toolOverride) {
        case ToolStatus.AlwaysAvailable: return CategoryStatus.AlwaysAvailable;
        case ToolStatus.RequiresAuthorization: return CategoryStatus.RequiresAuthorization;
        case ToolStatus.Disabled: return CategoryStatus.Disabled;
        default: return categoryStatus;
    }
};

// Define the type for the target atom explicitly using StandardStore
type TargetAtomType = StandardStore<AllToolsStatusInfo>;

export const $setToolAuthorization = createMutationStore<
  TargetAtomType, // Use the explicit type for the target atom
  AllToolsStatusInfo, // TData matches StandardStore's data type
  SetToolAuthPayload,
  void // Assuming no return value needed
>({
  targetAtom: $allToolsStatus, // Target the new store
  performMutation: async (payload: SetToolAuthPayload) => {
    await requestData<void>('setToolAuthorization', payload);
    // Backend push via $allToolsStatus subscription (as JSON Patch) will eventually confirm/correct state
  },
  // Removed getOptimisticUpdate and applyMutationResult
  // If optimistic update is needed later, calculate patch and pass via mutate options
});

// Potential future atoms related to tools can be added here.
