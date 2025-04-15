import { atom, onMount } from 'nanostores';
import { ProviderInfoAndStatus, AvailableModel } from '../../../src/common/types';
import { requestData } from '../utils/communication';
import { createMutationStore } from './utils/createMutationStore';
import { StandardStore, createStore } from './utils/createStore'; // Import createStore and StandardStore

// --- Type for the specific PubSub update payload ---
// Backend currently pushes { payload: ProviderInfoAndStatus[] | null }
type ProviderStatusUpdatePayload = { payload: ProviderInfoAndStatus[] | null };

// --- Provider Status Store (Refactored using createStore) ---
export const $providerStatus: StandardStore<ProviderInfoAndStatus[]> = createStore<
    ProviderInfoAndStatus[],          // TData: What the store eventually holds (an array)
    ProviderInfoAndStatus[],          // TResponse: Raw response from fetch request ('getProviderStatus')
    {},                               // PPayload: Fetch request takes no payload
    ProviderStatusUpdatePayload       // UUpdateData: Type of data from pubsub 'providerStatus' topic
>({
    key: 'providerStatus',
    fetch: {
        requestType: 'getProviderStatus',
        // No payload needed for getProviderStatus
        // No transformResponse needed as fetch response matches TData
    },
    subscribe: {
        topic: 'providerStatus', // Static topic
        handleUpdate: (currentData, updateData) => {
            // The updateData is { payload: ProviderInfoAndStatus[] | null }
            // Return the payload array, or an empty array if payload is null/undefined
            const newList = updateData?.payload ?? []; // Ensure [] instead of null
            console.log(`[$providerStatus handleUpdate] Received update. New list length: ${newList.length}`);
            return newList;
        }
    },
    initialData: [], // Start with empty array before loading
});

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


// --- Pub/Sub Listener for Model Updates ---
import { listen } from '../utils/communication';

onMount($modelsForSelectedProvider, () => {
    console.log('[$modelsForSelectedProvider onMount] Setting up listener for providerModelsUpdate');
    // Define the expected type for the update data payload
    type ProviderModelsUpdatePayload = { providerId: string; models: AvailableModel[]; source: 'fetch' | 'cache' };

    const unsubscribe = listen('providerModelsUpdate', (updateData: any) => {
        // Type assertion/check for safety
        const payload = updateData as ProviderModelsUpdatePayload;
        if (!payload || typeof payload.providerId !== 'string' || !Array.isArray(payload.models)) {
             console.warn('[$modelsForSelectedProvider listener] Received invalid update data:', updateData);
             return;
        }

        const currentStore = $modelsForSelectedProvider.get();
        console.log(`[$modelsForSelectedProvider listener] Received update for ${payload.providerId}. Current store provider: ${currentStore.providerId}`);
        // Only update if the push is for the currently selected provider
        if (payload.providerId === currentStore.providerId) {
            console.log(`[$modelsForSelectedProvider listener] Updating models for ${payload.providerId} from background fetch.`);
            $modelsForSelectedProvider.set({
                ...currentStore,
                models: payload.models,
                loading: false, // Ensure loading is false after background update
                error: null,    // Clear any previous error
            });
        }
    });

    // Cleanup function
    return () => {
        console.log('[$modelsForSelectedProvider onMount] Cleaning up listener for providerModelsUpdate');
        unsubscribe();
    };
});

// Function to fetch models for a given providerId
export async function fetchModels(providerId: string | null) {
    if (!providerId) {
        console.log('[fetchModels Function] No providerId, clearing models.');
        $modelsForSelectedProvider.set({ loading: false, error: null, models: [], providerId: null });
        return; // Exit if no provider is selected
    }

    // Removed early return check to force fetch/state update
    // const currentState = $modelsForSelectedProvider.get();
    // if (currentState.providerId === providerId && !currentState.error) {
    //     console.log(`[fetchModels Function] Models for ${providerId} already loaded.`);
    //     // Optionally re-fetch if needed, but for now, just return if loaded
    //     return;
    // }

    console.log(`[fetchModels Function] Fetching models for provider: ${providerId}`);
    // Ensure loading state is set correctly, even if providerId hasn't changed from the store's perspective yet
    const currentState = $modelsForSelectedProvider.get(); // Get state again just before setting loading
    $modelsForSelectedProvider.set({
        loading: true,
        error: null,
        models: currentState.providerId === providerId ? currentState.models : [], // Keep old models if same provider, clear otherwise
        providerId: providerId // Always update providerId here
    });

    try {
        // Corrected requestType to match the registered backend handler
        const models = await requestData<AvailableModel[]>('getModelsForProvider', { providerId });
        console.log(`[fetchModels Function] Received ${models.length} models for ${providerId}.`);
        $modelsForSelectedProvider.set({ loading: false, error: null, models, providerId });
    } catch (error: any) {
        console.error(`[fetchModels Function] Error fetching models for ${providerId}:`, error);
        $modelsForSelectedProvider.set({ loading: false, error: error.message || 'Failed to fetch models', models: [], providerId });
    }
}


// --- Available Providers Store (DEPRECATED - Use $providerStatus) ---
// Removed availableProvidersStore and its onMount block.

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
    getOptimisticUpdate: (payload: SetApiKeyPayload, currentState: ProviderInfoAndStatus[] | null | 'loading' | 'error') => {
        // Only apply optimistic update if currentState is an array
        if (!Array.isArray(currentState)) {
            // Return nulls to satisfy the expected type OptimisticUpdateResult<TData>
            return { optimisticState: null, revertState: null };
        }
        const updatedState = currentState.map(p =>
            p.id === payload.provider ? { ...p, apiKeySet: true } : p
        );
        return { optimisticState: updatedState, revertState: currentState };
    },
     applyMutationResult: (result: void, currentState: ProviderInfoAndStatus[] | null | 'loading' | 'error' /* Removed payload, use closure */) => {
         // Since the update relies on a backend push, we don't modify the state based on the result here.
         // Return the current state if it's data, otherwise null to satisfy the return type.
         return Array.isArray(currentState) ? currentState : null;
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
    getOptimisticUpdate: (payload: DeleteApiKeyPayload, currentState: ProviderInfoAndStatus[] | null | 'loading' | 'error') => {
        // Only apply optimistic update if currentState is an array
        if (!Array.isArray(currentState)) {
            // Return nulls to satisfy the expected type OptimisticUpdateResult<TData>
            return { optimisticState: null, revertState: null };
        }
        const updatedState = currentState.map(p =>
            p.id === payload.provider ? { ...p, apiKeySet: false } : p
        );
        return { optimisticState: updatedState, revertState: currentState };
    },
     applyMutationResult: (result: void, currentState: ProviderInfoAndStatus[] | null | 'loading' | 'error' /* Removed payload, use closure */) => {
        // Since the update relies on a backend push, we don't modify the state based on the result here.
        // Return the current state if it's data, otherwise null to satisfy the return type.
         return Array.isArray(currentState) ? currentState : null;
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
    getOptimisticUpdate: (payload: SetProviderEnabledPayload, currentState: ProviderInfoAndStatus[] | null | 'loading' | 'error') => {
         // Only apply optimistic update if currentState is an array
         if (!Array.isArray(currentState)) {
             // Return nulls to satisfy the expected type OptimisticUpdateResult<TData>
             return { optimisticState: null, revertState: null };
         }
        const updatedState = currentState.map(p =>
            p.id === payload.provider ? { ...p, enabled: payload.enabled } : p
        );
        return { optimisticState: updatedState, revertState: currentState };
    },
     applyMutationResult: (result: void, currentState: ProviderInfoAndStatus[] | null | 'loading' | 'error' /* Removed payload, use closure */) => {
        // Since the update relies on a backend push, we don't modify the state based on the result here.
        // Return the current state if it's data, otherwise null to satisfy the return type.
         return Array.isArray(currentState) ? currentState : null;
     }
});
