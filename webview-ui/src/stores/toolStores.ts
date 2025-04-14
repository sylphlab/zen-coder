import { AllToolsStatusInfo, ToolCategoryInfo } from '../../../src/common/types'; // Added ToolCategoryInfo
import { createFetcherStore } from './utils/createFetcherStore';

/**
 * Atom that fetches and subscribes to the status of all tools (standard and MCP).
 * It holds `AllToolsStatusInfo | null`. Null indicates the initial loading state.
 */
export const $allToolsStatus = createFetcherStore<AllToolsStatusInfo | null>(
  'allToolsStatusUpdate', // Topic to listen for updates
  'getAllToolsStatus',    // Request type for initial fetch
  {
    initialData: null, // Start with null
    // No transformer needed as the fetch response is the correct type
  }
);

// --- Mutation Store for Tool Authorization ---
import { WritableAtom } from 'nanostores'; // Import WritableAtom for targetAtom type
import { createMutationStore, OptimisticUpdateResult } from './utils/createMutationStore'; // Import OptimisticUpdateResult
import { ToolAuthorizationConfig } from '../../../src/common/types';
import { requestData } from '../utils/communication';
import { CategoryStatus, ToolStatus } from '../../../src/common/types';

type SetToolAuthPayload = { config: Partial<ToolAuthorizationConfig> };

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

// Define the type for the target atom explicitly
type TargetAtomType = WritableAtom<AllToolsStatusInfo | null>;

export const $setToolAuthorization = createMutationStore<
  TargetAtomType, // Use the explicit type for the target atom
  AllToolsStatusInfo | null,
  SetToolAuthPayload,
  void // Assuming no return value needed
>({
  targetAtom: $allToolsStatus,
  performMutation: async (payload: SetToolAuthPayload) => {
    await requestData<void>('setToolAuthorization', payload);
    // Backend push via $allToolsStatus subscription will eventually confirm/correct state
  },
  // `getOptimisticUpdate` receives the payload and current state,
  // and returns the { optimisticState, revertState } object directly.
  getOptimisticUpdate: (payload: SetToolAuthPayload, currentData: AllToolsStatusInfo | null): OptimisticUpdateResult<AllToolsStatusInfo | null> => {
    if (!currentData) {
      console.warn('[Optimistic Update] No current tool status data to update.');
      return { optimisticState: null, revertState: null }; // Return the required structure
    }

    // Store original state for revert - ensure deep clone
    const revertState = JSON.parse(JSON.stringify(currentData));

    console.log('[Optimistic Update] Applying update for setToolAuthorization:', payload);
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
          console.log(`[Optimistic Update] Setting category ${categoryId} to ${newStatus}`);
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
              console.log(`[Optimistic Update] Setting MCP category ${categoryId} to ${newStatus}`);
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
                console.log(`[Optimistic Update] Setting tool ${tool.id} override to ${toolConfiguredStatus}`);
                tool.status = toolConfiguredStatus; // Update the tool's configured status in nextData
            }

            // Recalculate resolvedStatus based on the tool's (potentially updated) configured status
            // and the category's (potentially updated) final status.
            const newResolvedStatus = resolveToolStatus(toolConfiguredStatus, categoryFinalStatus);
            if (tool.resolvedStatus !== newResolvedStatus) {
                console.log(`[Optimistic Update] Recalculating resolved status for ${tool.id}: ${tool.resolvedStatus} -> ${newResolvedStatus}`);
                tool.resolvedStatus = newResolvedStatus; // Update resolved status in nextData
            }
        }
    }

    console.log('[Optimistic Update] Finished applying optimistic update. Final nextData:', JSON.stringify(nextData).substring(0, 500) + '...'); // Log final state
    // Return the required structure { optimisticState, revertState }
    return { optimisticState: nextData, revertState: revertState };
  },
});

// Potential future atoms related to tools can be added here.
