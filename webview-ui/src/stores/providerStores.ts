import { atom, onMount } from 'nanostores';
import { ProviderInfoAndStatus, AvailableModel } from '../../../src/common/types';
import { Operation } from 'fast-json-patch'; // Import Operation directly
import { requestData } from '../utils/communication';
import { createMutationStore } from './utils/createMutationStore';
import { StandardStore, createStore } from './utils/createStore'; // Import createStore and StandardStore
import { listen } from '../utils/communication'; // Ensure listen is imported

// --- Type for the specific PubSub update payload ---
// Removed ProviderStatusUpdatePayload as we expect Operation[] now

// --- Provider Status Store (Refactored using createStore) ---
export const $providerStatus: StandardStore<ProviderInfoAndStatus[]> = createStore<
    ProviderInfoAndStatus[],          // TData: What the store eventually holds (an array)
    ProviderInfoAndStatus[],          // TResponse: Raw response from fetch request ('getProviderStatus')
    {},                               // PPayload: Fetch request takes no payload
    Operation[]                       // UUpdateData: Expecting JSON Patch array
>({
    key: 'providerStatus',
    fetch: {
        requestType: 'getProviderStatus',
        // No payload needed for getProviderStatus
        // No transformResponse needed as fetch response matches TData
    },
    subscribe: {
        topic: 'providerStatus', // Static topic
        // handleUpdate is now handled internally by createStore for JSON patches
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
// This listener might need adjustment if backend pushes patches for models too.
// For now, assume it pushes the full list for the specific provider.
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

    console.log(`[fetchModels Function] Fetching models for provider: ${providerId}`);
    const currentState = $modelsForSelectedProvider.get();
    $modelsForSelectedProvider.set({
        loading: true,
        error: null,
        models: currentState.providerId === providerId ? currentState.models : [],
        providerId: providerId
    });

    try {
        const models = await requestData<AvailableModel[]>('getModelsForProvider', { providerId });
        console.log(`[fetchModels Function] Received ${models.length} models for ${providerId}.`);
        $modelsForSelectedProvider.set({ loading: false, error: null, models, providerId });
    } catch (error: any) {
        console.error(`[fetchModels Function] Error fetching models for ${providerId}:`, error);
        $modelsForSelectedProvider.set({ loading: false, error: error.message || 'Failed to fetch models', models: [], providerId });
    }
}


// --- Mutation Stores for Provider Settings ---

// Set API Key
type SetApiKeyPayload = { provider: string; apiKey: string };
export const $setApiKey = createMutationStore<
  StandardStore<ProviderInfoAndStatus[]>, // Use StandardStore type
  ProviderInfoAndStatus[],
  SetApiKeyPayload,
  void
>({
  targetAtom: $providerStatus, // Keep targetAtom for potential future optimistic patch
  performMutation: async (payload: SetApiKeyPayload) => {
    await requestData<void>('setApiKey', payload);
    // Update relies on backend pushing 'providerStatus' update (as JSON Patch)
  },
  // Removed getOptimisticUpdate and applyMutationResult
});

// Delete API Key
type DeleteApiKeyPayload = { provider: string };
export const $deleteApiKey = createMutationStore<
  StandardStore<ProviderInfoAndStatus[]>, // Use StandardStore type
  ProviderInfoAndStatus[],
  DeleteApiKeyPayload,
  void
>({
  targetAtom: $providerStatus, // Keep targetAtom
  performMutation: async (payload: DeleteApiKeyPayload) => {
    await requestData<void>('deleteApiKey', payload);
    // Update relies on backend pushing 'providerStatus' update (as JSON Patch)
  },
  // Removed getOptimisticUpdate and applyMutationResult
});

// Set Provider Enabled
type SetProviderEnabledPayload = { provider: string; enabled: boolean };
export const $setProviderEnabled = createMutationStore<
  StandardStore<ProviderInfoAndStatus[]>, // Use StandardStore type
  ProviderInfoAndStatus[],
  SetProviderEnabledPayload,
  void
>({
  targetAtom: $providerStatus, // Keep targetAtom
  performMutation: async (payload: SetProviderEnabledPayload) => {
    await requestData<void>('setProviderEnabled', payload);
    // Update relies on backend pushing 'providerStatus' update (as JSON Patch)
  },
  // Removed getOptimisticUpdate and applyMutationResult
});
