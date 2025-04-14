import { atom, onMount } from 'nanostores';
import { ProviderInfoAndStatus } from '../../../src/common/types';
import { requestData } from '../utils/communication';
import { createFetcherStore } from './utils/createFetcherStore'; // Renamed import

// --- Type for the specific fetch payload ---
type ProviderStatusFetchPayload = { payload: ProviderInfoAndStatus[] | null };

// --- Provider Status Store (using createFetcherStore) ---
export const $providerStatus = createFetcherStore<ProviderInfoAndStatus[], ProviderStatusFetchPayload>( // Renamed variable and function call
    'providerStatus',      // Topic to listen for updates
    'getProviderStatus',   // Request type for initial fetch
    {
        initialData: [],   // Start with an empty array
        // Transform the raw { payload: [...] } payload into just the array
        transformFetchResponse: (response) => response?.payload ?? [],
    }
);

// --- Available Providers Store (Simple fetch, no subscription needed?) ---
// This might not need subscription, just fetching once.
// Consider if it should be a Task or just fetched directly in components needing it.
// For consistency, let's keep it as a store for now, fetched on mount.
export const availableProvidersStore = atom<ProviderInfoAndStatus[] | null>(null);

onMount(availableProvidersStore, () => {
    console.log('[Nanostores availableProvidersStore] onMount: Fetching available providers...');
    let isMounted = true;

    requestData<ProviderInfoAndStatus[]>('getAvailableProviders')
        .then(response => {
             if (isMounted) {
                console.log('[Nanostores availableProvidersStore] Received available providers:', response);
                availableProvidersStore.set(response ?? []);
            }
        })
        .catch(err => {
             if (isMounted) {
                console.error("[Nanostores availableProvidersStore] Error fetching available providers:", err);
                availableProvidersStore.set([]); // Set to empty array on error
             }
        });

     // No subscription, just return empty cleanup
     return () => {
         isMounted = false;
     };
});

// --- Mutation Stores for Provider Settings ---
import { createMutationStore } from './utils/createMutationStore';

// Set API Key
type SetApiKeyPayload = { provider: string; apiKey: string };
export const $setApiKey = createMutationStore<
    typeof $providerStatus, // Target providerStatus for potential optimistic update
    ProviderInfoAndStatus[],
    SetApiKeyPayload,
    void // Assuming no return value needed
>({
    targetAtom: $providerStatus,
    performMutation: async (payload: SetApiKeyPayload) => {
        await requestData<void>('setApiKey', payload);
        // Update relies on backend pushing 'providerStatus' update
    },
    // Optimistic update: Assume success and mark apiKeySet as true
    getOptimisticUpdate: (payload: SetApiKeyPayload, currentState: ProviderInfoAndStatus[] | null) => {
        const updatedState = (currentState ?? []).map(p =>
            p.id === payload.provider ? { ...p, apiKeySet: true } : p
        );
        return { optimisticState: updatedState, revertState: currentState };
    },
     applyMutationResult: (result: void, currentState: ProviderInfoAndStatus[] | null /* Removed payload, use closure */) => {
         // Ensure apiKeySet is true on successful confirmation
         // Access payload via closure if needed, but here we just confirm based on success
         // For this specific case, the optimistic state should be correct upon success.
         // If we needed the providerId, it would be payload.provider from the outer scope.
         // Let's keep it simple and return the current (optimistically updated) state.
         return currentState;
         // Or, more explicitly:
         // return (currentState ?? []).map(p =>
         //     p.id === payload.provider ? { ...p, apiKeySet: true } : p
         // );
     }
});

// Delete API Key
type DeleteApiKeyPayload = { provider: string };
export const $deleteApiKey = createMutationStore<
    typeof $providerStatus,
    ProviderInfoAndStatus[],
    DeleteApiKeyPayload,
    void
>({
    targetAtom: $providerStatus,
    performMutation: async (payload: DeleteApiKeyPayload) => {
        await requestData<void>('deleteApiKey', payload);
    },
    // Optimistic update: Assume success and mark apiKeySet as false
    getOptimisticUpdate: (payload: DeleteApiKeyPayload, currentState: ProviderInfoAndStatus[] | null) => {
        const updatedState = (currentState ?? []).map(p =>
            p.id === payload.provider ? { ...p, apiKeySet: false } : p
        );
        return { optimisticState: updatedState, revertState: currentState };
    },
     applyMutationResult: (result: void, currentState: ProviderInfoAndStatus[] | null /* Removed payload, use closure */) => {
         // Ensure apiKeySet is false on successful confirmation
         // Access payload via closure if needed.
         // Return the current (optimistically updated) state.
         return currentState;
         // Or, more explicitly:
         // return (currentState ?? []).map(p =>
         //     p.id === payload.provider ? { ...p, apiKeySet: false } : p
         // );
     }
});

// Set Provider Enabled
type SetProviderEnabledPayload = { provider: string; enabled: boolean };
export const $setProviderEnabled = createMutationStore<
    typeof $providerStatus,
    ProviderInfoAndStatus[],
    SetProviderEnabledPayload,
    void
>({
    targetAtom: $providerStatus,
    performMutation: async (payload: SetProviderEnabledPayload) => {
        await requestData<void>('setProviderEnabled', payload);
    },
    // Optimistic update: Set the enabled status
    getOptimisticUpdate: (payload: SetProviderEnabledPayload, currentState: ProviderInfoAndStatus[] | null) => {
        const updatedState = (currentState ?? []).map(p =>
            p.id === payload.provider ? { ...p, enabled: payload.enabled } : p
        );
        return { optimisticState: updatedState, revertState: currentState };
    },
     applyMutationResult: (result: void, currentState: ProviderInfoAndStatus[] | null /* Removed payload, use closure */) => {
         // Ensure enabled status is correct on confirmation
         // Access payload via closure if needed.
         // Return the current (optimistically updated) state.
         return currentState;
         // Or, more explicitly:
         // return (currentState ?? []).map(p =>
         //     p.id === payload.provider ? { ...p, enabled: payload.enabled } : p
         // );
     }
});


// TODO: Add stores for other provider-related states if needed (e.g., models per provider)
