import { createRouter } from '@nanostores/router'; // Removed unused Router import
import { onMount, atom } from 'nanostores'; // Added atom
import { initializeListener, requestData } from '../utils/communication';
import { createFetcherStore } from './utils/createFetcherStore';
import { createMutationStore } from './utils/createMutationStore';

// --- Location Stores ---

// Fetcher store for initial location
export const $location = createFetcherStore<string | null, { location: string | null }>(
    // No topic needed, just initial fetch
    '', // Placeholder topic, won't be used for listening
    'getLastLocation',
    {
        initialData: null, // Start as null until fetched
        transformFetchResponse: (response) => {
            const location = response?.location;
            // Map '/index.html' (legacy or initial load?) to '/'
            return location === '/index.html' ? '/' : (location ?? '/');
        },
    }
);

// Mutation store to update last location
type UpdateLocationPayload = { location: string };
export const $updateLastLocation = createMutationStore<
    undefined, any, UpdateLocationPayload, void
>({
    performMutation: async (payload: UpdateLocationPayload) => {
        await requestData<void>('updateLastLocation', payload);
    }
    // No optimistic/apply needed, just fire-and-forget persistence
});


// --- Router Definition ---
// Define routes. The keys are route names, values are path patterns.
// '/' (home) -> Chat List Page
// '/chat/:chatId' -> Specific Chat Page
// '/settings' -> Settings Page
// Let TypeScript infer the specific route types
export const router = createRouter({
  home: '/',
  chat: '/chat/:chatId',
  settings: '/settings'
});

let isLocationInitialized = atom(false); // Flag to prevent persisting initial route (use atom)
let unlistenLocation: (() => void) | null = null; // Listener for the location store
let unlistenRouter: (() => void) | null = null; // Listener for the router store

// Initialize communication and handle router logic on mount
onMount(router, () => {
    console.log('[Nanostores router] onMount: Initializing.');
    initializeListener(); // Initialize the global message listener

    let isFirstLocationSet = false; // Track if the router has been set from fetched location

    // Listen to the location store to set the initial router path
    unlistenLocation = $location.subscribe(locationValue => {
        if (locationValue !== null && !isFirstLocationSet) {
            console.log(`[Nanostores router] Initial location store ready: ${locationValue}. Opening router.`);
            isLocationInitialized.set(false); // Ensure initial open doesn't trigger persistence
            router.open(locationValue);
            isLocationInitialized.set(true); // Allow persistence after initial open
            isFirstLocationSet = true; // Prevent setting it again
            // Unsubscribe from location store once initialized
            if (unlistenLocation) {
                unlistenLocation();
                unlistenLocation = null;
            }
        }
    });

    // Listen for router changes and persist using the mutation store
    let previousPath: string | undefined = router.get()?.path;
    const { mutate: updateLocationMutate } = $updateLastLocation.get(); // Get mutate function

    unlistenRouter = router.listen(page => {
        if (page && page.path !== previousPath && isLocationInitialized.get()) {
            console.log(`[Nanostores router] Router changed to: ${page.path}. Persisting via mutation store.`);
            updateLocationMutate({ location: page.path })
                .catch(err => console.error(`[Nanostores router] Error persisting location ${page.path}:`, err));
            previousPath = page.path;
        } else if (page) {
             // Update previousPath even if not persisting (e.g., initial set)
             previousPath = page.path;
        }
    });

    // Return cleanup function for the router listener
    // We don't call cleanupListener() here as it might be needed by other stores/hooks
    return () => {
        console.log('[Nanostores router] onUnmount: Cleaning up listeners.');
        if (unlistenRouter) {
            unlistenRouter();
            unlistenRouter = null;
        }
         if (unlistenLocation) { // Also clean up location listener if it exists
             unlistenLocation();
             unlistenLocation = null;
         }
        isLocationInitialized.set(false); // Reset flag on unmount using .set()
    };
});


// Example of how components might navigate (Keep for reference):
// import { router } from './stores/router';
// router.open('/settings'); // Navigate to settings
// router.open('/chat/123'); // Navigate to specific chat
// router.open('/'); // Navigate home (chat list)
