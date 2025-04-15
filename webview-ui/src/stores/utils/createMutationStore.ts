import { WritableAtom, task, map, MapStore } from 'nanostores';
// Import the new StandardStore type
import { StandardStore } from './createStore';

// --- Helper Types ---

// Result of getOptimisticUpdate - Exported for use in store definitions
export interface OptimisticUpdateResult<TDataState> {
  optimisticState: TDataState | null; // Optimistic update should result in TData or null
  revertState: TDataState | null | 'loading' | 'error'; // Revert state can be any previous valid state
  tempId?: string;
}

// The possible state types for the target StandardStore
type TargetStoreState<TDataState> = TDataState | null | 'loading' | 'error';

// Options for createMutationStore
interface CreateMutationStoreOptions<
  // Update TTargetAtom constraint to use StandardStore
  TTargetAtom extends StandardStore<TDataState> | undefined,
  TDataState,
  TPayload = void,
  TResult = void
> {
  targetAtom?: TTargetAtom;
  performMutation: (payload: TPayload) => Promise<TResult>;
  // Update currentDataState type in callback signatures
  getOptimisticUpdate?: (payload: TPayload, currentDataState: TargetStoreState<TDataState>) => OptimisticUpdateResult<TDataState>;
  applyMutationResult?: (result: TResult, currentDataState: TargetStoreState<TDataState>, tempId?: string) => TDataState | null;
}

// Type for the function signature of the mutate action
type MutateFn<TPayload = void, TResult = void> = (payload: TPayload) => Promise<TResult>;

// Type for the state held within the returned map store's value
// It includes the mutate function itself.
export interface MutationStoreValue<TPayload = void, TResult = void> {
  loading: boolean;
  error: Error | null;
  mutate: MutateFn<TPayload, TResult>;
  // Add other states like lastResult if needed
}

// Type alias for the MapStore returned by the factory
export type MutationStore<TPayload = void, TResult = void> = MapStore<MutationStoreValue<TPayload, TResult>>;


/**
 * Creates a Nanostores map store that manages the state (`loading`, `error`)
 * and provides a `mutate` function for an asynchronous action, optionally
 * handling optimistic updates on a target data atom (StandardStore).
 *
 * Usage in component:
 * ```jsx
 * import { useStore } from '@nanostores/react';
 * import { $myMutationStore } from './stores';
 *
 * function MyComponent() {
 *   const { mutate, loading, error } = useStore($myMutationStore);
 *   // ...
 *   return <button onClick={() => mutate(payload)} disabled={loading}>Go</button>;
 * }
 * ```
 *
 * @param options Configuration options.
 * @returns A MapStore where the value is `{ loading, error, mutate }`.
 */
export function createMutationStore<
  // Update TTargetAtom constraint
  TTargetAtom extends StandardStore<TDataState> | undefined,
  TDataState,
  TPayload = void,
  TResult = void
>(
  options: CreateMutationStoreOptions<TTargetAtom, TDataState, TPayload, TResult>
): MutationStore<TPayload, TResult> {
  const { targetAtom, performMutation, getOptimisticUpdate, applyMutationResult } = options;

  // Define the mutate function logic separately
  let storeInstance: MutationStore<TPayload, TResult>;

  const mutate: MutateFn<TPayload, TResult> = async (payload: TPayload): Promise<TResult> => {
    // originalDataState now holds the full state including 'loading'/'error'
    let originalDataState: TargetStoreState<TDataState> | null = null;
    // revertDataState also needs to hold the full possible state range
    let revertDataState: TargetStoreState<TDataState> | null = null;
    let tempId: string | undefined = undefined;
    let optimisticUpdateApplied = false;

    // Update state within the storeInstance
    storeInstance.setKey('loading', true);
    storeInstance.setKey('error', null);
    console.log(`[MutationStore] Mutate started.`);

    // Optimistic Update
    if (targetAtom && getOptimisticUpdate) {
      originalDataState = targetAtom.get(); // Get the full state ('loading', 'error', TData, null)
      // Pass the full state to getOptimisticUpdate
      const updateInfo = getOptimisticUpdate(payload, originalDataState);
      // revertState now correctly uses the full original state
      revertDataState = updateInfo.revertState;
      tempId = updateInfo.tempId;
      // Optimistic update should result in TData or null, not 'loading'/'error'
      targetAtom.set(updateInfo.optimisticState);
      optimisticUpdateApplied = true;
      console.log(`[MutationStore] Applied optimistic update to target atom.`);
    }

    try {
      // Perform Backend Mutation
      const result = await performMutation(payload);
      console.log(`[MutationStore] performMutation succeeded.`);

      // Apply Result to Target Atom
      if (targetAtom && applyMutationResult) {
        // Get the potentially optimistically updated state
        const currentDataState = targetAtom.get();
        // Pass the full current state to applyMutationResult
        const finalDataState = applyMutationResult(result, currentDataState, tempId);
        // Final state should be TData or null
        targetAtom.set(finalDataState);
        console.log(`[MutationStore] Applied mutation result to target atom.`);
      } else if (optimisticUpdateApplied) {
         console.log(`[MutationStore] Optimistic update applied, but no applyMutationResult provided.`);
      }

      // Finish Mutation (Success)
      storeInstance.setKey('loading', false);
      console.log(`[MutationStore] Mutate finished successfully.`);
      return result;

    } catch (err: any) {
      // Finish Mutation (Error)
      console.error(`[MutationStore] performMutation failed.`, err);
      storeInstance.setKey('loading', false);
      storeInstance.setKey('error', err instanceof Error ? err : new Error(String(err)));

      // Rollback Optimistic Update
      if (optimisticUpdateApplied && targetAtom) {
        console.log(`[MutationStore] Rolling back optimistic update on target atom.`);
        // Rollback to the original full state (which might have been 'loading', 'error', etc.)
        targetAtom.set(revertDataState);
      }

      throw err; // Re-throw
    }
  };

  // Create the map store, including the mutate function in its initial value
  storeInstance = map<MutationStoreValue<TPayload, TResult>>({
    loading: false,
    error: null,
    mutate: mutate, // Include the mutate function as part of the store's value
  });

  return storeInstance;
}
