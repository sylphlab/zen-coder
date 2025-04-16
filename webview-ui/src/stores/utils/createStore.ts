import { WritableAtom, ReadableAtom, atom, onMount } from 'nanostores';
import { requestData, listen } from '../../utils/communication';
import { applyPatch, Operation } from 'fast-json-patch'; // Import patch application logic

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
     * Optional function to merge incoming update data with current state.
     * If not provided, createStore assumes updateData is a JSON Patch (Operation[])
     * and applies it internally.
     * Returns the new state.
     */
    handleUpdate?: (currentState: TData | null | 'loading' | 'error', updateData: UUpdateData) => TData | null; // Make handleUpdate optional
}

/** Main configuration for createStore */
interface CreateStoreConfig<
    TData,
    TResponse = TData,    // Type of raw fetch response
    PPayload = any,       // Type of fetch payload
    UUpdateData = Operation[] // Type of update data pushed via pubsub is now JSON Patch array
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

/** The created store interface, extending Nanostores atom and adding refetch and optimistic patch application */
export interface StandardStore<TData> extends WritableAtom<TData | null | 'loading' | 'error'> {
    refetch: () => Promise<void>;
    /** (Internal) Sets the optimistic state directly. */
    _setOptimisticState: (state: TData | null) => void; // New method
    /** Clears any current optimistic state, reverting the store's value to the actual state. */
    clearOptimisticState: () => void; // Keep public for rollback
    /** Gets the current actual state, ignoring any optimistic state. */
    getActualState: () => TData | null | 'loading' | 'error';
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
    UUpdateData = TData // Default UUpdateData to TData if not specified
>(
    config: CreateStoreConfig<TData, TResponse, PPayload, UUpdateData>
): StandardStore<TData> {
    const { key, fetch: fetchConfig, subscribe: subscribeConfig, initialData = null } = config;
    // Initial state is 'loading' unless initialData is provided
    const initialStoreValue: TData | null | 'loading' = initialData !== undefined ? initialData : 'loading'; // Use undefined check for initialData
    // Internal states
    let _actualState: TData | null | 'loading' | 'error' = initialStoreValue;
    let _optimisticState: TData | null = null; // Initially no optimistic state

    // The main store reflects the combined state (optimistic ?? actual)
    const store = atom<TData | null | 'loading' | 'error'>(initialStoreValue);

    let unsubscribeFromTopic: (() => Promise<void>) | null = null;
    let currentTopic: string | null = null;
    let currentPayloadKey: string | null = null;
    let isFetching = false; // Prevent concurrent fetches

    const getPayload = (): PPayload | null => {
        const payloadConfig = fetchConfig.payload;
        if (!payloadConfig) return {} as PPayload; // Return empty object if no payload config
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
        if (isFetching && !isRefetch) {
            console.log(`[Store ${key}] Fetch already in progress, skipping duplicate non-refetch request.`);
            return;
        }

        const payload = getPayload();
        const topic = getTopic();
        const payloadKey = JSON.stringify(payload); // Use payload for key, not payloadConfig

        if (payloadKey === currentPayloadKey && topic === currentTopic && !isRefetch) {
            return;
        }

        console.log(`[Store ${key}] Context changed or refetch triggered. PayloadKey: ${payloadKey}, Topic: ${topic}`);
        currentPayloadKey = payloadKey;
        isFetching = true;

        if (topic !== currentTopic && unsubscribeFromTopic) {
            console.log(`[Store ${key}] Topic changed. Unsubscribing from old topic: ${currentTopic}`);
            await unsubscribeFromTopic().catch(e => console.error(`[Store ${key}] Unsubscribe error`, e));
            unsubscribeFromTopic = null;
        }
        currentTopic = topic;

        if (payload !== null) {
            _actualState = 'loading';
            _optimisticState = null;
            store.set('loading');
            try {
                console.log(`[Store ${key}] Fetching state (${fetchConfig.requestType})... Payload:`, payload);
                const response = await requestData<TResponse>(fetchConfig.requestType, payload);
                console.log(`[Store ${key}] Fetch response received.`);
                 const transformedData = fetchConfig.transformResponse
                     ? fetchConfig.transformResponse(response)
                     : (response as unknown as TData | null);

                 if (currentPayloadKey === payloadKey) {
                    _actualState = transformedData ?? null;
                    _optimisticState = null;
                    store.set(_actualState);
                    console.log(`[Store ${key}] Actual state updated after fetch.`);
                 } else {
                    console.log(`[Store ${key}] Stale fetch response received for key ${payloadKey}. Discarding actual state update.`);
                 }

            } catch (error) {
                console.error(`[Store ${key}] Error fetching state (${fetchConfig.requestType}):`, error);
                if (currentPayloadKey === payloadKey) {
                    _actualState = 'error';
                    _optimisticState = null;
                    store.set('error');
                }
            } finally {
                if (currentPayloadKey === payloadKey) {
                     isFetching = false;
                }
            }
        } else {
            console.log(`[Store ${key}] Payload is null, skipping fetch.`);
            _actualState = null;
            _optimisticState = null;
            store.set(null);
            isFetching = false;
        }

        if (topic !== null && !unsubscribeFromTopic) {
            try {
                console.log(`[Store ${key}] Subscribing to updates topic: ${topic}`);
                unsubscribeFromTopic = listen(topic, (updateData: UUpdateData) => {
                    if (currentTopic === topic) {
                        console.log(`[Store ${key}] Received update on topic ${topic}. Data:`, updateData);
                        const stateForUpdate = (_actualState === 'loading' || _actualState === 'error') ? null : _actualState;
                        console.log(`[Store ${key}] State before update:`, JSON.stringify(stateForUpdate));

                        try {
                            // If a custom handleUpdate is provided, use it
                            if (subscribeConfig?.handleUpdate) {
                                const newState = subscribeConfig.handleUpdate(stateForUpdate, updateData);
                                _actualState = newState;
                                _optimisticState = null; // Clear optimistic state when actual state updates
                                store.set(_actualState);
                                console.log(`[Store ${key}] State updated via custom handleUpdate for topic ${topic}.`);
                            }
                            // Otherwise, assume updateData is a JSON Patch array and apply it
                            else if (Array.isArray(updateData)) {
                                let objectToPatch: any;
                                if (stateForUpdate === null || typeof stateForUpdate !== 'object') {
                                    const firstPath = updateData[0]?.path;
                                    objectToPatch = (firstPath && (firstPath.startsWith('/-') || /^\/\d+/.test(firstPath))) ? [] : {};
                                    console.log(`[Store ${key}] Actual state is not patchable, starting from empty ${Array.isArray(objectToPatch) ? 'array' : 'object'}.`);
                                } else {
                                    objectToPatch = JSON.parse(JSON.stringify(stateForUpdate)); // Deep clone
                                }

                                const patchResult = applyPatch(objectToPatch, updateData as Operation[], true, false); // Cast updateData
                                const newActualState = patchResult.newDocument as TData | null;

                                console.log(`[Store ${key}] Patch applied successfully to actual state.`);
                                _actualState = newActualState;
                                _optimisticState = null; // Clear optimistic state when actual state updates via patch
                                store.set(_actualState);
                                console.log(`[Store ${key}] Main store updated with new actual state for topic ${topic}.`);
                            } else {
                                // If no handleUpdate and data is not a patch array, it's an error
                                throw new Error(`Received non-array patch data and no custom handleUpdate provided for topic ${topic}: ${JSON.stringify(updateData)}`);
                            }
                        } catch (updateError) { // Catch errors from both custom handleUpdate and patch application
                            console.error(`[Store ${key}] Error processing update for topic ${topic}:`, updateError);
                            console.error(`[Store ${key}] Failing Update Data:`, JSON.stringify(updateData));
                            console.error(`[Store ${key}] State Before Update Attempt:`, JSON.stringify(stateForUpdate));
                            // Set actual state to error and clear optimistic state
                            _actualState = 'error';
                            _optimisticState = null;
                            store.set('error'); // Update main store to error
                        }
                    } else {
                        console.log(`[Store ${key}] Received update for stale/unsubscribed topic ${topic}. Discarding.`);
                    }
                });
            } catch (error) {
                console.error(`[Store ${key}] Error subscribing to topic ${topic}:`, error);
                 store.set('error');
            }
        }
    };

    // --- Add _setOptimisticState method (Internal) ---
    // This method is intended to be called by createMutationStore
    (store as StandardStore<TData>)._setOptimisticState = (state: TData | null) => {
        console.log(`[Store ${key}] Setting optimistic state (internal):`, state);
        const currentActual = (_actualState === 'loading' || _actualState === 'error') ? null : _actualState;
        console.log(`[Store ${key}] Current actual state:`, JSON.stringify(currentActual));

        _optimisticState = state; // Set internal optimistic state
        // Update main store only if optimistic state is not null
        if (_optimisticState !== null) {
             store.set(_optimisticState);
             console.log(`[Store ${key}] Optimistic state set. Main store now reflects optimistic state.`);
        } else {
             // If optimistic state is null, ensure store reflects actual state
             store.set(_actualState);
             console.log(`[Store ${key}] Optimistic state set to null. Main store reflects actual state.`);
        }
    };

    // --- Add clearOptimisticState method ---
     (store as StandardStore<TData>).clearOptimisticState = () => {
        if (_optimisticState !== null) {
            console.log(`[Store ${key}] Clearing optimistic state.`);
            _optimisticState = null;
            store.set(_actualState); // Revert main store to actual state
        }
    };

    // --- Add getActualState method ---
     (store as StandardStore<TData>).getActualState = () => {
        return _actualState;
    };

    // --- Modify refetch method ---
    (store as StandardStore<TData>).refetch = () => {
        console.log(`[Store ${key}] Manual refetch triggered.`);
        _optimisticState = null; // Clear optimistic state on refetch
        return fetchDataAndSubscribe(true);
    };

    onMount(store, () => {
        console.log(`[Store ${key}] Mounted.`);
        fetchDataAndSubscribe(); // Initial fetch and subscribe

        const dependencyUnsubscribers: (() => void)[] = [];
        if (config.dependsOn && Array.isArray(config.dependsOn)) {
            config.dependsOn.forEach((dependencyStore, index) => {
                console.log(`[Store ${key}] Subscribing to dependency ${index}...`);
                let previousValue = dependencyStore.get();
                const unsubscribe = dependencyStore.subscribe((currentValue) => {
                     if (JSON.stringify(currentValue) !== JSON.stringify(previousValue)) {
                        console.log(`[Store ${key}] Dependency ${index} changed. Triggering re-evaluation.`);
                        previousValue = currentValue;
                        fetchDataAndSubscribe();
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
            isFetching = false;
        };
    });

    return store as StandardStore<TData>;
}
