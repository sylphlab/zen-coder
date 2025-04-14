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

// TODO: Add stores for other provider-related states if needed (e.g., models per provider)
