import { WritableAtom, map, MapStore } from 'nanostores';

// --- Helper Types ---

// Result of getOptimisticUpdate
interface OptimisticUpdateResult<TDataState> {
  optimisticState: TDataState | null;
  revertState: TDataState | null;
  tempId?: string;
}

// Options for createMutationStore
interface CreateMutationStoreOptions<
  TTargetAtom extends WritableAtom<TDataState | null> | undefined,
  TDataState,
  TPayload = void,
  TResult = void
> {
  targetAtom?: TTargetAtom;
  performMutation: (payload: TPayload) => Promise<TResult>;
  getOptimisticUpdate?: (payload: TPayload, currentDataState: TDataState | null) => OptimisticUpdateResult<TDataState>;
  applyMutationResult?: (result: TResult, currentDataState: TDataState | null, tempId?: string) => TDataState | null;
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
 * handling optimistic updates on a target data atom.
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
  TTargetAtom extends WritableAtom<TDataState | null> | undefined,
  TDataState,
  TPayload = void,
  TResult = void
>(
  options: CreateMutationStoreOptions<TTargetAtom, TDataState, TPayload, TResult>
): MutationStore<TPayload, TResult> { // Return type is the specific MapStore
  const { targetAtom, performMutation, getOptimisticUpdate, applyMutationResult } = options;

  // Define the mutate function logic separately
  // It will reference the store instance via closure after the store is created
  let storeInstance: MutationStore<TPayload, TResult>;

  const mutate: MutateFn<TPayload, TResult> = async (payload: TPayload): Promise<TResult> => {
    let originalDataState: TDataState | null = null;
    let revertDataState: TDataState | null = null;
    let tempId: string | undefined = undefined;
    let optimisticUpdateApplied = false;

    // Update state within the storeInstance
    storeInstance.setKey('loading', true);
    storeInstance.setKey('error', null);
    console.log(`[MutationStore] Mutate started.`);

    // Optimistic Update
    if (targetAtom && getOptimisticUpdate) {
      originalDataState = targetAtom.get();
      const updateInfo = getOptimisticUpdate(payload, originalDataState);
      revertDataState = updateInfo.revertState;
      tempId = updateInfo.tempId;
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
        const currentDataState = targetAtom.get();
        const finalDataState = applyMutationResult(result, currentDataState, tempId);
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
