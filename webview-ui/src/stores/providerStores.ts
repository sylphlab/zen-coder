import { atom, onMount } from 'nanostores';
import { ProviderInfoAndStatus } from '../../../src/common/types';
import { requestData } from '../utils/communication';
import { createFetcherStore } from './utils/createFetcherStore'; // Renamed import
import { listen } from '../utils/communication'; // Import listen

// --- Type for the specific fetch payload ---
type ProviderStatusFetchPayload = { payload: ProviderInfoAndStatus[] | null };

// --- Provider Status Store (using basic atom + onMount) ---
export const $providerStatus = atom<ProviderInfoAndStatus[]>([]); // Start with empty array, null indicates loading but might cause issues

onMount($providerStatus, () => {
    const topic = 'providerStatus';
    const fetchRequestType = 'getProviderStatus';
    console.log(`[$providerStatus onMount] Initializing...`);
    let isMounted = true;
    let unsubscribe: (() => Promise<void>) | null = null;

    // Updated processData to handle both raw array and wrapped object
    const processData = (rawData: ProviderInfoAndStatus[] | ProviderStatusFetchPayload | null): ProviderInfoAndStatus[] => {
        console.log("[$providerStatus] processData called with:", JSON.stringify(rawData));
        // Handle direct array first (initial fetch)
        if (Array.isArray(rawData)) {
            console.log("[$providerStatus] processData returning raw array:", JSON.stringify(rawData.map(p => p.id)));
            return rawData;
        }
        // Handle wrapped object (push update)
        if (rawData && typeof rawData === 'object' && 'payload' in rawData && Array.isArray(rawData.payload)) {
            const result = rawData.payload;
            console.log("[$providerStatus] processData returning array from payload:", JSON.stringify(result.map(p => p.id)));
            return result; // Handle wrapped object (from push update)
        }
        console.warn("[$providerStatus] processData received unexpected format, returning empty array:", rawData);
        return [];
    };

    // 1. Subscribe to updates
    try {
        unsubscribe = listen(topic, (messagePayload: { topic: string, data: ProviderStatusFetchPayload | null }) => {
            if (isMounted && messagePayload && messagePayload.topic === topic) {
                console.log(`[$providerStatus] Received update via listen. Full messagePayload:`, JSON.stringify(messagePayload));
                const updateData = messagePayload.data;
                const processedData = processData(updateData);
                console.log(`[$providerStatus] Setting store via listener with processed data (length: ${processedData.length}):`, JSON.stringify(processedData.map(p => p.id)));
                $providerStatus.set(processedData);
                console.log(`[$providerStatus] Store value immediately after set (listener):`, JSON.stringify($providerStatus.get()?.map(p => p.id))); // Log value after set
            }
        });
    } catch (error) {
        console.error(`[$providerStatus] Error subscribing:`, error);
    }

    // 2. Initial fetch - Backend getProviderStatus actually returns the raw array
    console.log(`[$providerStatus] Fetching initial data (${fetchRequestType})...`);
    requestData<ProviderInfoAndStatus[]>(fetchRequestType) // Expect raw array
        .then(responseData => {
            if (isMounted) {
                console.log(`[$providerStatus] Received initial fetch data. Raw responseData:`, JSON.stringify(responseData)); // Log should show array
                const processedData = processData(responseData); // Process the raw array
                console.log(`[$providerStatus] Setting store via initial fetch with processed data (length: ${processedData.length}):`, JSON.stringify(processedData.map(p => p.id)));
                // Set the data regardless of subscription, listener will overwrite if update comes later
                $providerStatus.set(processedData);
                 console.log(`[$providerStatus] Store value immediately after set (fetch):`, JSON.stringify($providerStatus.get()?.map(p => p.id))); // Log value after set
            }
        })
        .catch(err => {
            if (isMounted) {
                console.error(`[$providerStatus] Error fetching initial data:`, err);
                // Keep empty array on error, don't reset to null
                // $providerStatus.set([]);
            }
        });

    // Return the cleanup function
    return () => {
        isMounted = false;
        console.log(`[$providerStatus] onUnmount: Disposing subscription.`);
        if (unsubscribe) {
            unsubscribe().catch(err => console.error(`[$providerStatus] Error disposing subscription:`, err));
        }
    };
}); // End onMount

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
