import { createRouter, Router } from '@nanostores/router';
import { onMount } from 'nanostores';
import { initializeListener, requestData } from '../utils/communication'; // Import communication utils

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

let isLocationInitialized = false; // Flag to prevent persisting initial route
let unlistenRouter: (() => void) | null = null; // Store the router listener cleanup function

// Initialize communication and handle router logic on mount
onMount(router, () => {
    console.log('[Nanostores router] onMount: Initializing listener and router.');
    initializeListener(); // Initialize the global message listener

    // Fetch initial location and open router
    requestData<{ location: string | null }>('getLastLocation')
        .then(response => {
            const initialPath = response?.location || '/'; // Default to '/' (home/chat list)
            console.log(`[Nanostores router] Initial location fetched: ${initialPath}. Opening router.`);
            isLocationInitialized = false; // Ensure initial open doesn't trigger persistence
            router.open(initialPath);
            isLocationInitialized = true; // Allow persistence after initial open
        })
        .catch(err => {
            console.error("[Nanostores router] Error fetching initial location:", err);
            isLocationInitialized = false; // Ensure fallback doesn't trigger persistence
            router.open('/'); // Fallback to home on error
            isLocationInitialized = true; // Allow persistence after fallback open
        });

    // Listen for router changes and persist
    let previousPath: string | undefined = router.get()?.path; // Get initial path
    unlistenRouter = router.listen(page => {
        if (page && page.path !== previousPath && isLocationInitialized) {
            console.log(`[Nanostores router] Router changed to: ${page.path}. Persisting location.`);
            requestData('updateLastLocation', { location: page.path })
                .catch(err => console.error(`[Nanostores router] Error persisting location ${page.path}:`, err));
            previousPath = page.path;
        } else if (page && !isLocationInitialized) {
             console.log(`[Nanostores router] Router initialized to ${page.path} (before persistence starts).`);
             previousPath = page.path; // Update previousPath even on initial set
        }
    });

    // Return cleanup function for the router listener
    // We don't call cleanupListener() here as it might be needed by other stores/hooks
    return () => {
        console.log('[Nanostores router] onUnmount: Cleaning up router listener.');
        if (unlistenRouter) {
            unlistenRouter();
        }
        isLocationInitialized = false; // Reset flag on unmount
    };
});


// Example of how components might navigate (Keep for reference):
// import { router } from './stores/router';
// router.open('/settings'); // Navigate to settings
// router.open('/chat/123'); // Navigate to specific chat
// router.open('/'); // Navigate home (chat list)
