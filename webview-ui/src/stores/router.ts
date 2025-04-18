import { createRouter } from '@nanostores/router';
import { onMount, atom } from 'nanostores';
import { initializeListener, requestData } from '../utils/communication';
import { createStore, StandardStore } from './utils/createStore';
import { createMutationStore } from './utils/createMutationStore';

// --- Location Stores ---

// Store for initial location using createStore (fetch only)
export const $location: StandardStore<string> = createStore<
    string,                 // TData: Store holds the location string
    { location: string | null }, // TResponse: Raw response from backend
    {}                      // PPayload: No payload for fetch
    // No UUpdateData needed as there's no subscription
>({
    key: 'location',
    fetch: {
        requestType: 'getLastLocation',
        transformResponse: (response) => {
            const location = response?.location;
            // Map '/index.html' (legacy or initial load?) to '/'
            // Default to '/' if location is null or undefined
            return location === '/index.html' ? '/' : (location ?? '/');
        }
    },
    // NO subscribe configuration - this store only fetches initial state
    initialData: '/', // Default to '/' before loading
});

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
export const router = createRouter({
  home: '/',
  // Removed newChat route
  chat: '/chat/:chatId',
  settings: '/settings',
  sessions: '/sessions' // Added sessions route
});

let isLocationInitialized = atom(false);
let unlistenLocation: (() => void) | null = null;
let unlistenRouter: (() => void) | null = null;

// Initialize communication and handle router logic on mount
onMount(router, () => {
    console.log('[Nanostores router] onMount: Initializing.');
    initializeListener();

    let isFirstLocationSet = false;

    // Listen to the location store ($location) to set the initial router path
    unlistenLocation = $location.subscribe(locationValue => {
        console.log(`[Nanostores router] $location updated:`, locationValue);
        // CRITICAL FIX: Only open router if locationValue is a string AND NOT 'loading' or 'error'
        if (typeof locationValue === 'string' && locationValue !== 'loading' && locationValue !== 'error' && !isFirstLocationSet) {
            // ADDED EXTRA LOGGING HERE
            console.log(`[Nanostores router] ---> CONDITION MET! locationValue="${locationValue}". Opening router.`);
            isLocationInitialized.set(false); // Prevent persistence during this initial open
            router.open(locationValue); // Open router to the fetched location
            isLocationInitialized.set(true);
            isFirstLocationSet = true;
            // Unsubscribe from $location after setting initial route
            if (unlistenLocation) {
                unlistenLocation();
                unlistenLocation = null;
            }
        } else if (locationValue === 'error' && !isFirstLocationSet) {
            console.error('[Nanostores router] Failed to load initial location.');
            isFirstLocationSet = true; // Prevent further attempts
             if (unlistenLocation) {
                unlistenLocation();
                unlistenLocation = null;
            }
        } else {
             // Log why the condition wasn't met (if not the first time)
             if (isFirstLocationSet) {
                 // console.log(`[Nanostores router] Condition NOT met: isFirstLocationSet=true`);
             } else if (typeof locationValue !== 'string') {
                 console.log(`[Nanostores router] Condition NOT met: locationValue is not a string (${locationValue})`);
             } else if (locationValue === 'loading') {
                 console.log(`[Nanostores router] Condition NOT met: locationValue is 'loading'`);
             } else if (locationValue === 'error') {
                 console.log(`[Nanostores router] Condition NOT met: locationValue is 'error'`);
             }
        }
    });

    // Listen for router changes and persist using the mutation store
    let previousPath: string | undefined = undefined;
    const { mutate: updateLocationMutate } = $updateLastLocation.get();

    unlistenRouter = router.listen(page => {
        const currentPath = page?.path;
        if (previousPath === undefined) {
            previousPath = currentPath;
        }

        if (currentPath && currentPath !== previousPath && isLocationInitialized.get()) {
            console.log(`[Nanostores router] Router changed to: ${currentPath}. Persisting via mutation store.`);
            updateLocationMutate({ location: currentPath })
                .catch(err => console.error(`[Nanostores router] Error persisting location ${currentPath}:`, err));
            previousPath = currentPath;
        } else if (currentPath && currentPath !== previousPath) {
             previousPath = currentPath;
        }
    });

    // Return cleanup function
    return () => {
        console.log('[Nanostores router] onUnmount: Cleaning up listeners.');
        if (unlistenRouter) {
            unlistenRouter();
            unlistenRouter = null;
        }
         if (unlistenLocation) { // Clean up $location listener if it still exists
             unlistenLocation();
             unlistenLocation = null;
         }
        isLocationInitialized.set(false);
    };
});
