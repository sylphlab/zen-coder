import { atom, onMount, WritableAtom } from 'nanostores';
import { requestData, listen } from '../../utils/communication';

interface CreateFetcherStoreOptions<T, TRawResponse = T> {
  initialData?: T | null;
  transformFetchResponse?: (response: TRawResponse) => T | null;
  /** If true, keeps the atom in a 'loading' state (null) until the first update arrives via listen.
   * If false (default), sets the initial data after fetch completes. */
  waitForSubscription?: boolean;
}

/**
 * Creates a Nanostores atom that fetches initial data via requestData
 * and subscribes to updates via the listen function.
 *
 * @template T The desired type of the state data managed by the atom.
 * @template TRawResponse The type of the raw response from the initial fetch request (defaults to T).
 * @param {string} topic The topic name to listen for updates (data pushed should be T | null).
 * @param {string} fetchRequestType The request type for the initial data fetch.
 * @param {CreateFetcherStoreOptions<T, TRawResponse>} [options] Optional configuration.
 * @returns {WritableAtom<T | null>} A Nanostores atom containing the data (or null if loading/error).
 */
export function createFetcherStore<T, TRawResponse = T>(
  topic: string,
  fetchRequestType: string,
  options?: CreateFetcherStoreOptions<T, TRawResponse>
): WritableAtom<T | null> {
  const {
    initialData = null,
    transformFetchResponse,
    waitForSubscription = false // Default to false
  } = options ?? {};

  // Create the base atom with the initial data
  const store = atom<T | null>(initialData);

  // Define the onMount logic
  onMount(store, () => {
    console.log(`[createFetcherStore ${topic}] onMount: Initializing...`);
    let isMounted = true;
    let unsubscribe: (() => Promise<void>) | null = null;

    // Helper to process raw fetch response
    const processFetchResponse = (rawResponse: TRawResponse | null | undefined): T | null => {
        const defaultResult = initialData ?? null;
        if (rawResponse === null || rawResponse === undefined) return defaultResult;
        if (transformFetchResponse) {
            return transformFetchResponse(rawResponse) ?? defaultResult;
        }
        // If no transformer, assume TRawResponse is assignable to T
        return (rawResponse as unknown as T) ?? defaultResult;
    };

    // 1. Subscribe to updates
    try {
        // NOTE: The type here is potentially TRawResponse if the backend pushes the raw structure
        // The 'listen' callback receives the *entire* pushUpdate message payload: { topic: string, data: T | TRawResponse | null }
        unsubscribe = listen(topic, (messagePayload: { topic: string, data: TRawResponse | T | null }) => {
            if (isMounted && messagePayload && messagePayload.topic === topic) {
                console.log(`[createFetcherStore ${topic}] Received update via listen. Full messagePayload:`, JSON.stringify(messagePayload)); // Log raw message
                // Extract the 'data' part of the message before processing
                const updateData = messagePayload.data;
                 console.log(`[createFetcherStore ${topic}] Extracted updateData from message:`, JSON.stringify(updateData)); // Log extracted data from message
                // Check if the updateData has a 'payload' property, common for push updates
                let dataToProcess: TRawResponse | null | undefined;
                if (typeof updateData === 'object' && updateData !== null && 'payload' in updateData) {
                    console.log(`[createFetcherStore ${topic}] Update seems to have a 'payload' property. Extracting payload.`);
                    dataToProcess = (updateData as { payload: TRawResponse | null }).payload;
                } else {
                     console.log(`[createFetcherStore ${topic}] Update does not have 'payload'. Using data directly.`);
                    dataToProcess = updateData as TRawResponse | null | undefined; // Use data directly if no payload property
                }
                console.log(`[createFetcherStore ${topic}] Data prepared for processing:`, JSON.stringify(dataToProcess));
                // Process the prepared 'dataToProcess'
                const transformedUpdate = processFetchResponse(dataToProcess);
                console.log(`[createFetcherStore ${topic}] Data after transformFetchResponse:`, JSON.stringify(transformedUpdate)); // Log transformed data
                // Deep clone the data to ensure reference changes for reactivity
                const clonedUpdate = transformedUpdate ? JSON.parse(JSON.stringify(transformedUpdate)) : null;
                // Force reactivity by setting to null briefly before the actual update
                store.set(null);
                setTimeout(() => store.set(clonedUpdate), 0); // Update store with cloned transformed data in next tick
            }
        });
    } catch (error) {
        console.error(`[createFetcherStore ${topic}] Error subscribing:`, error);
    }

    // 2. Initial fetch
    console.log(`[createFetcherStore ${topic}] Fetching initial data (${fetchRequestType})...`);
    requestData<TRawResponse>(fetchRequestType)
        .then(responseData => {
            if (isMounted) {
                console.log(`[createFetcherStore ${topic}] Received initial fetch data. Raw responseData:`, JSON.stringify(responseData)); // Log raw initial fetch data
                const transformedData = processFetchResponse(responseData);
                 console.log(`[createFetcherStore ${topic}] Initial fetch data after transformFetchResponse:`, JSON.stringify(transformedData)); // Log transformed initial fetch data
                // Only set data if not waiting for the first subscription update
                if (!waitForSubscription) {
                     // Deep clone the data to ensure reference changes for reactivity
                    const clonedData = transformedData ? JSON.parse(JSON.stringify(transformedData)) : null;
                    // Force reactivity by setting to null briefly before the actual update
                    store.set(null);
                    setTimeout(() => store.set(clonedData), 0); // Update store with cloned transformed data in next tick
                } else {
                    // If waiting, we might still log or store it temporarily if needed,
                    // but the main 'set' happens in the listen callback.
                    console.log(`[createFetcherStore ${topic}] Waiting for first subscription update to set initial state.`);
                }
            }
        })
        .catch(err => {
            if (isMounted) {
                console.error(`[createFetcherStore ${topic}] Error fetching initial data:`, err);
                // Keep initialData on error
                store.set(initialData);
            }
        });

    // Return the cleanup function
    return () => {
        isMounted = false;
        console.log(`[createFetcherStore ${topic}] onUnmount: Disposing subscription.`);
        if (unsubscribe) {
            unsubscribe().catch(err => console.error(`[createFetcherStore ${topic}] Error disposing subscription:`, err));
        }
    };
  }); // End onMount

  return store;
}
