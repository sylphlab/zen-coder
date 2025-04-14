import { useEffect, useRef, useState } from 'preact/hooks'; // Import useState
import { useLocation } from 'wouter';
// Import FP communication functions, including new location-specific ones
import {
    initializeListener,
    cleanupListener,
    fetchInitialLocationFP,
    persistLocationFP
} from '../utils/communication';

/**
 * Custom hook to synchronize wouter location with backend persistence using FP communication module.
 * It also manages the communication listener lifecycle.
 * - Fetches initial location from backend on mount and sets wouter's location.
 * - Listens to wouter location changes and persists them to the backend.
 *
 * This hook should be called once in the main App component.
 * @returns {{ isLoading: boolean }} An object containing the loading state.
 */
export function useLocationSync(): { isLoading: boolean } {
    const [location, setLocation] = useLocation();
    const [isLoading, setIsLoading] = useState(true); // Add loading state, default true
    // Removed initialFetchDoneRef and isMountedRef
    const previousLocationRef = useRef<string | null>(location); // Initialize with current location

    // Combined Effect for Listener Lifecycle and Initial Fetch (Runs once on mount)
    useEffect(() => {
        console.log('[useLocationSync Lifecycle & Init] Initializing listener and starting fetch...');
        initializeListener(); // Initialize listener

        // --- Initial Fetch Logic (using extracted function) ---
        fetchInitialLocationFP()
            .then(backendLocation => {
                // No need to check isMountedRef here, effect cleanup handles unmounts
                console.log(`[useLocationSync FP Init] Fetched backend location: ${backendLocation}, Current wouter location before potential set: ${location}`);

                // Compare with the location *at the time of fetch completion*
                if (backendLocation && backendLocation !== location) {
                     console.log(`[useLocationSync FP Init] Setting wouter location to: ${backendLocation}`);
                    setLocation(backendLocation, { replace: true }); // Replace history for initial sync
                    previousLocationRef.current = backendLocation;
                } else {
                    previousLocationRef.current = location;
                }
            })
            .catch((e: unknown) => { // Catch fetch errors here
                 console.error("[useLocationSync FP Init] Error fetching initial location:", e);
                 // On error, previousLocationRef already holds the initial wouter location
                 // Ensure isLoading is still set to false on error
            })
            .finally(() => {
                 console.log("[useLocationSync FP Init] Initial fetch process complete.");
                 setIsLoading(false); // Set loading to false after fetch attempt (success or error)
            });

        // --- Cleanup Function ---
        return () => {
            console.log('[useLocationSync Lifecycle & Init] Cleaning up listener.');
            cleanupListener(); // Cleanup on unmount
        };
    // Empty dependency array ensures this runs only once on mount and cleanup on unmount
    }, []); // <-- Combined Effect

    // Effect for Persistence on Location Change
    useEffect(() => {
        // Only persist if location is different from the last known persisted/initial location
        // And only after initial loading is complete
        if (!isLoading && location !== previousLocationRef.current) {
            persistLocationFP(location); // Call extracted persistence function
            // Update previous location ref after triggering persistence
            previousLocationRef.current = location;
        }
    }, [location, isLoading]); // Run when location or isLoading changes

    // Return the loading state for the App component to use
    return { isLoading };
}
