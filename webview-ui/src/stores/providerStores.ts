import { atom, onMount, task } from 'nanostores'; // Added task
import { ProviderInfoAndStatus, AvailableModel } from '../../../src/common/types'; // Added AvailableModel
import { requestData } from '../utils/communication';
// Removed createFetcherStore import as we'll use task or manual fetch
import { listen } from '../utils/communication'; // Import listen
import { createMutationStore } from './utils/createMutationStore';

// --- Type for the specific fetch payload ---
type ProviderStatusFetchPayload = { payload: ProviderInfoAndStatus[] | null };

// --- Provider Status Store (using basic atom + onMount) ---
export const $providerStatus = atom<ProviderInfoAndStatus[]>([]); // Start with empty array

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

// --- Models for Selected Provider Store ---
// Holds the state for models of the currently selected provider
export const $modelsForSelectedProvider = atom<{
    loading: boolean;
    error: string | null;
    models: AvailableModel[];
    providerId: string | null; // Keep track of which provider the models are for
}>({
    loading: false,
    error: null,
    models: [],
    providerId: null,
});

// Function to fetch models for a given providerId
export async function fetchModels(providerId: string | null) {
    if (!providerId) {
        console.log('[fetchModels Function] No providerId, clearing models.');
        $modelsForSelectedProvider.set({ loading: false, error: null, models: [], providerId: null });
        return; // Exit if no provider is selected
    }

    // Check if we already have models for this provider
    const currentState = $modelsForSelectedProvider.get();
    if (currentState.providerId === providerId && !currentState.error) {
        console.log(`[fetchModels Function] Models for ${providerId} already loaded.`);
        // Optionally re-fetch if needed, but for now, just return if loaded
        return;
    }

    console.log(`[fetchModels Function] Fetching models for provider: ${providerId}`);
    $modelsForSelectedProvider.set({ ...currentState, loading: true, error: null, providerId }); // Set loading state

    try {
        const models = await requestData<AvailableModel[]>('getModelsForProvider', { providerId });
        console.log(`[fetchModels Function] Received ${models.length} models for ${providerId}.`);
        $modelsForSelectedProvider.set({ loading: false, error: null, models, providerId });
    } catch (error: any) {
        console.error(`[fetchModels Function] Error fetching models for ${providerId}:`, error);
        $modelsForSelectedProvider.set({ loading: false, error: error.message || 'Failed to fetch models', models: [], providerId });
    }
}


// --- Available Providers Store (DEPRECATED - Use $providerStatus) ---
// Keeping for reference but likely removable as $providerStatus has the necessary info
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
         return currentState; // Optimistic state is correct on success
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
         return currentState; // Optimistic state is correct on success
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
         return currentState; // Optimistic state is correct on success
     }
});
