import { AllToolsStatusInfo, ToolCategoryInfo, ToolAuthorizationConfig, CategoryStatus, ToolStatus } from '../../../src/common/types';
// Removed createFetcherStore import
import { StandardStore, createStore } from './utils/createStore'; // Import createStore and StandardStore
import { WritableAtom } from 'nanostores';
import { createMutationStore, OptimisticUpdateResult } from './utils/createMutationStore';
import { requestData } from '../utils/communication';
// Removed duplicate imports for ToolAuthorizationConfig, CategoryStatus, ToolStatus

type SetToolAuthPayload = { config: Partial<ToolAuthorizationConfig> };

// --- $allToolsStatus Store (Refactored using createStore) ---
export const $allToolsStatus: StandardStore<AllToolsStatusInfo> = createStore<
    AllToolsStatusInfo, // TData: The data structure held by the store
    AllToolsStatusInfo, // TResponse: Raw fetch response type
    {},                 // PPayload: Fetch takes no payload
    AllToolsStatusInfo  // UUpdateData: PubSub pushes the full structure
>({
    key: 'allToolsStatus',
    fetch: {
        requestType: 'getAllToolsStatus',
        // No payload or transform needed
    },
    subscribe: {
        topic: 'allToolsStatusUpdate',
        handleUpdate: (currentData, updateData) => {
            // Update comes as the full AllToolsStatusInfo structure or null
            // Ensure [] is returned if updateData is null
            console.log(`[$allToolsStatus handleUpdate] Received update. Data: ${updateData ? 'array' : 'null'}`);
            return updateData ?? [];
        }
    },
    initialData: null, // Explicitly null, createStore handles 'loading'
});

// Helper to resolve tool status based on override and category status
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
    // Backend push via $allToolsStatus subscription will eventually confirm/correct state
  },
  // `getOptimisticUpdate` receives the payload and current state (which can be loading/error/null/TData),
  // and returns the { optimisticState, revertState } object directly.
  // The type OptimisticUpdateResult<TData> expects TData for optimisticState/revertState.
  getOptimisticUpdate: (payload: SetToolAuthPayload, currentState: AllToolsStatusInfo | null | 'loading' | 'error'): OptimisticUpdateResult<AllToolsStatusInfo> => {
    // Check if currentState is actually the data type
    if (currentState === 'loading' || currentState === 'error' || currentState === null) {
      // Can't perform a meaningful optimistic update. Return the original non-data state
      // cast appropriately if needed, but ideally, the mutation store handles this.
      // For type safety, we return an empty array as a placeholder TData,
      // knowing the revert state will handle restoration if needed,
      // though realistically no update happens in this path.
      const placeholderState: AllToolsStatusInfo = [];
      return { optimisticState: placeholderState, revertState: placeholderState };
    }
    // Now TypeScript knows currentState is AllToolsStatusInfo
    const currentData = currentState;

    // Store original state for revert - ensure deep clone
    const revertState = JSON.parse(JSON.stringify(currentData)) as AllToolsStatusInfo; // Type is AllToolsStatusInfo

    const newAuthConfig = payload.config;
    // Deep clone the current data to create the next state
    const nextData: AllToolsStatusInfo = JSON.parse(JSON.stringify(currentData));

    const updatedCategoryStatuses: { [categoryId: string]: CategoryStatus } = {};

    // --- Apply updates based on payload ---

    // 1. Update Category Statuses
    if (newAuthConfig.categories) {
      for (const categoryId in newAuthConfig.categories) {
        const category = nextData.find(cat => cat.id === categoryId);
        if (category) {
          const newStatus = newAuthConfig.categories[categoryId];
          // console.log(`[Optimistic Update] Setting category ${categoryId} to ${newStatus}`); // Removed log
          category.status = newStatus;
          updatedCategoryStatuses[categoryId] = newStatus; // Track for recalculation
        }
      }
    }
    if (newAuthConfig.mcpServers) {
      for (const serverName in newAuthConfig.mcpServers) {
          const categoryId = `mcp_${serverName}`;
          const category = nextData.find(cat => cat.id === categoryId);
          if (category) {
              const newStatus = newAuthConfig.mcpServers[serverName];
              // console.log(`[Optimistic Update] Setting MCP category ${categoryId} to ${newStatus}`); // Removed log
              category.status = newStatus;
              updatedCategoryStatuses[categoryId] = newStatus; // Track for recalculation
          }
      }
    }

    // 2. Update Tool Overrides (status) and Recalculate Resolved Status
    for (const category of nextData) {
        // Use the potentially updated category status for resolution
        const categoryFinalStatus = updatedCategoryStatuses[category.id] ?? category.status;

        for (const tool of category.tools) {
            let toolConfiguredStatus = tool.status; // Current configured status

            // Apply payload override if it exists for this tool
            if (newAuthConfig.overrides && tool.id in newAuthConfig.overrides) {
                toolConfiguredStatus = newAuthConfig.overrides[tool.id]!;
                // console.log(`[Optimistic Update] Setting tool ${tool.id} override to ${toolConfiguredStatus}`); // Removed log
                tool.status = toolConfiguredStatus; // Update the tool's configured status in nextData
            }

            // Recalculate resolvedStatus based on the tool's (potentially updated) configured status
            // and the category's (potentially updated) final status.
            const newResolvedStatus = resolveToolStatus(toolConfiguredStatus, categoryFinalStatus);
            if (tool.resolvedStatus !== newResolvedStatus) {
                // console.log(`[Optimistic Update] Recalculating resolved status for ${tool.id}: ${tool.resolvedStatus} -> ${newResolvedStatus}`); // Removed log
                tool.resolvedStatus = newResolvedStatus; // Update resolved status in nextData
            }
        }
    }

    // console.log('[Optimistic Update] Finished applying optimistic update. Final nextData:', JSON.stringify(nextData).substring(0, 500) + '...'); // Removed log
    // Return the required structure { optimisticState, revertState }
    return { optimisticState: nextData, revertState }; // Both are AllToolsStatusInfo type
  },
   applyMutationResult: (result: void, currentState: AllToolsStatusInfo | null | 'loading' | 'error') => {
       // Type expected: TData | null = AllToolsStatusInfo | null
       // Return the current state only if it's data, otherwise null.
       return currentState !== 'loading' && currentState !== 'error' && currentState !== null ? currentState : null;
   }
});

// Potential future atoms related to tools can be added here.
