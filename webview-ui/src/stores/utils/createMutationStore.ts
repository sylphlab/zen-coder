import { WritableAtom, task, map, MapStore } from 'nanostores';
import { Operation } from 'fast-json-patch'; // Import Operation type
// Import the new StandardStore type
import { StandardStore } from './createStore';

// --- Helper Types ---

// The possible state types for the target StandardStore
type TargetStoreState<TDataState> = TDataState | null | 'loading' | 'error';

// Options for createMutationStore
interface CreateMutationStoreOptions<
  TTargetAtom extends StandardStore<TDataState> | undefined,
  TDataState,
  TPayload = void,
  TResult = void
> {
  targetAtom?: TTargetAtom; // The store to apply optimistic updates to
  performMutation: (payload: TPayload) => Promise<TResult>; // The actual backend request
}

// Type for the options passed to the mutate function
interface MutateOptions<TDataState> { // Make it generic
  optimisticState?: TDataState | null; // Optional full optimistic state
}

// Type for the function signature of the mutate action
type MutateFn<TPayload = void, TResult = void, TDataState = any> = ( // Add TDataState generic
  payload: TPayload,
  options?: MutateOptions<TDataState> // Use generic MutateOptions
) => Promise<TResult>;

// Type for the state held within the returned map store's value
// It includes the mutate function itself.
export interface MutationStoreValue<TPayload = void, TResult = void, TDataState = any> { // Add TDataState
  loading: boolean;
  error: Error | null;
  mutate: MutateFn<TPayload, TResult, TDataState>; // Use generic MutateFn
  // Add other states like lastResult if needed
}

// Type alias for the MapStore returned by the factory
export type MutationStore<TPayload = void, TResult = void, TDataState = any> = MapStore<MutationStoreValue<TPayload, TResult, TDataState>>; // Add TDataState


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
 *   return <button onClick={() => mutate(payload, { optimisticState: newState })} disabled={loading}>Go</button>;
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
): MutationStore<TPayload, TResult, TDataState> { // Add TDataState
  // Correctly destructure options ONCE
  const { targetAtom, performMutation } = options;

  let storeInstance: MutationStore<TPayload, TResult, TDataState>; // Add TDataState

  // Update mutate function signature
  const mutate: MutateFn<TPayload, TResult, TDataState> = async ( // Add TDataState
    payload: TPayload,
    options?: MutateOptions<TDataState> // Use generic
  ): Promise<TResult> => {
    let optimisticUpdateApplied = false;
    const optimisticState = options?.optimisticState; // Get optimistic state instead of patch

    // Update state within the storeInstance
    storeInstance.setKey('loading', true);
    storeInstance.setKey('error', null);
    console.log(`[MutationStore] Mutate started.`);

    // Apply Optimistic State if provided
    if (targetAtom && optimisticState !== undefined) { // Check for undefined, allows null
      try {
        // Use 'as any' for now to access the internal method, or improve typing later
        (targetAtom as any)._setOptimisticState(optimisticState); // Call new method
        optimisticUpdateApplied = true;
        console.log(`[MutationStore] Applied optimistic state to target atom.`);
      } catch (e) {
        console.error(`[MutationStore] Error applying optimistic state:`, e);
        // Let's proceed for now, but log the error.
      }
    }

    try {
      // Perform Backend Mutation
      const result = await performMutation(payload);
      console.log(`[MutationStore] performMutation succeeded.`);

      // Backend patch will arrive via subscription and update the actual state,
      // which automatically clears the optimistic state in createStore.

      // Finish Mutation (Success)
      storeInstance.setKey('loading', false);
      console.log(`[MutationStore] Mutate finished successfully.`);
      return result;

    } catch (err: any) {
      // Finish Mutation (Error)
      console.error(`[MutationStore] performMutation failed.`, err);
      storeInstance.setKey('loading', false);
      storeInstance.setKey('error', err instanceof Error ? err : new Error(String(err)));

      // Rollback Optimistic Update by clearing optimistic state
      if (optimisticUpdateApplied && targetAtom) {
        console.log(`[MutationStore] Clearing optimistic state on target atom due to error.`);
        targetAtom.clearOptimisticState();
      }

      throw err; // Re-throw
    }
  };

  // Create the map store, including the mutate function in its initial value
  storeInstance = map<MutationStoreValue<TPayload, TResult, TDataState>>({ // Add TDataState
    loading: false,
    error: null,
    mutate: mutate, // Include the mutate function as part of the store's value
  });

  return storeInstance;
}
