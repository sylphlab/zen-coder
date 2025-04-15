import { WritableAtom, ReadableAtom, atom, onMount } from 'nanostores';
import { requestData, listen } from '../../utils/communication';

// --- Types ---

/** Optional payload function or static payload */
type PayloadInput<P> = P | (() => P | null);
/** Optional topic function or static topic */
type TopicInput = string | (() => string | null);

/** Configuration for fetching initial state */
interface FetchConfig<TResponse, TData, PPayload> {
    /** Backend request type for fetching */
    requestType: string;
    /** Payload for the fetch request (static or dynamic function) */
    payload?: PayloadInput<PPayload>;
    /** Optional function to transform the raw fetch response */
    transformResponse?: (response: TResponse) => TData | null;
}

/** Configuration for subscribing to updates */
interface SubscribeConfig<TData, UUpdateData> {
    /** Topic for updates (static or dynamic function) */
    topic: TopicInput;
    /**
     * Function to merge incoming update data with current state.
     * Returns the new state.
     */
    handleUpdate: (currentState: TData | null | 'loading', updateData: UUpdateData) => TData | null; // Allow 'loading' as potential currentState
}

/** Main configuration for createStore */
interface CreateStoreConfig<
    TData,
    TResponse = TData, // Type of raw fetch response
    PPayload = any,    // Type of fetch payload
    UUpdateData = TData // Type of update data pushed via pubsub
> {
    /** Unique key for debugging and potential future use */
    key: string;
    /** Fetch configuration (required for initial state) */
    fetch: FetchConfig<TResponse, TData, PPayload>;
    /** Optional subscribe configuration for real-time updates */
    subscribe?: SubscribeConfig<TData, UUpdateData>;
    /** Optional initial data before first fetch */
    initialData?: TData | null;
    /** Optional array of dependent Nanostores that should trigger re-evaluation */
    dependsOn?: ReadableAtom<any>[];
}

/** The created store interface, extending Nanostores atom and adding refetch */
export interface StandardStore<TData> extends WritableAtom<TData | null | 'loading' | 'error'> {
    refetch: () => Promise<void>;
}

// --- Implementation ---

/**
 * Creates a standard Nanostore atom that fetches initial data via requestData
 * and optionally subscribes to updates via listen, based on the provided configuration.
 */
export function createStore<
    TData,
    TResponse = TData,
    PPayload = any,
    UUpdateData = TData
>(
    config: CreateStoreConfig<TData, TResponse, PPayload, UUpdateData>
): StandardStore<TData> {
    const { key, fetch: fetchConfig, subscribe: subscribeConfig, initialData = null } = config;
    // Initial state is 'loading' unless initialData is provided
    const initialStoreValue: TData | null | 'loading' = initialData !== null ? initialData : 'loading';
    const store = atom<TData | null | 'loading' | 'error'>(initialStoreValue);

    let unsubscribeFromTopic: (() => Promise<void>) | null = null;
    let currentTopic: string | null = null;
    let currentPayloadKey: string | null = null;
    let isFetching = false; // Prevent concurrent fetches

    const getPayload = (): PPayload | null => {
        const payloadConfig = fetchConfig.payload;
        if (!payloadConfig) return {} as PPayload;
        if (typeof payloadConfig === 'function') {
            const payloadFunc = payloadConfig as () => PPayload | null;
            return payloadFunc();
        }
        return payloadConfig;
    };

    const getTopic = (): string | null => {
        if (!subscribeConfig?.topic) return null;
        return typeof subscribeConfig.topic === 'function' ? subscribeConfig.topic() : subscribeConfig.topic;
    };

    const fetchDataAndSubscribe = async (isRefetch = false) => {
        if (isFetching && !isRefetch) { // Allow refetch even if already fetching
            console.log(`[Store ${key}] Fetch already in progress, skipping duplicate non-refetch request.`);
            return;
        }

        const payload = getPayload();
        const topic = getTopic();
        const payloadKey = JSON.stringify(payload);

        // Only refetch if forced, or if payload/topic changed
        if (payloadKey === currentPayloadKey && topic === currentTopic && !isRefetch) {
            return;
        }

        console.log(`[Store ${key}] Context changed or refetch triggered. PayloadKey: ${payloadKey}, Topic: ${topic}`);
        currentPayloadKey = payloadKey;
        isFetching = true; // Mark as fetching

        // Unsubscribe from old topic if changed
        if (topic !== currentTopic && unsubscribeFromTopic) {
            console.log(`[Store ${key}] Topic changed. Unsubscribing from old topic: ${currentTopic}`);
            await unsubscribeFromTopic().catch(e => console.error(`[Store ${key}] Unsubscribe error`, e));
            unsubscribeFromTopic = null;
        }
        currentTopic = topic;

        if (payload !== null) {
            // Set loading only if not already loading (allow refetch to set loading from error/null/data state)
             const currentStateBeforeFetch = store.get();
             if (currentStateBeforeFetch !== 'loading' || isRefetch) {
                 store.set('loading');
             }
            try {
                console.log(`[Store ${key}] Fetching state (${fetchConfig.requestType})... Payload:`, payload);
                const response = await requestData<TResponse>(fetchConfig.requestType, payload);
                console.log(`[Store ${key}] Fetch response received.`);
                 const transformedData = fetchConfig.transformResponse
                     ? fetchConfig.transformResponse(response)
                     : (response as unknown as TData | null);

                 // Only update if the context (payloadKey) hasn't changed again during the async fetch
                 if (currentPayloadKey === payloadKey) {
                    store.set(transformedData ?? null);
                    console.log(`[Store ${key}] State updated after fetch.`);
                 } else {
                    console.log(`[Store ${key}] Stale fetch response received for key ${payloadKey}. Discarding.`);
                 }

            } catch (error) {
                console.error(`[Store ${key}] Error fetching state (${fetchConfig.requestType}):`, error);
                // Only set error if the context hasn't changed and we are not already in error
                const currentStateAfterFetchAttempt = store.get();
                if (currentPayloadKey === payloadKey && currentStateAfterFetchAttempt !== 'error') {
                    store.set('error');
                }
            } finally {
                 // Reset fetching flag only if this specific fetch operation completed for the current context
                if (currentPayloadKey === payloadKey) {
                     isFetching = false;
                }
            }
        } else {
            console.log(`[Store ${key}] Payload is null, skipping fetch.`);
            store.set(null); // Set to null if payload becomes null (e.g., no chat selected)
            isFetching = false; // Reset fetching flag
        }

        // Subscribe to new topic if needed
        if (topic !== null && !unsubscribeFromTopic) {
            try {
                console.log(`[Store ${key}] Subscribing to updates topic: ${topic}`);
                unsubscribeFromTopic = listen(topic, (updateData: UUpdateData) => {
                    // Only process if the topic still matches the current context
                    if (currentTopic === topic && subscribeConfig) {
                        console.log(`[Store ${key}] Received update on topic ${topic}. Applying update. Data:`, updateData);
                        const currentStoreValue = store.get();
                        console.log(`[Store ${key}] State before update:`, JSON.stringify(currentStoreValue));

                        // --- MODIFIED ERROR HANDLING ---
                        // Always attempt handleUpdate, pass null if current state is 'error' or 'loading'
                        const stateForUpdate = (currentStoreValue === 'loading' || currentStoreValue === 'error') ? null : currentStoreValue;

                        try {
                            const newState = subscribeConfig.handleUpdate(stateForUpdate, updateData);
                            console.log(`[Store ${key}] Calculated new state:`, JSON.stringify(newState));
                            // Setting the new state implicitly clears the 'error' state if update was successful
                            store.set(newState);
                            console.log(`[Store ${key}] Store updated for topic ${topic}.`);
                        } catch (handlerError) {
                            // If handleUpdate itself throws, log error and set state back to 'error'
                            console.error(`[Store ${key}] Error within handleUpdate for topic ${topic}:`, handlerError);
                            store.set('error'); // Keep or reset to 'error' if handler fails
                        }

                    } else {
                        console.log(`[Store ${key}] Received update for stale/unsubscribed topic ${topic}. Discarding.`);
                    }
                });
            } catch (error) {
                console.error(`[Store ${key}] Error subscribing to topic ${topic}:`, error);
                 // Optionally set state to error if subscription fails
                 store.set('error');
            }
        }
    };

    (store as StandardStore<TData>).refetch = () => {
        console.log(`[Store ${key}] Manual refetch triggered.`);
        return fetchDataAndSubscribe(true);
    };

    onMount(store, () => {
        console.log(`[Store ${key}] Mounted.`);
        fetchDataAndSubscribe(); // Initial fetch and subscribe

        const dependencyUnsubscribers: (() => void)[] = [];
        if (config.dependsOn && Array.isArray(config.dependsOn)) {
            config.dependsOn.forEach((dependencyStore, index) => {
                console.log(`[Store ${key}] Subscribing to dependency ${index}...`);
                // Subscribe and trigger refetch *only* if the dependency value actually changes
                let previousValue = dependencyStore.get();
                const unsubscribe = dependencyStore.subscribe((currentValue) => {
                    // Basic shallow comparison for simplicity, might need deep compare for complex objects
                     if (JSON.stringify(currentValue) !== JSON.stringify(previousValue)) {
                        console.log(`[Store ${key}] Dependency ${index} changed. Triggering re-evaluation.`);
                        previousValue = currentValue; // Update previous value
                        fetchDataAndSubscribe(); // Refetch and potentially resubscribe
                     }
                });
                dependencyUnsubscribers.push(unsubscribe);
            });
        }

        return () => {
            console.log(`[Store ${key}] Unmounted. Cleaning up subscriptions.`);
            unsubscribeFromTopic?.().catch(e => console.error(`[Store ${key}] Error unsubscribing from topic ${currentTopic} on unmount:`, e));
            unsubscribeFromTopic = null;
            currentTopic = null;
            dependencyUnsubscribers.forEach((unsubscribe, index) => {
                console.log(`[Store ${key}] Unsubscribing from dependency ${index}.`);
                unsubscribe();
            });
            currentPayloadKey = null;
            isFetching = false; // Reset fetching flag on unmount
        };
    });

    return store as StandardStore<TData>;
}
